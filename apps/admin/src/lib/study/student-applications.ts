/**
 * 유학생 목록·목록 엑셀 공용 — 학생별 지원(취소 제외) 요약.
 *
 *   과정(D-2/D-4)은 지원한 요강 학과의 종류로 정한다: 어학당 = D-4(어학연수), 학과 = D-2(학위).
 *   학생의 '현재 비자'(study_managed_students.current_visa)와는 다르다 — 지금 D-4 로 어학연수 중인
 *   학생이 학과에 지원하면 과정은 D-2 다(2026-10-30 결정).
 *   학과 판별은 abroad 의 pickDepartment 와 같다: target_department_id 가 요강 학과에 있으면 그것,
 *   없으면(옛 지원) 첫 정규 학과, 그것도 없으면 어학당.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import { termLabelKo } from "./term-label";

type Client = SupabaseClient<Database>;

export type Course = "D-2" | "D-4";

export type AppSummary = {
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
};

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

export async function loadStudentApplications(supabase: Client): Promise<Map<string, AppSummary[]>> {
  const { data: apps } = await supabase
    .from("study_applications")
    .select("student_id, admission_spec_id, target_department_id, target_department_label, priority, term, status, created_at")
    .neq("status", "cancelled");
  const specIds = Array.from(new Set((apps ?? []).map((a) => a.admission_spec_id).filter((x): x is string => !!x)));

  const [{ data: specs }, { data: specDepts }] =
    specIds.length > 0
      ? await Promise.all([
          supabase.from("study_admission_specs").select("id, university_id, term").in("id", specIds),
          supabase.from("study_spec_departments").select("spec_id, department_id, kind, sort_order").in("spec_id", specIds),
        ])
      : [{ data: [] as { id: string; university_id: number; term: string }[] }, { data: [] as { spec_id: string; department_id: number | null; kind: string; sort_order: number | null }[] }];

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
  for (const a of apps ?? []) {
    const spec = a.admission_spec_id ? specById.get(a.admission_spec_id) : undefined;
    const rows = (a.admission_spec_id ? deptsBySpec.get(a.admission_spec_id) : undefined) ?? [];
    const dept =
      (a.target_department_id != null ? rows.find((d) => d.department_id === a.target_department_id) : undefined) ??
      rows.find((d) => d.kind === "regular") ??
      rows.find((d) => d.kind === "language");
    const term = a.term || spec?.term || "";
    const list = out.get(a.student_id) ?? [];
    list.push({
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
    });
    out.set(a.student_id, list);
  }
  for (const list of out.values())
    list.sort((x, y) => (x.priority ?? 99) - (y.priority ?? 99) || x.created.localeCompare(y.created));
  return out;
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
export type ListFilter = AppFilter & { q?: string; org?: string; loc?: string };

export function parseListFilter(sp: Record<string, string | string[] | undefined>): ListFilter {
  const v = (k: string) => {
    const x = sp[k];
    return (Array.isArray(x) ? x[0] : x ?? "").trim() || undefined;
  };
  return { q: v("q"), org: v("org"), loc: v("loc"), course: v("course"), term: v("term"), university: v("u"), dept: v("dept") };
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

/** 유학센터 조건 'self' = 본사 직접(B2C) */
export function filterStudents<T extends StudentLite>(
  students: T[],
  f: ListFilter,
  appsByStudent: Map<string, AppSummary[]>
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
    return matchesAppFilter(appsByStudent.get(s.id) ?? [], f);
  });
}
