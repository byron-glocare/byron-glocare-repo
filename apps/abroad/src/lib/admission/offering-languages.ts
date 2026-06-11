/**
 * 모집(offering)의 "제공 언어"를 모집요강(spec) eligibility 에서 도출.
 *
 *   운영자 결정: 언어는 offering 큐레이션에서 따로 입력하지 않는다.
 *   모집요강에 이미 결정돼 있으므로(자격요건) 그걸 그대로 쓴다.
 *     - 한국어: korean_proficiency(TOPIK 요구)가 있으면 (사실상 항상)
 *     - 영어:   english_proficiency 가 있고, 해당 학과가 영어트랙 대상이면
 *   "기타"는 모집요강에 구조화돼 있지 않아 도출 대상 아님(필요 시 추후).
 */

import type { OfferingLanguage } from "@/types/study";

type EnglishProficiency = {
  applies_to_departments?: string[];
  minimums?: Record<string, unknown>;
};

/**
 * @param eligibility spec.eligibility (JSONB — 느슨하게 받아 내부에서 narrow)
 * @param departmentName 이 모집의 학과명 (영어트랙 대상 매칭용; 없으면 전체 대상으로 간주)
 * @returns 제공 언어 목록 (최소 한국어 1개)
 */
export function deriveOfferingLanguages(
  eligibility: unknown,
  departmentName?: string | null
): OfferingLanguage[] {
  const langs: OfferingLanguage[] = ["korean"]; // 한국 대학 — 기본 한국어

  const elig =
    eligibility && typeof eligibility === "object"
      ? (eligibility as { english_proficiency?: EnglishProficiency | null })
      : null;
  const eng = elig?.english_proficiency;
  if (eng) {
    const scope = eng.applies_to_departments;
    // applies_to_departments 가 비었으면 전체 학과 대상으로 간주.
    // 값이 있으면 학과명이 포함될 때만 영어 제공.
    const englishApplies =
      !scope ||
      scope.length === 0 ||
      (departmentName != null &&
        scope.some(
          (d) =>
            d &&
            (d.includes(departmentName) || departmentName.includes(d))
        ));
    if (englishApplies) langs.push("english");
  }

  return langs;
}

/** 학생의 현재 location → 거주지(서류분기) 코드. KR=국내(domestic), 그 외=해외(overseas) */
export function residenceFromStudentLocation(
  location: string | null | undefined
): "domestic" | "overseas" {
  return location === "KR" ? "domestic" : "overseas";
}
