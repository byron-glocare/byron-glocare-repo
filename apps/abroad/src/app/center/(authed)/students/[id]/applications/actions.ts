"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { verifyCenterSession } from "@/lib/center/dal";
import { createCenterClient } from "@/lib/supabase/center";

import { APP_STATUS_VALUES } from "./status";

const updateStatusSchema = z.object({
  status: z.enum(APP_STATUS_VALUES),
});

/**
 * 지원의 status 만 변경. workflow 룰 강제 X (운영자가 어느 단계로든 자유 변경).
 *   - 학생 상세 페이지의 inline form 에서 호출
 *   - RLS 가 본인 org 학생의 지원만 update 허용
 *   - status 변경에 따른 시점 자동 stamping:
 *       submitted → submitted_to_university_at = NOW()
 *       accepted  → accepted_at
 *       enrolled  → enrolled_at
 *       cancelled → cancelled_at
 */
export async function updateApplicationStatusAction(
  applicationId: string,
  studentId: string,
  formData: FormData
) {
  await verifyCenterSession();

  const parsed = updateStatusSchema.safeParse({
    status: formData.get("status"),
  });
  if (!parsed.success) {
    // 잘못된 status 값 — 무시하고 학생 상세로
    revalidatePath(`/center/students/${studentId}`);
    return;
  }

  const status = parsed.data.status;
  const supabase = await createCenterClient();

  const nowIso = new Date().toISOString();
  const patch: Record<string, string> = {
    status,
    last_review_at: nowIso,
  };
  if (status === "submitted") patch.submitted_to_university_at = nowIso;
  if (status === "accepted") patch.accepted_at = nowIso;
  if (status === "enrolled") patch.enrolled_at = nowIso;
  if (status === "cancelled") patch.cancelled_at = nowIso;

  await supabase
    .from("study_applications")
    // TODO(phase2): study_applications 의 상태 타임스탬프 컬럼
    //   (submitted_to_university_at / accepted_at / enrolled_at / cancelled_at)
    //   이 database.ts 에 누락(stale 타입). 스펙 정의: docs/specs/B1_schema.sql L259-263.
    //   types/database.ts 재생성 후 이 `as never` 캐스트 제거할 것.
    .update(patch as never)
    .eq("id", applicationId);

  revalidatePath(`/center/students/${studentId}`);
}

/**
 * 지원 의향 삭제.
 *   - RLS 가 본인 org 학생의 지원만 delete 허용
 *   - related: study_review_feedback, study_timelines, study_application_documents 는 ON DELETE CASCADE (B1_schema.sql)
 */
export async function deleteApplicationAction(
  applicationId: string,
  studentId: string
) {
  await verifyCenterSession();
  const supabase = await createCenterClient();

  await supabase
    .from("study_applications")
    .delete()
    .eq("id", applicationId);

  revalidatePath(`/center/students/${studentId}`);
}
