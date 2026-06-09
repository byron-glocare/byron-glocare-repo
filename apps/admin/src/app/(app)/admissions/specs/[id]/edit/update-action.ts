"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import type { StudyAdmissionSpecUpdate } from "@/types/database";

const PROGRAM_TYPES = [
  "language_program",
  "associate_2yr",
  "bachelor_3yr_extension",
  "bachelor_4yr",
] as const;

const STATUSES = ["draft", "reviewing", "approved", "archived"] as const;

const SPEC_AREAS = [
  "departments",
  "required_documents",
  "eligibility",
  "schedule",
  "tuition",
  "scholarships",
  "metadata",
] as const;

const metaSchema = z.object({
  university_id: z.coerce.number().int().positive(),
  term: z.string().regex(/^\d{4}-(Spring|Fall|Summer|Winter|Year)$/),
  admission_category: z.string().max(200).optional().nullable(),
  program_type: z.enum(PROGRAM_TYPES),
  status: z.enum(STATUSES),
  source_file_url: z.string().max(500).optional().nullable(),
});

export type UpdateSpecState =
  | {
      error?: string;
      fieldErrors?: Record<string, string>;
    }
  | undefined;

export async function updateSpecAction(
  specId: string,
  _prev: UpdateSpecState,
  formData: FormData
): Promise<UpdateSpecState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다" };

  const metaRaw = {
    university_id: formData.get("university_id"),
    term: formData.get("term"),
    admission_category: formData.get("admission_category") || null,
    program_type: formData.get("program_type"),
    status: formData.get("status"),
    source_file_url: formData.get("source_file_url") || null,
  };
  const metaParsed = metaSchema.safeParse(metaRaw);
  if (!metaParsed.success) {
    const fe: Record<string, string> = {};
    for (const issue of metaParsed.error.issues) {
      const k = String(issue.path[0] ?? "");
      if (k && !fe[k]) fe[k] = issue.message;
    }
    return { fieldErrors: fe };
  }
  const meta = metaParsed.data;

  const jsonAreas: Record<string, unknown> = {};
  for (const area of SPEC_AREAS) {
    const raw = formData.get(`spec_${area}`);
    if (typeof raw !== "string" || raw.trim() === "") {
      jsonAreas[area] =
        area === "departments" ||
        area === "required_documents" ||
        area === "scholarships"
          ? []
          : {};
      continue;
    }
    try {
      jsonAreas[area] = JSON.parse(raw);
    } catch (e) {
      return {
        fieldErrors: {
          [`spec_${area}`]: `JSON parse 실패: ${e instanceof Error ? e.message : String(e)}`,
        },
      };
    }
  }

  // 온라인 접수 + 가이드(새 파일 업로드 시에만 교체)
  const isOnline = formData.get("is_online_submission") === "on";
  const onlineFormUrlRaw = formData.get("online_form_url");
  const onlineFormUrl =
    isOnline && typeof onlineFormUrlRaw === "string" && onlineFormUrlRaw.trim()
      ? onlineFormUrlRaw.trim()
      : null;
  let newGuideUrl: string | null = null;
  const guideB64 = formData.get("guide_base64");
  if (isOnline && typeof guideB64 === "string" && guideB64.trim() !== "") {
    const guideName = String(formData.get("guide_name") ?? "guide");
    const guideType = String(formData.get("guide_type") ?? "application/octet-stream");
    const safe = guideName.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-100);
    const path = `admission-guides/${meta.university_id}/${Date.now()}_${safe}`;
    const admin = createAdminClient();
    const { error: upErr } = await admin.storage
      .from("admission-form-files")
      .upload(path, Buffer.from(guideB64, "base64"), {
        contentType: guideType,
        upsert: false,
      });
    if (upErr) return { error: `가이드 업로드 실패: ${upErr.message}` };
    newGuideUrl = admin.storage
      .from("admission-form-files")
      .getPublicUrl(path).data.publicUrl;
  }

  // 승인 상태로 변경 시 approved_by/at stamping
  const patch: StudyAdmissionSpecUpdate = {
    university_id: meta.university_id,
    term: meta.term,
    admission_category: meta.admission_category,
    program_type: meta.program_type,
    status: meta.status,
    departments: jsonAreas.departments,
    required_documents: jsonAreas.required_documents,
    eligibility: jsonAreas.eligibility,
    schedule: jsonAreas.schedule,
    tuition: jsonAreas.tuition,
    scholarships: jsonAreas.scholarships,
    metadata: jsonAreas.metadata,
    source_file_url: meta.source_file_url,
    is_online_submission: isOnline,
    online_form_url: onlineFormUrl,
  };
  // 새 가이드 업로드 시에만 URL 교체 (없으면 기존 유지)
  if (newGuideUrl) patch.online_guide_url = newGuideUrl;

  // 승인 status 로 변경 시 approved_by/at 갱신
  if (meta.status === "approved") {
    patch.approved_by = user.id;
    patch.approved_at = new Date().toISOString();
  }

  const { error: updateErr } = await supabase
    .from("study_admission_specs")
    .update(patch)
    .eq("id", specId);

  if (updateErr) {
    // UNIQUE 제약 충돌 등
    return {
      error: `DB UPDATE 실패: ${updateErr.message}`,
    };
  }

  revalidatePath("/admissions");
  revalidatePath(`/admissions/specs/${specId}`);
  redirect(`/admissions/specs/${specId}`);
}
