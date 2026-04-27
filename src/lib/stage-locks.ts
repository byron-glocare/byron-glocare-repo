/**
 * 진행 단계 종료 플래그에 따른 잠금 스코프 계산.
 *
 * 각 종료 플래그는 "속한 단계 + 이후 단계" 를 잠그며, 본인 스위치는
 * 풀린 상태 (OFF 로 해제 가능). termination_reason 은 전역 종료로
 * 모든 단계를 잠금.
 *
 * progress tab 내부와 기본 정보 탭 (요양원 section) 양쪽에서 공유.
 */

import type { CustomerStatus, ProductType } from "@/types/database";

export type LockStage =
  | "intake"
  | "training_reservation"
  | "training"
  | "employment"
  | "work";

export const LOCK_STAGE_ORDER: LockStage[] = [
  "intake",
  "training_reservation",
  "training",
  "employment",
  "work",
];

type FlagKey =
  | "intake_abandoned"
  | "study_abroad_consultation"
  | "training_reservation_abandoned"
  | "training_dropped"
  | "welcome_pack_abandoned";

const FLAG_STAGE: Record<FlagKey, LockStage> = {
  intake_abandoned: "intake",
  study_abroad_consultation: "intake",
  training_reservation_abandoned: "training_reservation",
  training_dropped: "training",
  welcome_pack_abandoned: "employment",
};

type LockInputs = {
  flags: Pick<
    CustomerStatus,
    | "intake_abandoned"
    | "study_abroad_consultation"
    | "training_reservation_abandoned"
    | "training_dropped"
    | "welcome_pack_abandoned"
  >;
  termination_reason: string | null;
  /** 상품 유형 — "웰컴팩" 단독이면 교육 예약 + 교육 단계는 대상 아님 */
  product_type?: ProductType | null;
};

export type LockResult = {
  lockedStages: Set<LockStage>;
  /** 잠금을 유발한 소스. "termination" / "welcome_pack_only" 는 정책 기반.
   *  FlagKey 이면 사용자가 ON 한 종료 플래그. */
  terminalSource: FlagKey | "termination" | "welcome_pack_only" | null;
};

export function computeLockedStages(inputs: LockInputs): LockResult {
  if (inputs.termination_reason) {
    return {
      lockedStages: new Set(LOCK_STAGE_ORDER),
      terminalSource: "termination",
    };
  }

  // 상품이 "웰컴팩" 단독이면 교육 예약 + 교육 단계는 거치지 않음
  // (교육+웰컴팩 은 정상 진행)
  const welcomePackOnly = inputs.product_type === "웰컴팩";

  const terminalsInOrder: FlagKey[] = [
    "intake_abandoned",
    "study_abroad_consultation",
    "training_reservation_abandoned",
    "training_dropped",
    "welcome_pack_abandoned",
  ];
  let earliestStageIdx = Infinity;
  let source: FlagKey | null = null;
  for (const f of terminalsInOrder) {
    if (inputs.flags[f]) {
      const idx = LOCK_STAGE_ORDER.indexOf(FLAG_STAGE[f]);
      if (idx < earliestStageIdx) {
        earliestStageIdx = idx;
        source = f;
      }
    }
  }

  // 종료 플래그 기반 잠금
  const lockedStages = new Set<LockStage>(
    source === null ? [] : LOCK_STAGE_ORDER.slice(earliestStageIdx)
  );

  // 웰컴팩 단독: 교육 예약 + 교육 추가 잠금 (그러나 취업/근무 는 풀림)
  if (welcomePackOnly) {
    lockedStages.add("training_reservation");
    lockedStages.add("training");
  }

  if (source !== null) {
    return { lockedStages, terminalSource: source };
  }
  if (welcomePackOnly) {
    return { lockedStages, terminalSource: "welcome_pack_only" };
  }
  return { lockedStages, terminalSource: null };
}

/** 기본 정보 탭의 요양원 섹션이 잠겨야 하는지 — employment 이상 잠기면 true. */
export function isCareHomeSectionLocked(inputs: LockInputs): boolean {
  const { lockedStages } = computeLockedStages(inputs);
  return lockedStages.has("employment") || lockedStages.has("work");
}
