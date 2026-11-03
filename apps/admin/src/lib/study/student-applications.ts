/**
 * 유학생 목록·목록 엑셀 공용 — 학생별 지원(취소 제외) 요약.
 *
 *   과정(D-2/D-4)은 지원한 요강 학과의 종류로 정한다: 어학당 = D-4(어학연수), 학과 = D-2(학위).
 *   학생의 '현재 비자'(study_managed_students.current_visa)와는 다르다 — 지금 D-4 로 어학연수 중인
 *   학생이 학과에 지원하면 과정은 D-2 다(2026-10-30 결정).
 *   학과 판별은 abroad 의 pickDepartment 와 같다: target_department_id 가 요강 학과에 있으면 그것,
 *   없으면(옛 지원) 첫 정규 학과, 그것도 없으면 어학당.
 *
 *   진행 중 판정(2026-11-03):
 *     지원 하나가 끝남 = 불합격·취소이거나, 어드민이 그 학기를 종료함(study_spec_terms.closed_at).
 *     날짜로 자동 종료하지 않는다 — 끝났는지는 사람이 정한다(/managed-students/terms).
 *     학생이 종료 = 어드민이 그 학생을 종료함(study_managed_students.closed_at), 또는 지원이 있고 모두 끝남.
 *     진행 중 = 종료가 아니고 끝나지 않은 지원이 하나라도 있음.
 *     아무 데도 지원하지 않은 학생은 종료는 아니지만 진행 중도 아니다.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import { termLabelKo } from "./term-label";

type Client = SupabaseClient<Database>;

export type Course = "D-2" | "D-4";

export type AppSummary = {
  appId: string;
  studentId: string;
  priority: number | null;
  universityId: number | null;
  university: string;
  dept: string;
  /** '2027-Spring' (필터 값) */
  term: string;
  /** '2027 봄' (화면 표시) */
  termLabel: string;
  course: Course | null;
  status: string;
  created: string;
  /** 불합격이거나 학기가 종료된 지원 */
  ended: boolean;
};

/** byStudent = 학생별 지원(취소 제외) · endedStudents = 직접 종료했거나 지원이 모두 끝난 학생 */
export type StudentAppIndex = {
  byStudent: Map<string, AppSummary[]>;
  endedStudents: Set<string>;
};

/** 진행 중 = 종료가 아니고 끝나지 않은 지원이 하나라도 있음 (지원이 없으면 진행 중이 아니다) */
export function isInProgress(id: string, index: StudentAppIndex): boolean {
  return !index.endedStudents.has(id) && (index.byStudent.get(id) ?? []).some((a) => !a.ended);
}

/** 지원 단계 한국어 라벨 — abroad 센터 화면(applications/status.ts)과 같은 말 */
export const APP_STATUS_KO: Record<string, string> = {
  payment_pending: "결제 전",
  preparing: "서류 작성 중",
  docs_complete: "서류 작성 완료",
  submitted: "대학교 제출 완료",
  enrolled: "입학",
  rejected: "불합격",
  cancelled: "중도 취소",
};

export async function loadStudentApplications(supabase: Client): Promise<StudentAppIndex> {
  const { data: apps } = await supabase
    .from("study_applications")
    .select("id, student_id, admission_spec_id, target_department_id, target_department_label, priority, term, status, created_at");
  const specIds = Array.from(new Set((apps ?? []).map((a) => a.admission_spec_id).filter((x): x is string => !!x)));

  const [{ data: specs }, { data: specDepts }, { data: specTerms }] =
    specIds.length > 0
      ? await Promise.all([
          supabase.from("study_admission_specs").select("id, university_id, term").in("id", specIds),
          supabase.from("study_spec_departments").select("spec_id, department_id, kind, sort_order").in("spec_id", specIds),
          supabase.from("study_spec_terms").select("spec_id, term, closed_at").in("spec_id", specIds),
        ])
      : [
          { data: [] as { id: string; university_id: number; term: string }[] },
          { data: [] as { spec_id: string; department_id: number | null; kind: string; sort_order: number | null }[] },
          { data: [] as { spec_id: string; term: string; closed_at: string | null }[] },
        ];
  const closedTerms = new Set(
    (specTerms ?? []).filter((t) => t.closed_at).map((t) => `${t.spec_id}::${t.term}`)
  );

  const uniIds = Array.from(new Set((specs ?? []).map((s) => s.university_id)));
  const { data: unis } =
    uniIds.length > 0
      ? await supabase.from("universities").select("id, name_ko").in("id", uniIds)
      : { data: [] as { id: number; name_ko: string }[] };

  const uniName = new Map((unis ?? []).map((u) => [u.id, u.name_ko]));
  const specById = new Map((specs ?? []).map((s) => [s.id, s]));
  const deptsBySpec = new Map<string, { department_id: number | null; kind: string; sort_order: number | null }[]>();
  for (const d of specDepts ?? []) {
    const list = deptsBySpec.get(d.spec_id) ?? [];
    list.push(d);
    deptsBySpec.set(d.spec_id, list);
  }

  const out = new Map<string, AppSummary[]>();
  const applied = new Set<string>();
  for (const a of apps ?? []) {
    applied.add(a.student_id);
    if (a.status === "cancelled") continue;
    const spec = a.admission_spec_id ? specById.get(a.admission_spec_id) : undefined;
    const rows = (a.admission_spec_id ? deptsBySpec.get(a.admission_spec_id) : undefined) ?? [];
    const dept =
      (a.target_department_id != null ? rows.find((d) => d.department_id === a.target_department_id) : undefined) ??
      rows.find((d) => d.kind === "regular") ??
      rows.find((d) => d.kind === "language");
    const term = a.term || spec?.term || "";
    const list = out.get(a.student_id) ?? [];
    list.push({
      appId: a.id,
      studentId: a.student_id,
      priority: a.priority ?? null,
      universityId: spec?.university_id ?? null,
      university: (spec ? uniName.get(spec.university_id) : null) ?? "대학 미정",
      dept: a.target_department_label ?? "",
      term,
      termLabel: termLabelKo(term),
      course: dept ? (dept.kind === "language" ? "D-4" : "D-2") : null,
      status: a.status,
      created: a.created_at,
      ended: a.status === "rejected" || closedTerms.has(`${a.admission_spec_id}::${term}`),
    });
    out.set(a.student_id, list);
  }
  for (const list of out.values())
    list.sort((x, y) => (x.priority ?? 99) - (y.priority ?? 99) || x.created.localeCompare(y.created));
  const { data: closedStudents } = await supabase
    .from("study_managed_students")
    .select("id")
    .not("closed_at", "is", null);
  const endedStudents = new Set([
    ...Array.from(applied).filter((id) => (out.get(id) ?? []).every((a) => a.ended)),
    ...(closedStudents ?? []).map((s) => s.id),
  ]);
  return { byStudent: out, endedStudents };
}

