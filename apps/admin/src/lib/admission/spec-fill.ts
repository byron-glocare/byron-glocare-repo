/**
 * 모집요강(spec) → 학과 폼 자동채움 소스 (Flow A 보완).
 *
 *   ensure-records 는 "신규 학과만" 생성한다(기존은 skip). 이 헬퍼는 그 반대 —
 *   이미 존재하는 학과를 편집할 때, 해당 대학의 **최근 승인된 모집요강**에서
 *   이름이 일치하는 학과를 찾아 폼에 채울 값을 돌려준다.
 *   (운영자가 모집요강을 보고 손으로 입력하던 걸 1클릭으로.)
 *
 *   기준 spec = 가장 최근 승인본(approved_at desc). service role 사용(어드민 전용).
 */

import "server-only";

import { createAdminClient } from "@/lib/supabase/server";
import type { SpecDepartment } from "./ensure-records";

export type DepartmentSpecFill = {
  degree_years: number | null;
  tuition_ko: string | null;
  /** 출처 표시용 — 예: "2026-Spring · 학사" */
  sourceLabel: string;
};

function normalizeName(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

export async function getDepartmentSpecFill(
  universityId: number,
  departmentNameKo: string
): Promise<DepartmentSpecFill | null> {
  if (!departmentNameKo || !departmentNameKo.trim()) return null;

  const supabase = createAdminClient();
  const { data: specs } = await supabase
    .from("study_admission_specs")
    .select("departments, term, program_type, approved_at")
    .eq("university_id", universityId)
    .eq("status", "approved")
    .order("approved_at", { ascending: false })
    .limit(10);

  const target = normalizeName(departmentNameKo);

  for (const spec of specs ?? []) {
    const depts = (spec.departments as SpecDepartment[] | null) ?? [];
    const match = depts.find(
      (d) => d?.name && normalizeName(d.name) === target
    );
    if (!match) continue;

    const degree_years = typeof match.years === "number" ? match.years : null;
    const tuition_ko =
      typeof match.tuition_per_semester_krw === "number"
        ? `학기당 ${match.tuition_per_semester_krw.toLocaleString()}원`
        : null;

    // 둘 다 비어 있으면 채울 게 없으니 다음 spec 시도
    if (degree_years === null && tuition_ko === null) continue;

    const sourceLabel =
      [spec.term, spec.program_type].filter(Boolean).join(" · ") ||
      "승인된 모집요강";

    return { degree_years, tuition_ko, sourceLabel };
  }

  return null;
}
