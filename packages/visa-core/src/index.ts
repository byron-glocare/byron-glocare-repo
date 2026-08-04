/**
 * @glocare/visa-core — 비자 서류 조회의 공유 코어(데이터 + 로직 + 다국어 표시).
 * 소스 오브 트루스: apps/visa. 소비자(center/abroad)는 여기서 import.
 *
 * 앱별로 남기는 것(여기 없음): 저장 엔드포인트(/api/overrides), /edit 페이지,
 * EditToolbar, overrides.json/.vi.json(각 앱/DB 가 EditProvider 에 prop 주입).
 */
export * from "./data/engine";
export * from "./data/checklist";
export * from "./data/process";
export * from "./data/universities";
export * from "./data/i18n";
export * from "./edit/provider";
