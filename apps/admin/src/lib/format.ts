/**
 * 표시용 포맷 헬퍼 — 절대 데이터 가공 로직에 쓰지 말 것 (UI 전용).
 * 날짜는 KST(Asia/Seoul) 기준으로 표기. Vercel UTC 서버에서 안전.
 */

export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("ko-KR");
}

export function formatCurrency(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `${n.toLocaleString("ko-KR")}원`;
}

export function formatDate(s: string | null | undefined): string {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;

  // timestamptz / ISO 가 들어오면 KST 로 변환해서 날짜만 추출
  // "YYYY-MM-DD" date type 은 UTC 자정으로 해석되지만 KST 변환 후에도 같은 날짜.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function formatDateTime(s: string | null | undefined): string {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "—" 표시. 빈 문자열·null·undefined 모두 처리. */
export function dash(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string" && v.trim() === "") return "—";
  return String(v);
}
