/**
 * U5: 모집(offering) 오픈(판매) 준비도 평가 + 승인 일관화 게이트.
 *
 *   플로우: 대학 → 모집요강(approved) → 일정/서류 → 오픈/판매(offering published).
 *   offering 을 published 로 올리기 전에 아래를 점검한다.
 *
 *   - blocking(게이트): 해당 대학·학기에 '승인된 모집요강'이 없으면 노출 불가.
 *     (= 승인 상태 일관화 — 노출되는 모집은 반드시 승인된 요강에 근거)
 *   - warnings(경고): 일정/학비 미입력, 직접작성 양식 미업로드, 발급서류 미등록.
 *     노출은 허용하되 운영자에게 미완료 항목을 알린다.
 *
 *   0056 이후: 한 대학·학기에 승인된 요강이 **여럿일 수 있다**
 *   (어학연수 D-4 / 학위과정이 공존). 그래서 "최신 것 하나"를 임의로 고르면
 *   학위 모집에 어학연수 요강이 조용히 걸릴 수 있다.
 *   → preferredSpecId 가 있으면 그것을, 없고 후보가 1건이면 그것을 쓰고,
 *     후보가 2건 이상인데 지정이 없으면 **막고 운영자에게 고르게** 한다.
 */

import "server-only";

import { createAdminClient } from "@/lib/supabase/server";
import {
  classifyRequiredDocs,
  type RequiredDoc,
} from "./classify-documents";
import { programTypeLabel } from "./program-type";

export type ReadinessCheck = {
  key: string;
  label: string;
  ok: boolean;
  detail?: string;
};

export type OfferingReadiness =
  | { ok: false; blocked: true; reason: string; checks: ReadinessCheck[] }
  | { ok: true; blocked: false; approvedSpecId: string; checks: ReadinessCheck[]; warnings: string[] };

type ApprovedSpecRow = {
  id: string;
  program_type: string;
  admission_category: string | null;
  required_documents: unknown;
  schedule: unknown;
  tuition: unknown;
};

export async function assessOfferingReadiness(
  universityId: number,
  term: string,
  /** 이 모집에 이미 연결돼 있거나 운영자가 고른 요강. 있으면 이것으로 평가한다. */
  preferredSpecId?: string | null
): Promise<OfferingReadiness> {
  const supabase = createAdminClient();

  // 1) 승인된 모집요강 (게이트)
  const { data: specs } = await supabase
    .from("study_admission_specs")
    .select(
      "id, status, program_type, admission_category, required_documents, schedule, tuition"
    )
    .eq("university_id", universityId)
    .eq("term", term)
    .eq("status", "approved")
    .order("updated_at", { ascending: false });

  const candidates = (specs ?? []) as ApprovedSpecRow[];

  if (candidates.length === 0) {
    return {
      ok: false,
      blocked: true,
      reason: `${term} 학기에 승인된 모집요강이 없습니다. 모집요강을 승인한 뒤 노출하세요.`,
      checks: [
        { key: "approved_spec", label: "승인된 모집요강", ok: false },
      ],
    };
  }

  // 어느 요강으로 평가할지 결정 — 임의로 최신 것을 고르지 않는다.
  const approved =
    (preferredSpecId
      ? candidates.find((c) => c.id === preferredSpecId)
      : undefined) ?? (candidates.length === 1 ? candidates[0] : undefined);

  if (!approved) {
    const list = candidates
      .map((c) => {
        const label = programTypeLabel(c.program_type);
        return c.admission_category ? `${label}(${c.admission_category})` : label;
      })
      .join(", ");
    return {
      ok: false,
      blocked: true,
      reason:
        `${term} 학기에 승인된 모집요강이 ${candidates.length}건입니다 (${list}). ` +
        `어느 요강으로 모집할지 이 모집의 '모집요강'에서 직접 선택한 뒤 노출하세요.`,
      checks: [
        {
          key: "approved_spec",
          label: "승인된 모집요강",
          ok: false,
          detail: `요강 ${candidates.length}건 — 직접 선택 필요`,
        },
      ],
    };
  }

  const { forms } = classifyRequiredDocs(
    (approved.required_documents as RequiredDoc[]) ?? []
  );

  // 2) 직접작성 양식 업로드 여부
  const { data: formFiles } = await supabase
    .from("study_admission_form_files")
    .select("key")
    .eq("university_id", universityId)
    .eq("is_current", true);
  const formKeys = new Set(
    (formFiles ?? []).map((f) => (f as { key: string }).key)
  );
  const missingForms = forms.filter((f) => !formKeys.has(f.key));

  // 발급서류는 모집요강 required_documents 로 통합됨(별도 마스터 없음) — 등록 체크 제거.

  // 3) 일정 / 4) 학비
  const schedule = (approved.schedule ?? {}) as {
    rounds?: Array<{ application_open?: string | null; document_submission_close?: string | null }>;
    semester_start?: string | null;
  };
  const hasSchedule =
    !!schedule.semester_start ||
    (Array.isArray(schedule.rounds) &&
      schedule.rounds.some(
        (r) => r?.application_open || r?.document_submission_close
      ));

  const tuition = (approved.tuition ?? {}) as {
    tuition_per_semester?: number | null;
    tuition_by_faculty?: Record<string, number>;
  };
  const hasTuition =
    tuition.tuition_per_semester != null ||
    (tuition.tuition_by_faculty &&
      Object.keys(tuition.tuition_by_faculty).length > 0);

  const checks: ReadinessCheck[] = [
    { key: "approved_spec", label: "승인된 모집요강", ok: true },
    {
      key: "forms",
      label: "직접작성 양식 업로드",
      ok: missingForms.length === 0,
      detail:
        missingForms.length > 0
          ? `미업로드: ${missingForms.map((f) => f.name_ko).join(", ")}`
          : undefined,
    },
    { key: "schedule", label: "모집 일정 입력", ok: !!hasSchedule },
    { key: "tuition", label: "학비 정보 입력", ok: !!hasTuition },
  ];

  const warnings = checks
    .filter((c) => !c.ok)
    .map((c) => (c.detail ? `${c.label} — ${c.detail}` : `${c.label} 미완료`));

  return {
    ok: true,
    blocked: false,
    approvedSpecId: approved.id,
    checks,
    warnings,
  };
}
