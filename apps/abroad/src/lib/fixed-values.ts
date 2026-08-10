/**
 * 고정 입력값 — 학생·유학센터가 입력하지 않고 항상 같은 값이 들어가는 항목.
 *
 * 예) 추천인은 언제나 글로케어다. 사람이 칠 이유도 없고, 오타가 나면 서류만 틀어진다.
 * 그래서 정보입력 화면에서는 편집 대상에서 빼고, 값은 시딩이 항상 이 값으로 맞춘다.
 */

export const FIXED_STUDENT_VALUES: Record<string, string> = {
  /** 추천인 — 항상 글로케어 */
  agency_name: "글로케어",
};

export const FIXED_KEYS = Object.keys(FIXED_STUDENT_VALUES);

export function isFixedKey(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(FIXED_STUDENT_VALUES, key);
}
