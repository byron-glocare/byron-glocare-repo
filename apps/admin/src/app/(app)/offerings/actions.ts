"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { assessOfferingReadiness } from "@/lib/admission/assess-offering-readiness";

type OfferingInsert = Database["public"]["Tables"]["study_offerings"]["Insert"];
type OfferingUpdate = Database["public"]["Tables"]["study_offerings"]["Update"];

const STATUSES = ["draft", "published", "closed", "archived"] as const;

const saveSchema = z.object({
  university_id: z.coerce.number().int().positive(),
  department_id: z.coerce.number().int().positive(),
  term: z.string().min(1).max(100),
  intake_quota: z.coerce.number().int().min(0).max(100000).nullable(),
  status: z.enum(STATUSES),
  source_spec_id: z.string().uuid().nullable(),
  sort_order: z.coerce.number().int().min(0).max(9999),
  notes: z.string().max(2000).nullable(),
});

export type SaveOfferingState =
  | {
      error?: string;
      fieldErrors?: Record<string, string>;
      success?: boolean;
      /** U5: 노출 성공했지만 미완료 항목이 있을 때 */
      warnings?: string[];
    }
  | undefined;

function emptyToNull(v: FormDataEntryValue | null): string | null {
  if (v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function numOrNull(v: FormDataEntryValue | null): number | null {
  const s = emptyToNull(v);
  return s === null ? null : Number(s);
}

/**
 * 모집(offering) 생성/수정.
 *   id=null → INSERT, id=string → UPDATE.
 *   글로케어 큐레이션 단위: 대학 × 학과 × 학기 + 학기별 모집수.
 */
export async function saveOfferingAction(
  id: string | null,
  _prev: SaveOfferingState,
  formData: FormData
): Promise<SaveOfferingState> {
  const supabaseUser = await createClient();
  const {
    data: { user },
  } = await supabaseUser.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다" };

  const supabase = createAdminClient();

  const raw = {
    university_id: numOrNull(formData.get("university_id")),
    department_id: numOrNull(formData.get("department_id")),
    term: formData.get("term"),
    intake_quota: numOrNull(formData.get("intake_quota")),
    status: formData.get("status") || "draft",
    source_spec_id: emptyToNull(formData.get("source_spec_id")),
    sort_order: formData.get("sort_order") || "0",
    notes: emptyToNull(formData.get("notes")),
  };

  const parsed = saveSchema.safeParse(raw);
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0] ?? "");
      if (k && !fe[k]) fe[k] = issue.message;
    }
    return { fieldErrors: fe };
  }
  const data = parsed.data;

  // 노출(published)은 학기별 모집수 필수 (DB CHECK 와 동일 — 미리 친절한 메시지)
  if (data.status === "published" && data.intake_quota == null) {
    return {
      fieldErrors: {
        intake_quota: "노출(모집중)하려면 학기별 모집수를 입력하세요.",
      },
    };
  }

  // U5: 노출 게이트 — 승인된 모집요강이 없으면 노출 불가
  let publishWarnings: string[] = [];
  // 노출하는데 모집요강이 연결돼 있지 않으면, 게이트가 찾아낸 승인 요강을 그대로 건다.
  // 유학센터의 지원 가능 목록은 source_spec_id 가 있는 것만 뽑기 때문에, 연결이
  // 비어 있으면 "노출했는데 센터엔 안 보이는" 상태가 된다.
  let sourceSpecId = data.source_spec_id;
  if (data.status === "published") {
    const readiness = await assessOfferingReadiness(
      data.university_id,
      data.term
    );
    if (readiness.blocked) {
      return { error: readiness.reason };
    }
    publishWarnings = readiness.warnings;
    if (!sourceSpecId) sourceSpecId = readiness.approvedSpecId;
  }

  if (id) {
    const patch: OfferingUpdate = {
      university_id: data.university_id,
      department_id: data.department_id,
      term: data.term,
      intake_quota: data.intake_quota,
      status: data.status,
      source_spec_id: sourceSpecId,
      sort_order: data.sort_order,
      notes: data.notes,
    };
    const { error } = await supabase
      .from("study_offerings")
      .update(patch)
      .eq("id", id);
    if (error) {
      if (error.code === "23505") {
        return {
          error:
            "이미 같은 대학·학과·학기·언어트랙·위치 조합의 모집이 있습니다.",
        };
      }
      return { error: `수정 실패: ${error.message}` };
    }
  } else {
    const ins: OfferingInsert = {
      university_id: data.university_id,
      department_id: data.department_id,
      term: data.term,
      intake_quota: data.intake_quota,
      status: data.status,
      source_spec_id: sourceSpecId,
      sort_order: data.sort_order,
      notes: data.notes,
      created_by: user.id,
    };
    const { error } = await supabase.from("study_offerings").insert(ins);
    if (error) {
      if (error.code === "23505") {
        return {
          error:
            "이미 같은 대학·학과·학기·언어트랙·위치 조합의 모집이 있습니다.",
        };
      }
      return { error: `저장 실패: ${error.message}` };
    }
  }

  revalidatePath("/offerings");
  return { success: true, warnings: publishWarnings };
}

/**
 * 모집 삭제.
 */
export async function deleteOfferingAction(id: string): Promise<void> {
  const supabaseUser = await createClient();
  const {
    data: { user },
  } = await supabaseUser.auth.getUser();
  if (!user) return;

  const supabase = createAdminClient();
  await supabase.from("study_offerings").delete().eq("id", id);

  revalidatePath("/offerings");
}

/**
 * 빠른 상태 변경 (목록에서 노출/숨김 토글).
 *   published 전환은 intake_quota 필수 — 모집수가 비어있으면 무시(버튼 미노출 가정).
 */
export async function updateOfferingStatusAction(
  id: string,
  status: (typeof STATUSES)[number]
): Promise<{ ok: boolean; error?: string; warnings?: string[] }> {
  const supabaseUser = await createClient();
  const {
    data: { user },
  } = await supabaseUser.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다" };

  const supabase = createAdminClient();

  let warnings: string[] = [];
  const patch: OfferingUpdate = { status };
  if (status === "published") {
    const { data: row } = await supabase
      .from("study_offerings")
      .select("intake_quota, university_id, term, source_spec_id")
      .eq("id", id)
      .maybeSingle();
    if (!row) return { ok: false, error: "모집을 찾을 수 없습니다" };
    if (row.intake_quota == null) {
      return { ok: false, error: "노출하려면 학기별 모집수를 입력하세요." };
    }
    // U5: 노출 게이트 — 승인된 모집요강 필수
    const readiness = await assessOfferingReadiness(
      row.university_id,
      row.term
    );
    if (readiness.blocked) {
      return { ok: false, error: readiness.reason };
    }
    warnings = readiness.warnings;
    // 연결이 비어 있으면 게이트가 찾은 승인 요강을 건다. 안 걸면 노출은 됐는데
    // 유학센터의 지원 가능 목록에는 안 나오는 상태가 된다.
    if (!row.source_spec_id) patch.source_spec_id = readiness.approvedSpecId;
  }

  await supabase.from("study_offerings").update(patch).eq("id", id);
  revalidatePath("/offerings");
  return { ok: true, warnings };
}
