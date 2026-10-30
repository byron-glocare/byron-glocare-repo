const SEASON_KO: Record<string, string> = { Spring: "봄", Summer: "여름", Fall: "가을", Winter: "겨울", Year: "연중" };

/** 학기 값 화면 표시 — '2027-Spring' → '2027 봄' (형식이 다르면 그대로) */
export function termLabelKo(term: string | null | undefined): string {
  if (!term) return "";
  const [y, season] = term.split("-");
  return season ? `${y} ${SEASON_KO[season] ?? season}` : term;
}
