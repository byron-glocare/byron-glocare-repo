"use server";

/**
 * 모집요강 편집 — 기본 탭(요강 공통) 저장.
 *   전형 이름·상태·원본 파일·온라인 접수·기타(metadata). 옛 required_documents JSONB 는 건드리지 않는다.
 *   학과(학비·장학금·자격·발급서류·양식)와 학기(일정·모집 학과)는 학과/학기 탭의 개별 액션이 저장한다.
 *   term 컬럼은 학기 중 가장 늦은 것으로 맞춘다(옛 읽기 코드용). program_type 은 손대지 않는다.
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isGlocareAdmin } from "@/lib/admin-guard";
import type { StudyAdmissionSpecUpdate } from "@/types/database";
import { refreshSpecLegacyCaches } from "@/lib/admission/spec-departments";
import { syncSpecLegacyTerm } from "@/lib/admission/spec-merge";

const STATUSES = ["draft", "reviewing", "approved", "archived"] as const;

const metaSchema = z.object({
  admission_category: z.string().max(200).optional().nullable(),
  status: z.enum(STATUSES),
  source_file_url: z.string().max(500).optional().nullable(),
});

export type UpdateSpecState =
  | {
      error?: string;
      fieldErrors?: Record<string, string>;
    }
  | undefined;

export async function updateSpecAction(specId: string, _prev: UpdateSpecState, formData: FormData): Promise<UpdateSpecState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다" };
  if (!isGlocareAdmin(user)) return { error: "권한이 없습니다" };

  const metaParsed = metaSchema.safeParse({
    admission_category: formData.get("admission_category") || null,
    status: formData.get("status"),
    source_file_url: formData.get("source_file_url") || null,
  });
  if (!metaParsed.success) {
    const fe: Record<string, string> = {};
    for (const issue of metaParsed.error.issues) {
      const k = String(issue.path[0] ?? "");
      if (k && !fe[k]) fe[k] = issue.message;
    }
    return { fieldErrors: fe };
  }
  const meta = metaParsed.data;

  const parseArea = (key: string, fallback: unknown): { ok: true; value: unknown } | { ok: false; error: string } => {
    const raw = formData.get(key);
    if (typeof raw !== "string" || raw.trim() === "") return { ok: true, value: fallback };
    try {
      return { ok: true, value: JSON.parse(raw) };
    } catch (e) {
      return { ok: false, error: `JSON parse 실패: ${e instanceof Error ? e.message : String(e)}` };
    }
  };
  const metadata = parseArea("spec_metadata", {});
  if (!metadata.ok) return { fieldErrors: { spec_metadata: metadata.error } };

  const admin = createAdminClient();
  const { data: spec } = await admin.from("study_admission_specs").select("id, university_id").eq("id", specId).maybeSingle();
  if (!spec) return { error: "모집요강을 찾을 수 없습니다." };

  // 옛 JSONB(required_documents)는 여기서 건드리지 않는다 — 작성서류·미연결 옛 줄은
  // 기본 탭의 옛 줄 목록(legacy-doc-actions)이 줄마다 학과로 옮기거나 지운다.

  // 온라인 접수 + 가이드(새 파일 업로드 시에만 교체)
  const isOnline = formData.get("is_online_submission") === "on";
  const onlineFormUrlRaw = formData.get("online_form_url");
  const onlineFormUrl = isOnline && typeof onlineFormUrlRaw === "string" && onlineFormUrlRaw.trim() ? onlineFormUrlRaw.trim() : null;
  let newGuideUrl: string | null = null;
  const guideB64 = formData.get("guide_base64");
  if (isOnline && typeof guideB64 === "string" && guideB64.trim() !== "") {
    const guideName = String(formData.get("guide_name") ?? "guide");
    const guideType = String(formData.get("guide_type") ?? "application/octet-stream");
    const safe = guideName.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-100);
    const path = `admission-guides/${spec.university_id}/${Date.now()}_${safe}`;
    const { error: upErr } = await admin.storage
      .from("admission-form-files")
      .upload(path, Buffer.from(guideB64, "base64"), { contentType: guideType, upsert: false });
    if (upErr) return { error: `가이드 업로드 실패: ${upErr.message}` };
    newGuideUrl = admin.storage.from("admission-form-files").getPublicUrl(path).data.publicUrl;
  }

  const patch: StudyAdmissionSpecUpdate = {
    admission_category: meta.admission_category,
    status: meta.status,
    // eligibility 는 학과별(0068) — 요강 공통 자격은 더 이상 여기서 저장하지 않는다(옛 값은 학과 자격 초기값용으로만 남긴다)
    metadata: metadata.value,
    source_file_url: meta.source_file_url,
    is_online_submission: isOnline,
    online_form_url: onlineFormUrl,
  };
  if (newGuideUrl) patch.online_guide_url = newGuideUrl;
  if (meta.status === "approved") {
    patch.approved_by = user.id;
    patch.approved_at = new Date().toISOString();
  }

  const { error: updateErr } = await admin.from("study_admission_specs").update(patch).eq("id", specId);
  if (updateErr) return { error: `DB UPDATE 실패: ${updateErr.message}` };

  await syncSpecLegacyTerm(admin, specId);
  const cacheErr = await refreshSpecLegacyCaches(admin, specId);
  if (cacheErr) return { error: cacheErr };

  revalidatePath("/admissions");
  revalidatePath(`/admissions/${spec.university_id}`);
  revalidatePath(`/admissions/specs/${specId}`);
  redirect(`/admissions/specs/${specId}`);
}
