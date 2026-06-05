/**
 * 지원 의향 상태 값 — 일반 모듈(상수/타입).
 *
 * "use server" 파일(actions.ts)에서는 async 함수 외의 값을 export 할 수 없어
 * (Next.js invalid-use-server-value), 상태 목록을 여기로 분리한다.
 * actions.ts 와 page.tsx 양쪽에서 import 한다.
 */

export const APP_STATUS_VALUES = [
  "preparing",
  "ready_for_review",
  "reviewing",
  "revisions_required",
  "submitted",
  "accepted",
  "rejected",
  "enrolled",
  "cancelled",
] as const;

export type ApplicationStatus = (typeof APP_STATUS_VALUES)[number];
