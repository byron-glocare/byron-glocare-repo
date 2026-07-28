/**
 * 한국 비자(체류자격) 데이터 모델.
 *
 * 이 파일은 "형태"만 정의한다. 실제 내용(정본)은 src/data/visas.ts 로 들어가며,
 * 사용자가 docs/visa requirement 폴더에 넣는 자료를 파싱해 그 파일을 채운다.
 */

/** 대분류 — 조회 화면의 필터 칩으로 쓰인다. */
export type VisaCategory =
  | "유학·연수"
  | "취업"
  | "거주·동포"
  | "결혼이민"
  | "방문·단기"
  | "구직·기타";

export interface NationalityNote {
  /** 예: "베트남", "중국", "전체" */
  nationality: string;
  note: string;
}

export interface VisaType {
  /** 체류자격 기호. 예: "D-2", "E-7-2" */
  code: string;
  /** 한글 명칭. 예: "유학" */
  nameKo: string;
  /** 영문/국문 부가 명칭. 예: "Student" */
  nameEn?: string;
  category: VisaCategory;
  /** 카드에 보이는 한 줄 요약 */
  summary: string;
  /** 체류 목적 상세 */
  purpose: string;
  /** 자격 요건 (체크리스트) */
  eligibility: string[];
  /** 공통 제출 서류 */
  requiredDocuments: string[];
  /** 1회 부여 체류기간. 예: "2년" */
  duration: string;
  /** 연장 가능 여부 */
  extendable: boolean;
  /** 신청 절차 (순서) */
  procedure: string[];
  /** 취업활동 가능 범위 */
  workAllowed?: string;
  /** 수수료 */
  fee?: string;
  /** 유의사항 */
  notes?: string[];
  /** 국적별 특이사항 */
  nationalityNotes?: NationalityNote[];
  /** 출처(공식 링크/문서명) */
  source?: string;
  /** 데이터 기준일. 예: "2026-07" */
  updatedAt?: string;
}

export const CATEGORY_ORDER: VisaCategory[] = [
  "유학·연수",
  "취업",
  "거주·동포",
  "결혼이민",
  "방문·단기",
  "구직·기타",
];
