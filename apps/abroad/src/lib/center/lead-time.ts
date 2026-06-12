/**
 * 6단계 — 리드타임 역산 얼럿 (C_CORE_WORKFLOW_REDESIGN.md §1-6).
 *
 *   직접제출 서류(study_required_submissions)는 발급 소요기간(issuance_requirements.lead_time_days)이
 *   있다. 학생 지원의 마감(application.next_deadline)에서 **역산**해, "지금 발급을 시작하지 않으면
 *   마감에 못 맞추는(또는 이미 늦은)" 서류가 있는 학생을 산출한다.
 *
 *   웹 = 센터 대시보드 카운트 + /center/alerts 리스트. (문자·이메일·푸시 아님.)
 *
 *   ⚠ 한계(v1): 학생이 특정 서류를 이미 발급받았는지 추적하는 테이블이 없으므로,
 *      "착수 시점 도래" 기준으로만 얼럿한다(독촉용). next_deadline 미설정 지원은 제외.
 */

import type { createCenterClient } from "@/lib/supabase/center";
import { residenceFromStudentLocation } from "@/lib/admission/offering-languages";

type CenterClient = Awaited<ReturnType<typeof createCenterClient>>;

/** 서류 준비 착수가 필요한(또는 늦은) 지원 1건 */
export type LeadTimeFlag = {
  applicationId: string;
  studentId: string;
  studentName: string;
  universityNameKo: string | null;
  deadline: string; // 'YYYY-MM-DD'
  daysUntilDeadline: number; // 음수 = 마감 지남
  /** 지금 착수해야 하는(start_by 도래) 서류들 */
  documents: Array<{
    nameKo: string;
    leadTimeDays: number;
    startBy: string; // 'YYYY-MM-DD'
    pastDeadline: boolean;
  }>;
};

const PRE_SUBMISSION_STATUSES = ["payment_pending", "preparing"];

const MS_PER_DAY = 86_400_000;

function toMidnight(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * 본인 org(RLS) 범위에서 리드타임 얼럿 대상 지원 목록을 계산한다.
 *   정렬: 가장 급한 것(마감까지 일수 오름차순) 먼저.
 */
export async function computeLeadTimeFlags(
  supabase: CenterClient
): Promise<LeadTimeFlag[]> {
  // 1. 제출 전 단계 + 마감 설정된 지원
  const { data: appsRaw } = await supabase
    .from("study_applications")
    .select(
      "id, student_id, admission_spec_id, target_department_id, next_deadline, status, selected_language"
    );
  const apps = (appsRaw ?? []).filter(
    (a) =>
      a.next_deadline &&
      PRE_SUBMISSION_STATUSES.includes(a.status as string)
  );
  if (apps.length === 0) return [];

  // 2. 부속 데이터 병렬 로드
  const specIds = Array.from(new Set(apps.map((a) => a.admission_spec_id)));
  const studentIds = Array.from(new Set(apps.map((a) => a.student_id)));

  const [{ data: specs }, { data: students }, { data: submissions }] =
    await Promise.all([
      supabase
        .from("study_admission_specs")
        .select("id, university_id")
        .in("id", specIds),
      supabase
        .from("study_managed_students")
        .select("id, name, location")
        .in("id", studentIds),
      // 직접제출 서류 (RLS = approved + is_active). 공용(university_id=null) 포함.
      supabase
        .from("study_required_submissions")
        .select(
          "university_id, department_id, name_ko, issuance_requirements, applies_to_languages, applies_to_locations"
        ),
    ]);

  const specUni = new Map(
    (specs ?? []).map((s) => [s.id, s.university_id as number])
  );
  const studentName = new Map((students ?? []).map((s) => [s.id, s.name]));
  // 학생 거주지(국내/해외) = location 속성 그대로 (offering·지원에서 따로 안 물음)
  const studentResidence = new Map(
    (students ?? []).map((s) => [
      s.id,
      residenceFromStudentLocation(s.location as string | null),
    ])
  );

  // 대학명
  const uniIds = Array.from(
    new Set(Array.from(specUni.values()).filter((v): v is number => v != null))
  );
  const { data: universities } =
    uniIds.length > 0
      ? await supabase
          .from("universities")
          .select("id, name_ko")
          .in("id", uniIds)
      : { data: [] as Array<{ id: number; name_ko: string }> };
  const uniName = new Map((universities ?? []).map((u) => [u.id, u.name_ko]));

  const subs = (submissions ?? []).filter((s) => {
    const lt = (s.issuance_requirements as { lead_time_days?: number } | null)
      ?.lead_time_days;
    return typeof lt === "number" && lt > 0;
  });

  const today = toMidnight(new Date());

  const flags: LeadTimeFlag[] = [];

  for (const a of apps) {
    const uniId = specUni.get(a.admission_spec_id) ?? null;
    const deadline = toMidnight(new Date(`${a.next_deadline}T00:00:00`));
    if (Number.isNaN(deadline.getTime())) continue;
    const daysUntilDeadline = Math.round(
      (deadline.getTime() - today.getTime()) / MS_PER_DAY
    );

    // 이 지원에 해당하는 직접제출 서류
    //   (공용 + 대학 일치) ∩ (학과 무관 + 학과 일치) ∩ (언어/거주지 분기)
    const applicable = subs.filter((s) => {
      const uniMatch = s.university_id == null || s.university_id === uniId;
      const deptMatch =
        s.department_id == null || s.department_id === a.target_department_id;
      const langs = (s.applies_to_languages ?? []) as string[];
      const locs = (s.applies_to_locations ?? []) as string[];
      // 언어 분기: 학생 선택 언어. 거주지 분기: 학생 location(국내/해외).
      const residence = studentResidence.get(a.student_id) ?? null;
      const langMatch =
        langs.length === 0 ||
        (a.selected_language != null && langs.includes(a.selected_language));
      const locMatch =
        locs.length === 0 || (residence != null && locs.includes(residence));
      return uniMatch && deptMatch && langMatch && locMatch;
    });

    const documents: LeadTimeFlag["documents"] = [];
    for (const s of applicable) {
      const lead =
        (s.issuance_requirements as { lead_time_days?: number }).lead_time_days!;
      const startBy = new Date(deadline);
      startBy.setDate(startBy.getDate() - lead);
      // 착수 시점 도래(오늘이 start_by 이상)한 서류만 얼럿
      if (today.getTime() >= toMidnight(startBy).getTime()) {
        documents.push({
          nameKo: s.name_ko,
          leadTimeDays: lead,
          startBy: isoDate(startBy),
          pastDeadline: daysUntilDeadline < 0,
        });
      }
    }

    if (documents.length === 0) continue;
    documents.sort((x, y) => y.leadTimeDays - x.leadTimeDays);

    flags.push({
      applicationId: a.id,
      studentId: a.student_id,
      studentName: studentName.get(a.student_id) ?? "—",
      universityNameKo: uniId != null ? uniName.get(uniId) ?? null : null,
      deadline: a.next_deadline as string,
      daysUntilDeadline,
      documents,
    });
  }

  flags.sort((a, b) => a.daysUntilDeadline - b.daysUntilDeadline);
  return flags;
}
