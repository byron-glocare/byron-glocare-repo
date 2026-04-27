/**
 * 베트남어 이름 → ASCII 영문 대문자.
 * 예: "Phạm Thị Dung" → "PHAM THI DUNG"
 *
 * 처리:
 *  1. Đ/đ 는 NFD 분해 안 되므로 명시적 D/d 변환
 *  2. NFD 정규화로 base char + diacritic 분리
 *  3. 결합문자 (combining marks) 제거
 *  4. 대문자화
 */
export function asciiUpper(s: string): string {
  if (!s) return "";
  // Đ/đ 는 NFD 로 분해되지 않음
  const replaced = s.replace(/Đ/g, "D").replace(/đ/g, "d");
  // base + combining 분리 → combining 제거 → 대문자화
  return replaced
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // combining diacritical marks
    .toUpperCase();
}
