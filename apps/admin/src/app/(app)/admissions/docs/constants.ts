/**
 * 제출서류 공용 상수 — 서버 액션과 클라이언트 화면이 같이 쓴다.
 *   "use server" 파일(actions.ts)은 async 함수만 내보낼 수 있어서(클라이언트가
 *   상수를 가져오면 빌드가 깨진다) 여기로 분리한다.
 */
export const BASE_NATIONALITY = "vn";

export const NOTARIZATIONS = [
  "none",
  "translation_notarization",
  "consul",
  "consul_for_vietnam",
  "apostille",
  "apostille_or_consul",
] as const;
