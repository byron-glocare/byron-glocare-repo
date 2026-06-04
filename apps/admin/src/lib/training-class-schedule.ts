/**
 * 강의 일정 업데이트 상태 — derived 계산 (0017).
 *
 * 비즈니스 규칙:
 *  - 강의 정보는 교육원 단위로 관리 (training_centers.schedule_update_needed).
 *  - 교육생의 "강의 일정 업데이트 완료" 는 그 교육원 상태 + 미래 강의 존재
 *    여부 + 교육생 본인의 강의 지정 여부에서 자동 도출.
 *  - "미래 강의" 의 정의: 오늘(KST) + 10일 이후에 시작하는 강의 (start_date).
 *
 * 우선순위:
 *  1. 교육원 매칭 안 됨 → N/A (활용 불가)
 *  2. 교육생이 강의 지정됨 → 완료
 *  3. 교육원 수동 토글 ON → 필요
 *  4. 미래 강의 0개 → 필요
 *  5. 그 외 → 완료
 */

/** KST 기준 오늘 (YYYY-MM-DD) */
export function todayKstStr(override?: string): string {
  if (override) return override;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** YYYY-MM-DD 에 N일 더한 새 YYYY-MM-DD */
export function addDaysStr(dateStr: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) return dateStr;
  const d = new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]) + days
  );
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

/**
 * 교육원 단위 — 강의 일정 업데이트 필요 여부.
 * 사용자 수동 토글이 ON 이거나, 미래 강의가 하나도 없으면 필요.
 */
export function centerScheduleNeedsUpdate(args: {
  /** training_centers.schedule_update_needed */
  scheduleUpdateNeeded: boolean;
  /** today+10일 이후에 시작하는 강의가 1개라도 있나? */
  hasFutureClass: boolean;
}): boolean {
  if (args.scheduleUpdateNeeded) return true;
  if (!args.hasFutureClass) return true;
  return false;
}

/**
 * 교육원별 미래 강의 카운트 맵.
 * - cutoff = today + 10일
 * - start_date >= cutoff 인 강의만 카운트
 */
export function countFutureClassesByCenter(
  classes: { training_center_id: string; start_date: string | null }[],
  today?: string
): Map<string, number> {
  const cutoff = addDaysStr(todayKstStr(today), 10);
  const counts = new Map<string, number>();
  for (const cls of classes) {
    if (!cls.start_date) continue;
    if (cls.start_date < cutoff) continue;
    counts.set(
      cls.training_center_id,
      (counts.get(cls.training_center_id) ?? 0) + 1
    );
  }
  return counts;
}

/**
 * 교육생 단위 — "강의 일정 업데이트 완료" 상태.
 * - "ok"           = 완료 (강의 지정됐거나, 교육원이 일정 보유)
 * - "needs_update" = 필요 (교육원 매칭됐지만 강의 미지정 + 교육원 상태 NG)
 * - "na"           = 의미 없음 (교육원 미매칭)
 */
export function customerScheduleStatus(args: {
  trainingCenterId: string | null;
  trainingClassId: string | null;
  /** 그 교육원의 derived 상태 (centerScheduleNeedsUpdate 결과) */
  centerNeedsUpdate: boolean | null;
}): "ok" | "needs_update" | "na" {
  if (!args.trainingCenterId) return "na";
  if (args.trainingClassId) return "ok";
  if (args.centerNeedsUpdate === true) return "needs_update";
  return "ok";
}
