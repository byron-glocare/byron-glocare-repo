/**
 * 나이 요건 표시 문구 (어드민 — 한국어 전용).
 *
 *   모집요강 원문이 "만 N세"로 쓰기도, "YYYY년 이후 출생"으로 쓰기도 해서
 *   eligibility.age_requirement 는 둘 다 담는다(원문이 쓴 쪽만 채움).
 *   여기서는 채워진 쪽만 문장으로 만든다 — 임의 환산은 하지 않는다.
 *
 *   센터·학생 화면용 다국어판은 abroad 쪽 같은 이름 파일에 있다.
 */

export type AgeRequirementLike = {
  min_age?: number | null;
  max_age?: number | null;
  birth_date_from?: string | null;
  birth_date_to?: string | null;
  reference_date?: string | null;
  notes?: string | null;
};

/**
 * @returns 표시 문구. 요건이 하나도 없으면 null.
 *   notes 는 포함하지 않는다 — 별도 줄로 보여주는 편이 읽기 좋다.
 */
export function formatAgeRequirement(
  age: AgeRequirementLike | null | undefined
): string | null {
  if (!age) return null;

  const parts: string[] = [];

  const { min_age: min, max_age: max } = age;
  if (min != null && max != null) parts.push(`만 ${min}세 ~ ${max}세`);
  else if (min != null) parts.push(`만 ${min}세 이상`);
  else if (max != null) parts.push(`만 ${max}세 이하`);

  const { birth_date_from: from, birth_date_to: to } = age;
  if (from && to) parts.push(`${from} ~ ${to} 출생`);
  else if (from) parts.push(`${from} 이후 출생`);
  else if (to) parts.push(`${to} 이전 출생`);

  if (parts.length === 0) return null;

  const base = parts.join(" · ");
  return age.reference_date ? `${base} (${age.reference_date} 기준)` : base;
}
