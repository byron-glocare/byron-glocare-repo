/**
 * 모집요강(spec) → 대학교/학과 마스터 레코드 자동 생성 (Flow A).
 *
 *   "모집요강 우선" 워크플로: 요강을 업로드/승인하면 미등록 대학·학과를
 *   자동으로 생성하되 기본값 `active=false`(비노출)로 격리한다.
 *   - 정합성: 양식 override 가 department_name 문자열로 매칭되므로,
 *     요강의 학과명과 동일한 이름으로 학과 레코드를 만들어 일치시킨다.
 *   - 안전: 신규일 때만 생성. 기존 레코드는 절대 덮어쓰지 않음(skip).
 *
 *   service role 사용 (어드민 전용, RLS 우회).
 */

import "server-only";

import { createAdminClient } from "@/lib/supabase/server";
import type { TablesInsert } from "@/types/database";

export type SpecDepartment = {
  faculty?: string | null;
  name?: string;
  track?: string | null;
  years?: number | null;
  capacity?: number | string | null;
  korean_min_topik?: number | null;
  tuition_per_semester_krw?: number | null;
};

const PROGRAM_TYPE_LABEL: Record<string, string> = {
  language_program: "어학연수 (D-4)",
  associate_2yr: "전문학사 2년",
  bachelor_3yr_extension: "전공심화 (2+2)",
  bachelor_4yr: "학사 4년",
};

/** 이름 매칭용 정규화: 앞뒤 공백 제거 + 내부 공백 압축 + 소문자 */
function normalizeName(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

export type EnsureResult = {
  universityId: number;
  createdUniversity: boolean;
  /** 새로 생성한 학과명 (active=false) */
  createdDepartments: string[];
  /** 이미 존재해 건드리지 않은 학과명 */
  matchedDepartments: string[];
};

export async function ensureUniversityAndDepartments(opts: {
  /** 기존 대학 id (있으면 그대로 사용) */
  universityId?: number | null;
  /** id 가 없을 때 자동 생성할 신규 대학명 */
  newUniversityNameKo?: string | null;
  /** course 기본값 추론용 */
  programType?: string | null;
  /** spec.departments JSON */
  departments?: SpecDepartment[] | null;
}): Promise<
  { ok: true; result: EnsureResult } | { ok: false; error: string }
> {
  const supabase = createAdminClient();

  // 1) 대학 확정
  let universityId = opts.universityId ?? null;
  let createdUniversity = false;

  if (universityId == null) {
    const name = (opts.newUniversityNameKo ?? "").trim();
    if (!name) return { ok: false, error: "대학교가 지정되지 않았습니다" };

    // 동일 이름 기존 대학 있으면 재사용 (중복 생성 방지)
    const { data: existing } = await supabase
      .from("universities")
      .select("id, name_ko");
    const match = (existing ?? []).find(
      (u) => normalizeName(u.name_ko) === normalizeName(name)
    );
    if (match) {
      universityId = match.id;
    } else {
      const { data: created, error: uErr } = await supabase
        .from("universities")
        .insert({ name_ko: name, active: false })
        .select("id")
        .single();
      if (uErr || !created) {
        return {
          ok: false,
          error: `대학 자동 생성 실패: ${uErr?.message ?? "unknown"}`,
        };
      }
      universityId = created.id;
      createdUniversity = true;
    }
  }

  // 2) 학과 확정 (미등록만 active=false 생성)
  const createdDepartments: string[] = [];
  const matchedDepartments: string[] = [];

  const specDepts = (opts.departments ?? []).filter(
    (d): d is SpecDepartment & { name: string } =>
      !!d && typeof d.name === "string" && d.name.trim() !== ""
  );

  if (specDepts.length > 0) {
    const { data: existingDepts } = await supabase
      .from("departments")
      .select("id, name_ko, sort_order")
      .eq("university_id", universityId);
    const existingByName = new Set(
      (existingDepts ?? []).map((d) => normalizeName(d.name_ko))
    );
    let maxSort = (existingDepts ?? []).reduce(
      (m, d) => Math.max(m, d.sort_order ?? 0),
      0
    );

    const courseDefault = opts.programType
      ? PROGRAM_TYPE_LABEL[opts.programType] ?? null
      : null;

    const seen = new Set<string>();
    const toInsert: TablesInsert<"departments">[] = [];
    for (const d of specDepts) {
      const nname = normalizeName(d.name);
      if (existingByName.has(nname)) {
        matchedDepartments.push(d.name.trim());
        continue;
      }
      if (seen.has(nname)) continue; // spec 내부 중복 제거
      seen.add(nname);
      maxSort += 10;
      toInsert.push({
        university_id: universityId,
        name_ko: d.name.trim(),
        active: false,
        course: d.track ?? courseDefault,
        degree_years: typeof d.years === "number" ? d.years : null,
        tuition_ko:
          typeof d.tuition_per_semester_krw === "number"
            ? `학기당 ${d.tuition_per_semester_krw.toLocaleString()}원`
            : null,
        sort_order: maxSort,
      });
      createdDepartments.push(d.name.trim());
    }

    if (toInsert.length > 0) {
      const { error: dErr } = await supabase
        .from("departments")
        .insert(toInsert);
      if (dErr) {
        return { ok: false, error: `학과 자동 생성 실패: ${dErr.message}` };
      }
    }
  }

  return {
    ok: true,
    result: {
      universityId,
      createdUniversity,
      createdDepartments,
      matchedDepartments,
    },
  };
}