/** 대시보드·목록의 학생 단계 — 끝나지 않은 첫 지망의 상태. 지원이 없으면 '지원 전', 모두 끝났으면 '종료' */
export const STUDY_STAGE_ORDER = [
  "지원 전",
  APP_STATUS_KO.payment_pending,
  APP_STATUS_KO.preparing,
  APP_STATUS_KO.docs_complete,
  APP_STATUS_KO.submitted,
  APP_STATUS_KO.enrolled,
  "종료",
];

export function studentStage(id: string, index: StudentAppIndex): string {
  if (index.endedStudents.has(id)) return "종료";
  const first = (index.byStudent.get(id) ?? []).find((a) => !a.ended);
  return first ? APP_STATUS_KO[first.status] ?? first.status : "지원 전";
}

/** 목록 필터 — 지원 단위 조건(학기·대학·학과·과정)은 '같은 지원 하나'가 모두 맞아야 통과 */
export type AppFilter = { term?: string; university?: string; dept?: string; course?: string };

export function matchesAppFilter(apps: AppSummary[], f: AppFilter): boolean {
  if (!f.term && !f.university && !f.dept && !f.course) return true;
  return apps.some(
    (a) =>
      (!f.term || a.term === f.term) &&
      (!f.university || String(a.universityId ?? "") === f.university) &&
      (!f.dept || a.dept === f.dept) &&
      (!f.course || a.course === f.course)
  );
}

/** 유학생 목록 검색 조건 (URL 쿼리) — 목록 화면과 목록 엑셀이 같은 규칙을 쓴다 */
export type ListFilter = AppFilter & {
  q?: string;
  org?: string;
  loc?: string;
  /** 비어 있으면 진행 중만 · all = 전체 · inactive = 진행 중 아님(종료·미지원) */
  view?: string;
  stage?: string;
};

export function parseListFilter(sp: Record<string, string | string[] | undefined>): ListFilter {
  const v = (k: string) => {
    const x = sp[k];
    return (Array.isArray(x) ? x[0] : x ?? "").trim() || undefined;
  };
  return { q: v("q"), org: v("org"), loc: v("loc"), course: v("course"), term: v("term"), university: v("u"), dept: v("dept"), view: v("view"), stage: v("stage") };
}

/** 같은 조건을 다시 쿼리스트링으로 (엑셀 링크용) */
export function listFilterQuery(f: ListFilter): string {
  const qs = new URLSearchParams();
  const put = (k: string, x?: string) => x && qs.set(k, x);
  put("q", f.q);
  put("org", f.org);
  put("loc", f.loc);
  put("course", f.course);
  put("term", f.term);
  put("u", f.university);
  put("dept", f.dept);
  put("view", f.view);
  put("stage", f.stage);
  return qs.toString();
}

type StudentLite = {
  id: string;
  org_id: string | null;
  source: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  location: string | null;
};

/**
 * 유학센터 조건 'self' = 본사 직접(B2C).
 * 검색어가 있으면 진행 여부로 가리지 않는다 — 특정 학생을 찾는데 종료·미지원이라 안 나오면 없는 학생으로 오해한다.
 */
export function filterStudents<T extends StudentLite>(
  students: T[],
  f: ListFilter,
  index: StudentAppIndex
): T[] {
  const needle = (f.q ?? "").toLowerCase();
  return students.filter((s) => {
    if (needle && ![s.name, s.phone, s.email].filter(Boolean).join(" ").toLowerCase().includes(needle)) return false;
    if (f.org) {
      if (f.org === "self") {
        if (s.source !== "self") return false;
      } else if (String(s.org_id ?? "") !== f.org) return false;
    }
    if (f.loc && (s.location ?? "") !== f.loc) return false;
    // 단계를 고르면 그 단계가 곧 조건이다 — '종료' 단계를 골랐는데 보기 조건이 가리면 안 된다.
    if (f.stage) {
      if (studentStage(s.id, index) !== f.stage) return false;
    } else if (f.view === "inactive") {
      if (isInProgress(s.id, index)) return false;
    } else if (f.view !== "all" && !needle && !isInProgress(s.id, index)) {
      return false;
    }
    return matchesAppFilter(index.byStudent.get(s.id) ?? [], f);
  });
}
