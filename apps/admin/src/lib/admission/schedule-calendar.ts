/**
 * 모집 일정 달력 데이터 — 승인된 모집요강의 학기 일정을 날짜 하나하나로 펼친다.
 *
 *   일정은 study_spec_terms 에 요강×학기 단위로 있다(정규과정=schedule, 어학당=schedule_language).
 *   같은 요강·학기의 정규 학과들은 일정을 공유하므로, 이벤트는 (학기 일정 × 과정 × 차수 × 단계) 로
 *   한 번만 만들고 그 일정을 쓰는 학과 항목들을 itemIds 로 단다 — 달력에 같은 날짜가 학과 수만큼
 *   복제되지 않게.
 *
 *   기간 값([시작, 끝])은 시작·마감 두 이벤트로 나눈다. 마감을 놓치지 않는 게 목적이라 끝 날짜가 중요하다.
 *   날짜는 'YYYY-MM-DD' 문자열(요강 스키마 isoDate) — 형식이 다르면 버린다.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import { termLabelKo } from "@/lib/study/term-label";

type Client = SupabaseClient<Database>;

/** 단계 — 달력 필터 두 번째 목록. 순서 = 전형 흐름 순 */
export const SCHEDULE_STAGES = [
  { key: "application_open", label: "원서 접수 시작" },
  { key: "application_close", label: "원서 마감" },
  { key: "document_submission_close", label: "서류 마감" },
  { key: "interview", label: "면접" },
  { key: "result_announcement", label: "합격 발표" },
  { key: "payment", label: "등록금 납부" },
  { key: "visa_certificate", label: "표준입학허가서 발급" },
  { key: "enrollment", label: "등록 기간" },
  { key: "orientation", label: "오리엔테이션" },
  { key: "semester_start", label: "개강" },
  { key: "semester_end", label: "종강" },
] as const;
export type StageKey = (typeof SCHEDULE_STAGES)[number]["key"];

/** 모집요강별 항목 — 달력 필터 첫 번째 목록 (대학-학과-학기) */
export type CalendarItem = {
  id: string;
  universityId: number;
  university: string;
  department: string;
  term: string;
  termLabel: string;
  isLanguage: boolean;
};

export type CalendarEvent = {
  id: string;
  date: string;
  stage: StageKey;
  /** 화면 문구 — "원서 마감", "등록금 납부 마감" 등 */
  label: string;
  /** 차수 이름 (1차 전형 등). 학기 공통 일정이면 null */
  round: string | null;
  time: string | null;
  specId: string;
  universityId: number;
  university: string;
  termLabel: string;
  isLanguage: boolean;
  /** 이 일정을 쓰는 항목(학과×학기) */
  itemIds: string[];
};


const ISO = /^\d{4}-\d{2}-\d{2}$/;
const isIso = (v: unknown): v is string => typeof v === "string" && ISO.test(v);

type Round = Record<string, unknown> & { name?: string };
type Schedule = Record<string, unknown> & { rounds?: Round[] };

