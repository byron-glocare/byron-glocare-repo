/**
 * 지망 순위 (0069) — study_applications.priority
 *   같은 학생 + 같은 학기 안에서 1~3 (1지망/2지망/3지망). 관리자 참고용, 워크플로 영향 없음.
 *   서버·클라이언트 공용 순수 함수만 둔다 (server action 은 priority-actions.ts).
 */

import { tr, type Locale } from "@/lib/i18n";

export const MAX_PRIORITY = 3;

/** "1지망" / "Nguyện vọng 1" */
export function priorityLabel(locale: Locale, priority: number): string {
  return tr(locale, `${priority}지망`, `Nguyện vọng ${priority}`);
}

/** 순위 배지 색 — 1지망을 가장 진하게 */
export function priorityTone(priority: number): string {
  switch (priority) {
    case 1:
      return "bg-slate-900 text-white";
    case 2:
      return "bg-slate-600 text-white";
    default:
      return "bg-slate-200 text-slate-700";
  }
}

/**
 * 학기(최신 먼저) → 순위(오름차순, 없으면 뒤) → 생성일(오래된 것 먼저) 순 정렬.
 *   학기가 없는 지원은 맨 뒤.
 */
export function compareByTermPriority(
  a: { term?: string | null; priority?: number | null; created_at?: string | null },
  b: { term?: string | null; priority?: number | null; created_at?: string | null }
): number {
  const ta = a.term ?? "";
  const tb = b.term ?? "";
  if (ta !== tb) {
    if (!ta) return 1;
    if (!tb) return -1;
    return tb.localeCompare(ta);
  }
  const pa = a.priority ?? Number.MAX_SAFE_INTEGER;
  const pb = b.priority ?? Number.MAX_SAFE_INTEGER;
  if (pa !== pb) return pa - pb;
  return (a.created_at ?? "").localeCompare(b.created_at ?? "");
}
