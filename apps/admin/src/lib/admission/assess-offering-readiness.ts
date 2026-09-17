/**
 * 모집(offering) 오픈 준비도 평가 게이트 (0067 학과 모델).
 *
 *   모집 단위 = (대학, 학과, 학기) = study_offerings 행. 대학당 요강은 1개(status <> archived)이고
 *   학과는 study_spec_departments, 학기 일정은 study_spec_terms 에 있다.
 *
 *   - blocking(게이트): 요강이 없거나, 학과가 요강에 없거나, 요강 학과가 비활성이면 오픈 불가.
 *   - warnings(경고): 학기 일정 없음(어학당은 schedule_language, 일반학과는 schedule) / 발급서류 항목 없음 / 현행 작성서류 양식 없음 / 학비 미입력 /
 *     요강 미승인. 오픈은 허용하되 운영자에게 미완료 항목을 알린다.
 *
 *   요강 연결(source_spec_id)은 대학의 유일한 요강이므로 여기서 찾아 돌려준다 — 호출부가 자동으로 건다.
 */

import "server-only";

import { createAdminClient } from "@/lib/supabase/server";
import { KIND_LABEL, type SpecDepartmentKind } from "./spec-departments";

export type ReadinessCheck = {
  key: string;
  label: string;
  ok: boolean;
  detail?: string;
};

export type OfferingReadiness =
  | { ok: false; blocked: true; reason: string; checks: ReadinessCheck[]; specId: string | null }
  | {
      ok: true;
      blocked: false;
      specId: string;
      specDepartmentId: string;
      checks: ReadinessCheck[];
      warnings: string[];
    };

type ScheduleJson = {
  rounds?: Array<Record<string, unknown>> | null;
  semester_start?: string | null;
};

function hasSchedule(schedule: unknown): boolean {
  const s = (schedule ?? {}) as ScheduleJson;
  if (s.semester_start) return true;
  if (!Array.isArray(s.rounds) || s.rounds.length === 0) return false;
  return s.rounds.some((r) => r && Object.values(r).some((v) => v != null && String(v).trim() !== ""));
}

function hasTuition(tuition: unknown): boolean {
  const t = (tuition ?? {}) as Record<string, unknown>;
  for (const v of Object.values(t)) {
    if (v == null) continue;
    if (typeof v === "number") return true;
    if (typeof v === "string" && v.trim() !== "") return true;
    if (Array.isArray(v) && v.length > 0) return true;
    if (typeof v === "object" && Object.keys(v as object).length > 0) return true;
  }
  return false;
}

export async function assessOfferingReadiness(
  universityId: number,
  departmentId: number,
  term: string
): Promise<OfferingReadiness> {
  const supabase = createAdminClient();

  // 1) 대학의 요강 (보관되지 않은 것 1개)
  const { data: spec } = await supabase
    .from("study_admission_specs")
    .select("id, status")
    .eq("university_id", universityId)
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!spec) {
    return {
      ok: false,
      blocked: true,
      specId: null,
      reason: "이 대학의 모집요강이 없습니다. 모집요강을 먼저 등록하세요.",
      checks: [{ key: "spec", label: "모집요강", ok: false }],
    };
  }

  // 2) 요강 학과
  const { data: specDept } = await supabase
    .from("study_spec_departments")
    .select("id, kind, is_active, tuition, departments(name_ko)")
    .eq("spec_id", spec.id)
    .eq("department_id", departmentId)
    .maybeSingle();
  const sd = specDept as unknown as
    | { id: string; kind: SpecDepartmentKind; is_active: boolean; tuition: unknown; departments: { name_ko: string } | null }
    | null;

  if (!sd) {
    return {
      ok: false,
      blocked: true,
      specId: spec.id,
      reason: "이 학과가 모집요강에 없습니다. 모집요강에서 학과를 추가한 뒤 오픈하세요.",
      checks: [
        { key: "spec", label: "모집요강", ok: true },
        { key: "spec_department", label: "요강 학과", ok: false, detail: "요강에 학과 없음" },
      ],
    };
  }
  if (!sd.is_active) {
    return {
      ok: false,
      blocked: true,
      specId: spec.id,
      reason: `요강에서 이 학과(${sd.departments?.name_ko ?? ""}, ${KIND_LABEL[sd.kind]})가 비활성입니다. 요강에서 학과를 활성화한 뒤 오픈하세요.`,
      checks: [
        { key: "spec", label: "모집요강", ok: true },
        { key: "spec_department", label: "요강 학과", ok: false, detail: "비활성 학과" },
      ],
    };
  }

  // 3) 경고 항목 — 학기 일정 / 발급서류 항목 / 현행 양식 / 학비
  const [{ data: termRow }, { count: docItemCount }, { count: formCount }] = await Promise.all([
    supabase.from("study_spec_terms").select("schedule, schedule_language").eq("spec_id", spec.id).eq("term", term).maybeSingle(),
    supabase
      .from("study_spec_doc_items")
      .select("id", { count: "exact", head: true })
      .eq("spec_department_id", sd.id),
    supabase
      .from("study_admission_form_files")
      .select("id", { count: "exact", head: true })
      .eq("spec_department_id", sd.id)
      .eq("is_current", true),
  ]);

  // 학기 일정은 학과 종류에 맞는 것을 본다 — 어학당은 schedule_language, 일반학과는 schedule (0068)
  const termSchedule = termRow ? (sd.kind === "language" ? termRow.schedule_language : termRow.schedule) : null;
  const scheduleOk = !!termRow && hasSchedule(termSchedule);
  const checks: ReadinessCheck[] = [
    { key: "spec", label: "모집요강", ok: true },
    { key: "spec_department", label: "요강 학과", ok: true },
    {
      key: "spec_status",
      label: "모집요강 승인",
      ok: spec.status === "approved",
      detail: spec.status === "approved" ? undefined : `현재 상태: ${spec.status}`,
    },
    {
      key: "schedule",
      label: `${term} 학기 ${KIND_LABEL[sd.kind]} 일정`,
      ok: scheduleOk,
      detail: !termRow ? "요강에 학기 없음" : scheduleOk ? undefined : "일정 미입력",
    },
    {
      key: "doc_items",
      label: "발급서류 항목",
      ok: (docItemCount ?? 0) > 0,
      detail: (docItemCount ?? 0) > 0 ? undefined : "학과에 발급서류 항목 없음",
    },
    {
      key: "forms",
      label: "작성서류 양식",
      ok: (formCount ?? 0) > 0,
      detail: (formCount ?? 0) > 0 ? undefined : "학과에 현행 양식 없음",
    },
    { key: "tuition", label: "학비 정보", ok: hasTuition(sd.tuition), detail: hasTuition(sd.tuition) ? undefined : "미입력" },
  ];

  const warnings = checks
    .filter((c) => !c.ok)
    .map((c) => (c.detail ? `${c.label} — ${c.detail}` : `${c.label} 미완료`));

  return { ok: true, blocked: false, specId: spec.id, specDepartmentId: sd.id, checks, warnings };
}