export async function loadScheduleCalendar(supabase: Client): Promise<{
  items: CalendarItem[];
  events: CalendarEvent[];
}> {
  const { data: specs } = await supabase
    .from("study_admission_specs")
    .select("id, university_id")
    .eq("status", "approved");
  const specIds = (specs ?? []).map((s) => s.id);
  if (specIds.length === 0) return { items: [], events: [] };

  const uniIds = Array.from(new Set((specs ?? []).map((s) => s.university_id)));
  const [{ data: terms }, { data: depts }, { data: unis }] = await Promise.all([
    supabase.from("study_spec_terms").select("id, spec_id, term, schedule, schedule_language").in("spec_id", specIds),
    supabase
      .from("study_spec_departments")
      .select("id, spec_id, department_id, kind, sort_order")
      .in("spec_id", specIds)
      .eq("is_active", true),
    supabase.from("universities").select("id, name_ko").in("id", uniIds),
  ]);
  const deptIds = Array.from(new Set((depts ?? []).map((d) => d.department_id).filter((x): x is number => x != null)));
  const { data: deptNames } =
    deptIds.length > 0
      ? await supabase.from("departments").select("id, name_ko").in("id", deptIds)
      : { data: [] as { id: number; name_ko: string }[] };

  const uniName = new Map((unis ?? []).map((u) => [u.id, u.name_ko]));
  const deptName = new Map((deptNames ?? []).map((d) => [d.id, d.name_ko]));
  const specById = new Map((specs ?? []).map((s) => [s.id, s]));

  const items: CalendarItem[] = [];
  const events: CalendarEvent[] = [];

  for (const t of terms ?? []) {
    const spec = specById.get(t.spec_id);
    if (!spec) continue;
    const university = uniName.get(spec.university_id) ?? "대학";
    const termLabel = termLabelKo(t.term);
    const specDepts = (depts ?? [])
      .filter((d) => d.spec_id === t.spec_id)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

    for (const isLanguage of [false, true]) {
      const schedule = ((isLanguage ? t.schedule_language : t.schedule) ?? {}) as Schedule;
      const rows = specDepts.filter((d) => (d.kind === "language") === isLanguage);
      if (rows.length === 0) continue;

      const base = { specId: t.spec_id, universityId: spec.university_id, university, termLabel, isLanguage };
      const groupEvents: Omit<CalendarEvent, "itemIds">[] = [];
      const add = (stage: StageKey, label: string, date: unknown, round: string | null, idx: string, time: string | null = null) => {
        if (!isIso(date)) return;
        groupEvents.push({ ...base, id: `${t.id}:${isLanguage ? "L" : "R"}:${idx}:${label}`, date, stage, label, round, time });
      };
      const addRange = (stage: StageKey, name: string, v: unknown, round: string | null, idx: string) => {
        if (!Array.isArray(v)) return;
        const [from, to] = v as unknown[];
        if (isIso(from) && isIso(to) && from === to) return add(stage, name, from, round, idx);
        add(stage, `${name} 시작`, from, round, idx);
        add(stage, `${name} 마감`, to, round, idx);
      };

      (schedule.rounds ?? []).forEach((r, i) => {
        const round = typeof r.name === "string" && r.name.trim() ? r.name.trim() : `${i + 1}차`;
        const idx = `r${i}`;
        add("application_open", "원서 접수 시작", r.application_open, round, idx);
        add("application_close", "원서 마감", r.application_close, round, idx, typeof r.application_close_time === "string" ? r.application_close_time : null);
        add("document_submission_close", "서류 마감", r.document_submission_close, round, idx);
        add("interview", "면접", r.interview, round, idx);
        addRange("interview", "면접 기간", r.interview_period, round, idx);
        add("result_announcement", "합격 발표", r.result_announcement, round, idx);
        addRange("payment", "등록금 납부", r.payment_period, round, idx);
        addRange("visa_certificate", "표준입학허가서 발급", r.visa_certificate_issuance, round, idx);
      });
      addRange("enrollment", "등록 기간", schedule.main_enrollment_period, null, "s");
      addRange("enrollment", "추가 등록 기간", schedule.additional_enrollment_period, null, "s");
      add("orientation", "오리엔테이션", schedule.orientation, null, "s");
      add("semester_start", "개강", schedule.semester_start, null, "s");
      add("semester_end", "종강", schedule.semester_end, null, "s");

      if (groupEvents.length === 0) continue; // 일정이 비어 있는 학기·과정은 목록에도 안 올린다

      const itemIds = rows.map((d) => {
        const id = `${d.id}:${t.term}`;
        items.push({
          id,
          universityId: spec.university_id,
          university,
          department: (d.department_id != null ? deptName.get(d.department_id) : null) ?? (isLanguage ? "어학당" : "학과"),
          term: t.term,
          termLabel,
          isLanguage,
        });
        return id;
      });
      for (const e of groupEvents) events.push({ ...e, itemIds });
    }
  }

  items.sort(
    (a, b) =>
      a.university.localeCompare(b.university, "ko") ||
      b.term.localeCompare(a.term) ||
      Number(b.isLanguage) - Number(a.isLanguage) ||
      a.department.localeCompare(b.department, "ko")
  );
  events.sort((a, b) => a.date.localeCompare(b.date));
  return { items, events };
}
