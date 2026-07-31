/**
 * 유학생 비자 지원 프로세스 (흐름별 단계).
 * 근거: docs/visa requirement/유학생_비자_지원프로세스.xlsx
 *
 * 조회 조건(학위등급 × 어학등급 × 과정) → 조합(1~12) → 흐름(A~D / A'~D') → 단계별 프로세스.
 * (서로 다른 조회 조건 간 관계는 다루지 않고, 해당 조건의 흐름만 보여준다.)
 */
import type { Tier } from "./checklist";

export type Course = "univ" | "hagwon";
export type Track = "simplified" | "partial" | "full" | "blocked";

export const PROCESS_STEPS = [
  "사전 준비",
  "원서 접수",
  "평가·합격",
  "등록금 납부",
  "표준입학허가서",
  "사증발급인정서",
  "비자 신청",
  "비자 수령",
];

/** 트랙별 8단계 셀 텍스트("" = 해당 없음). */
const TRACK_STEPS: Record<Track, string[]> = {
  simplified: [
    "",
    "입학 서류 PDF 제출",
    "서류 및 면접 평가",
    "【대학】 Invoice 발행 / 【학생】 등록금 납부",
    "【대학】 표준입학허가서 발급 (이 흐름에선 비자에 사용 안 함)",
    "【학생】 원본 서류 발송 / 【대학】 사증발급인정서 신청 / 【출입국】 사증발급인정서 발급",
    "【학생】 간소화 서류 / 【대사관】 서류 중심 · 면접 없음",
    "개학 1주일 전",
  ],
  partial: [
    "",
    "입학 서류 PDF 제출",
    "서류 및 면접 평가",
    "【대학】 Invoice 발행 / 【학생】 등록금 납부",
    "【대학】 표준입학허가서 발급",
    "",
    "【학생】 일부 간소화 서류 / 【대사관】 서류 및 면접",
    "개학 1주일 전",
  ],
  full: [
    "예치금 준비 (원서 접수 전 · 최소 1개월 리드타임)",
    "입학 서류 PDF 제출",
    "서류 및 면접 평가",
    "【대학】 Invoice 발행 / 【학생】 등록금 납부",
    "【대학】 표준입학허가서 발급",
    "",
    "【학생】 전체 서류 / 【대사관】 서류 및 면접",
    "개학 1주일 전",
  ],
  blocked: ["", "", "", "", "", "", "", ""],
};

export const TRACK_META: Record<Track, { label: string; color: string }> = {
  simplified: { label: "간소화 트랙 · 사증발급인정서 경로", color: "var(--green)" },
  partial: { label: "표준 트랙 · 일부 간소화", color: "var(--blue)" },
  full: { label: "풀세트 트랙 · 예치금 준비", color: "var(--coral-d)" },
  blocked: { label: "발급 제한", color: "#b3261e" },
};

export interface FlowResult {
  key: string; // A / B / C / D / A' / B' / C' / D'
  track: Track;
  combo: number; // 1~12
  steps: string[];
  impossible?: boolean; // 제도상 발생 불가(일반×어학인증 등)
}

/** 학위등급 × 어학등급 → 조합 번호(1~12). */
export function comboOf(degreeTier: Tier, langTier: Tier): number {
  const d = degreeTier === "excellent" ? 0 : degreeTier === "certified" ? 1 : degreeTier === "restricted" ? 3 : 2;
  const l = langTier === "certified" ? 0 : langTier === "restricted" ? 2 : 1;
  return d * 3 + l + 1;
}

/** 조회 조건 → 흐름. */
export function flowOf(course: Course, degreeTier: Tier, langTier: Tier): FlowResult {
  const combo = comboOf(degreeTier, langTier);
  let key = "";
  let track: Track = "full";
  let impossible = false;

  if (course === "hagwon") {
    if ([1, 2].includes(combo)) { key = "A"; track = "simplified"; }
    else if (combo === 4) { key = "B"; track = "partial"; }
    else if ([5, 8, 11].includes(combo)) { key = "C"; track = "full"; }
    else if ([3, 6, 9, 12].includes(combo)) { key = "D"; track = "blocked"; }
    else { impossible = true; key = "—"; track = "blocked"; } // 7, 10
  } else {
    if ([1, 2, 3].includes(combo)) { key = "A'"; track = "simplified"; }
    else if ([4, 5, 6].includes(combo)) { key = "B'"; track = "partial"; }
    else if ([8, 9].includes(combo)) { key = "C'"; track = "full"; }
    else if ([11, 12].includes(combo)) { key = "D'"; track = "blocked"; }
    else { impossible = true; key = "—"; track = "blocked"; }
  }

  return { key, track, combo, steps: TRACK_STEPS[track], impossible };
}
