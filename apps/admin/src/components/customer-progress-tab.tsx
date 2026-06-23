"use client";

import {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  useTransition,
  type Ref,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2, Lock, Save, Undo2, X } from "lucide-react";

import { updateProgressState } from "@/app/(app)/customers/actions";
import { navigateBackOrTo } from "@/lib/navigate-back";
import {
  computeCustomerStatus,
  type StatusInputs,
} from "@/lib/customer-status";
import {
  computeLockedStages as computeLockedStagesShared,
  type LockStage,
} from "@/lib/stage-locks";
import type {
  ProgressStateInput,
  StatusFlagsInput,
} from "@/lib/validators";
import type { CustomerReminder } from "@/types/database";
import { CustomerRemindersPanel } from "@/components/customer-reminders-panel";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValueMap,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// =============================================================================
// Props / 상태 모델
// =============================================================================

export type CustomerProgressTabHandle = {
  submit: () => Promise<{ ok: boolean; error?: string }>;
  reset: () => void;
};

type Props = {
  customerId: string;
  inputs: StatusInputs;
  /** 챙길 일정 — 페이지 (server) 에서 fetch 해서 전달, 자체 액션으로 즉시 저장 */
  reminders?: CustomerReminder[];
  /** 페이지 통합 저장 모드 — 내부 저장/되돌리기 버튼 숨김 */
  embedded?: boolean;
  ref?: Ref<CustomerProgressTabHandle>;
  onDirtyChange?: (dirty: boolean) => void;
};

type FlagKey = keyof StatusFlagsInput;

/**
 * 수동 플래그 카테고리.
 * - blocker : ON = "아직 해야 할 일" (amber)
 * - milestone: ON = "완료" (초록), 쌍(X/O) 토글 UI
 * - terminal : ON = "해당 단계 종결" (red thumb)
 */
type FlagCategory = "blocker" | "milestone" | "terminal";

const CATEGORY: Record<FlagKey, FlagCategory> = {
  intake_abandoned: "terminal",
  intake_confirmed: "milestone",
  study_abroad_consultation: "terminal",
  training_center_finding: "blocker",
  class_schedule_confirmation_needed: "blocker",
  training_reservation_abandoned: "terminal",
  class_intake_sms_sent: "milestone",
  certificate_acquired: "milestone",
  training_dropped: "terminal",
  welcome_pack_abandoned: "terminal",
  health_check_completed: "milestone",
  care_home_finding: "blocker",
  resume_sent: "milestone",
  interview_passed: "milestone",
};

const FLAG_LABELS: Record<FlagKey, string> = {
  intake_abandoned: "접수포기",
  intake_confirmed: "등록",
  study_abroad_consultation: "유학상담으로 전환",
  training_center_finding: "교육원 발굴 필요",
  class_schedule_confirmation_needed: "강의 일정 확인 필요",
  training_reservation_abandoned: "교육 예약포기",
  class_intake_sms_sent: "강의 접수 메시지 발송",
  certificate_acquired: "자격증 취득",
  training_dropped: "교육 드랍",
  welcome_pack_abandoned: "웰컴팩 예약포기",
  health_check_completed: "건강검진 완료",
  care_home_finding: "요양원 발굴 필요",
  resume_sent: "이력서 발송",
  interview_passed: "면접 합격",
};

const FLAG_HINTS: Partial<Record<FlagKey, string>> = {
  training_center_finding: "매칭 시 자동 해제",
  class_schedule_confirmation_needed: "교육원 확인 필요",
  care_home_finding: "매칭 시 자동 해제",
  intake_abandoned: "이후 단계 잠금",
  study_abroad_consultation: "유학 전환",
  training_reservation_abandoned: "이후 단계 잠금",
  training_dropped: "교육 중 이탈",
  welcome_pack_abandoned: "취업 종결",
  resume_sent: "요양원 이력서",
};

/**
 * 각 수동 플래그가 속한 단계. UI 에서 `isFlagLocked` 계산 시 사용.
 * 잠금 로직 자체는 src/lib/stage-locks.ts 에서 공유.
 */
type StageKey = LockStage;

const FLAG_STAGE: Record<FlagKey, StageKey> = {
  intake_abandoned: "intake",
  intake_confirmed: "intake",
  study_abroad_consultation: "intake",
  training_center_finding: "training_reservation",
  class_schedule_confirmation_needed: "training_reservation",
  training_reservation_abandoned: "training_reservation",
  class_intake_sms_sent: "training_reservation",
  certificate_acquired: "training",
  training_dropped: "training",
  care_home_finding: "employment",
  resume_sent: "employment",
  interview_passed: "employment",
  welcome_pack_abandoned: "employment",
  health_check_completed: "employment",
};

function computeLockedStages(
  state: ProgressStateInput,
  productType: import("@/types/database").ProductType | null
) {
  return computeLockedStagesShared({
    flags: state.flags,
    termination_reason: state.termination_reason,
    product_type: productType,
  });
}

// =============================================================================
// 메인
// =============================================================================

function buildInitialState(inputs: StatusInputs): ProgressStateInput {
  return {
    flags: {
      intake_abandoned: inputs.status.intake_abandoned,
      intake_confirmed: inputs.status.intake_confirmed,
      study_abroad_consultation: inputs.status.study_abroad_consultation,
      training_center_finding: inputs.status.training_center_finding,
      class_schedule_confirmation_needed:
        inputs.status.class_schedule_confirmation_needed,
      training_reservation_abandoned:
        inputs.status.training_reservation_abandoned,
      class_intake_sms_sent: inputs.status.class_intake_sms_sent,
      certificate_acquired: inputs.status.certificate_acquired,
      training_dropped: inputs.status.training_dropped,
      welcome_pack_abandoned: inputs.status.welcome_pack_abandoned,
      health_check_completed: inputs.status.health_check_completed,
      care_home_finding: inputs.status.care_home_finding,
      resume_sent: inputs.status.resume_sent,
      interview_passed: inputs.status.interview_passed,
    },
    termination_reason:
      (inputs.customer.termination_reason as
        | "요양보호사 직종변경"
        | "귀국"
        | "연락두절"
        | null) ?? null,
    is_waiting: inputs.customer.is_waiting,
    recontact_date: inputs.customer.recontact_date ?? null,
    waiting_memo: inputs.customer.waiting_memo ?? null,
  };
}

export function CustomerProgressTab({
  customerId,
  inputs,
  reminders = [],
  embedded = false,
  ref,
  onDirtyChange,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // 초기 (DB 기준) state — 저장 후 이 값으로 갱신
  const initialRef = useRef<ProgressStateInput>(buildInitialState(inputs));
  const [state, setState] = useState<ProgressStateInput>(() => initialRef.current);

  const dirty = useMemo(
    () => JSON.stringify(state) !== JSON.stringify(initialRef.current),
    [state]
  );

  // dirty 변경을 부모에게 알림 (embedded 전용)
  useEffect(() => {
    if (embedded) onDirtyChange?.(dirty);
  }, [embedded, dirty, onDirtyChange]);

  // imperative API
  useImperativeHandle(
    ref,
    () => ({
      submit: async () => {
        const snapshot = state;
        const result = await updateProgressState(customerId, snapshot);
        if (result.ok) {
          initialRef.current = snapshot; // dirty 초기화
        }
        return result.ok ? { ok: true } : { ok: false, error: result.error };
      },
      reset: () => {
        setState(initialRef.current);
      },
    }),
    [ref, state, customerId]
  );

  // 단계별 잠금 스코프 — 종료 플래그가 ON 이면 해당 단계 + 하위 잠금,
  // 상품이 "웰컴팩" 단독이면 교육 예약 + 교육 추가 잠금.
  const productType = inputs.customer.product_type ?? null;
  const { lockedStages, terminalSource } = useMemo(
    () => computeLockedStages(state, productType),
    [state, productType]
  );

  /** 개별 플래그가 잠겼는지. 본인이 ON 된 terminal 인 경우는 풀림 (OFF 가능). */
  const isFlagLocked = (key: FlagKey): boolean => {
    // 켜져 있는 terminal 본인은 항상 편집 가능
    if (terminalSource === key) return false;
    return lockedStages.has(FLAG_STAGE[key]);
  };

  /**
   * 단계 카드가 회색 tint 되는 조건 — lockedStages 포함된 단계 전부.
   * 카드 안에 편집 가능한 스위치 (예: 웰컴팩 예약포기 스위치 자신) 가
   * 살아있어도 카드 자체는 tint 해서 "이 단계가 종결됨" 을 시각적으로 표시.
   * Tint 는 opacity 만 낮추므로 실제 클릭은 그대로 가능.
   */
  const isStageCardLocked = (stage: StageKey): boolean => lockedStages.has(stage);

  // 근무 카드는 termination_reason dropdown 을 포함. dropdown 은 항상 편집 가능.
  // termination_reason 이 set 된 경우 근무 카드는 "전역 종료" 상태라서 tint O.
  const isWorkCardLocked = lockedStages.has("work");
  // 대기 잠금 — 최종 종료(termination_reason) 때만.
  const waitingLocked = terminalSource === "termination";

  const summary = computeCustomerStatus({
    ...inputs,
    customer: {
      ...inputs.customer,
      termination_reason: state.termination_reason,
      is_waiting: state.is_waiting,
    },
    status: { ...inputs.status, ...state.flags },
  });

  /** 수동 플래그 토글 — 로컬 state 만 업데이트. 저장은 저장 버튼으로. */
  function toggleFlag(key: FlagKey, value: boolean) {
    if (isFlagLocked(key)) return;
    setState((prev) => ({
      ...prev,
      flags: { ...prev.flags, [key]: value },
    }));
  }

  /**
   * 접수 "등록" 결정 — intake_confirmed / intake_abandoned 두 boolean 을
   * mutually exclusive 로 set. UI 의 3-state (예/아니오/미선택) 표현.
   */
  function setIntakeDecision(decision: "yes" | "no" | "none") {
    setState((prev) => ({
      ...prev,
      flags: {
        ...prev.flags,
        intake_confirmed: decision === "yes",
        intake_abandoned: decision === "no",
      },
    }));
  }

  function setTerminationReason(
    value: "요양보호사 직종변경" | "귀국" | "연락두절" | null
  ) {
    setState((prev) => ({ ...prev, termination_reason: value }));
  }

  function setWaiting(value: boolean) {
    if (waitingLocked) return;
    setState((prev) => ({
      ...prev,
      is_waiting: value,
      recontact_date: value ? prev.recontact_date : null,
      waiting_memo: value ? prev.waiting_memo : null,
    }));
  }

  function setRecontactDate(value: string) {
    setState((prev) => ({ ...prev, recontact_date: value || null }));
  }

  function setWaitingMemo(value: string) {
    setState((prev) => ({ ...prev, waiting_memo: value || null }));
  }

  function handleSave() {
    const snapshot = state;
    startTransition(async () => {
      const result = await updateProgressState(customerId, snapshot);
      if (result.ok) {
        toast.success("저장되었습니다.");
        initialRef.current = snapshot;
        navigateBackOrTo(router, "/customers");
      } else {
        toast.error("저장 실패", { description: result.error });
      }
    });
  }

  function handleReset() {
    setState(initialRef.current);
  }

  return (
    <div className="space-y-4">
      {/* 저장 바 — embedded 모드 (페이지 통합 저장) 에서는 안내 문구만 보여줌 */}
      <div className="flex items-center justify-between gap-2 pb-1">
        <div className="text-xs text-muted-foreground">
          {terminalSource === "termination" ? (
            <span className="text-destructive">
              근무 종료 상태 — 모든 단계가 잠겼습니다
            </span>
          ) : terminalSource === "welcome_pack_only" ? (
            <span className="text-muted-foreground">
              상품 '웰컴팩' — 교육 예약 / 교육 단계 대상 아님
            </span>
          ) : terminalSource ? (
            <span className="text-destructive">
              {FLAG_LABELS[terminalSource as FlagKey]} ON — 이후 단계가 잠겼습니다
            </span>
          ) : dirty ? (
            <span>변경사항 저장 대기</span>
          ) : (
            <span>변경사항 없음</span>
          )}
        </div>
        {!embedded && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={!dirty || pending}
            >
              <Undo2 className="size-4" />
              되돌리기
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={!dirty || pending}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              저장
            </Button>
          </div>
        )}
      </div>

      {/* 단계별 상세 — 각 단계가 한 줄, 안에 항목들이 가로로 (flex-wrap) */}
      <div className="space-y-3">
        <StageRow
          title="접수"
          complete={summary.intake.complete}
          locked={isStageCardLocked("intake")}
        >
          <AutoItem label="기초정보">
            <Badge
              variant="outline"
              className={
                summary.intake.basicInfo === "완벽"
                  ? "bg-success/10 text-success border-success/20"
                  : summary.intake.basicInfo === "핵심"
                    ? "bg-info/10 text-info border-info/20"
                    : "bg-muted text-muted-foreground border-border"
              }
            >
              {summary.intake.basicInfo}
            </Badge>
          </AutoItem>
          <IntakeDecisionItem
            confirmed={state.flags.intake_confirmed}
            abandoned={state.flags.intake_abandoned}
            yesLocked={isFlagLocked("intake_confirmed")}
            noLocked={isFlagLocked("intake_abandoned")}
            onSelectYes={() => setIntakeDecision("yes")}
            onSelectNo={() => setIntakeDecision("no")}
            onClear={() => setIntakeDecision("none")}
            pending={pending}
          />
          <ManualSwitchItem
            flag="study_abroad_consultation"
            value={state.flags.study_abroad_consultation}
            locked={isFlagLocked("study_abroad_consultation")}
            onChange={(v) => toggleFlag("study_abroad_consultation", v)}
            pending={pending}
          />
        </StageRow>

        <StageRow
          title="교육 예약"
          complete={summary.trainingReservation.complete}
          locked={isStageCardLocked("training_reservation")}
        >
          <ManualSwitchItem
            flag="training_center_finding"
            value={state.flags.training_center_finding}
            locked={isFlagLocked("training_center_finding")}
            onChange={(v) => toggleFlag("training_center_finding", v)}
            pending={pending}
          />
          <AutoItem label="교육원 매칭">
            <BoolPill v={summary.trainingReservation.centerMatched} />
          </AutoItem>
          <AutoItem label="강의 일정 업데이트">
            <ScheduleStatusBadge
              needsUpdate={
                summary.trainingReservation.classScheduleConfirmationNeeded
              }
            />
          </AutoItem>
          <AutoItem label="강의일정 확정">
            <BoolPill v={summary.trainingReservation.classMatched} />
          </AutoItem>
          <AutoItem label="예약금 입금">
            <BoolPill v={summary.trainingReservation.reservationPaid} />
          </AutoItem>
          <MilestoneItem
            flag="class_intake_sms_sent"
            value={state.flags.class_intake_sms_sent}
            locked={isFlagLocked("class_intake_sms_sent")}
            onChange={(v) => toggleFlag("class_intake_sms_sent", v)}
            pending={pending}
          />
          <ManualSwitchItem
            flag="training_reservation_abandoned"
            value={state.flags.training_reservation_abandoned}
            locked={isFlagLocked("training_reservation_abandoned")}
            onChange={(v) => toggleFlag("training_reservation_abandoned", v)}
            pending={pending}
          />
        </StageRow>

        <StageRow
          title="교육"
          complete={summary.training.complete}
          locked={isStageCardLocked("training")}
        >
          <AutoItem label="교육 전/중/완료">
            {summary.training.phase ? (
              <Badge variant="outline">{summary.training.phase}</Badge>
            ) : (
              <span className="text-xs text-muted-foreground">
                강의일정 필요
              </span>
            )}
          </AutoItem>
          <MilestoneItem
            flag="certificate_acquired"
            value={state.flags.certificate_acquired}
            locked={isFlagLocked("certificate_acquired")}
            onChange={(v) => toggleFlag("certificate_acquired", v)}
            pending={pending}
          />
          <ManualSwitchItem
            flag="training_dropped"
            value={state.flags.training_dropped}
            locked={isFlagLocked("training_dropped")}
            onChange={(v) => toggleFlag("training_dropped", v)}
            pending={pending}
          />
        </StageRow>

        <StageRow
          title="취업"
          complete={summary.employment.complete}
          locked={isStageCardLocked("employment")}
        >
          <MilestoneItem
            flag="health_check_completed"
            value={state.flags.health_check_completed}
            locked={isFlagLocked("health_check_completed")}
            onChange={(v) => toggleFlag("health_check_completed", v)}
            pending={pending}
          />
          <ManualSwitchItem
            flag="care_home_finding"
            value={state.flags.care_home_finding}
            locked={isFlagLocked("care_home_finding")}
            onChange={(v) => toggleFlag("care_home_finding", v)}
            pending={pending}
          />
          <AutoItem label="요양원 매칭">
            <BoolPill v={summary.employment.careHomeMatched} />
          </AutoItem>
          <MilestoneItem
            flag="resume_sent"
            value={state.flags.resume_sent}
            locked={isFlagLocked("resume_sent")}
            onChange={(v) => toggleFlag("resume_sent", v)}
            pending={pending}
          />
          <AutoItem label="면접 전/후">
            {summary.employment.interviewPhase ? (
              <Badge variant="outline">
                {summary.employment.interviewPhase}
              </Badge>
            ) : (
              <span className="text-xs text-muted-foreground">면접일 필요</span>
            )}
          </AutoItem>
          <MilestoneItem
            flag="interview_passed"
            value={state.flags.interview_passed}
            locked={isFlagLocked("interview_passed")}
            onChange={(v) => toggleFlag("interview_passed", v)}
            pending={pending}
          />
          <AutoItem label="웰컴팩 예약금 입금">
            <BoolPill v={summary.employment.welcomePackReservationPaid} />
          </AutoItem>
          <ManualSwitchItem
            flag="welcome_pack_abandoned"
            value={state.flags.welcome_pack_abandoned}
            locked={isFlagLocked("welcome_pack_abandoned")}
            onChange={(v) => toggleFlag("welcome_pack_abandoned", v)}
            pending={pending}
          />
        </StageRow>

        <StageRow
          title="근무"
          complete={summary.work.workPhase === "종료"}
          locked={isWorkCardLocked}
        >
          <AutoItem label="근무 전/중/종료">
            {summary.work.workPhase ? (
              <Badge variant="outline">{summary.work.workPhase}</Badge>
            ) : (
              <span className="text-xs text-muted-foreground">
                근무 시작일 필요
              </span>
            )}
          </AutoItem>
          <AutoItem label="비자변경">
            {summary.work.visaChangePhase ? (
              <Badge
                variant="outline"
                className={
                  summary.work.visaUrgent
                    ? "bg-destructive/10 text-destructive border-destructive/30"
                    : summary.work.visaChangePhase === "변경 완료"
                      ? "bg-success/10 text-success border-success/20"
                      : ""
                }
              >
                {summary.work.visaChangePhase}
              </Badge>
            ) : (
              <span className="text-xs text-muted-foreground">
                {summary.work.workPhase ? "—" : "근무 시작일 필요"}
              </span>
            )}
          </AutoItem>
          <ItemBox label="근무 종료" align="end">
            <Select
              value={state.termination_reason ?? NONE_VALUE}
              onValueChange={(v) =>
                setTerminationReason(
                  v === NONE_VALUE
                    ? null
                    : (v as "요양보호사 직종변경" | "귀국" | "연락두절")
                )
              }
              disabled={pending}
            >
              <SelectTrigger className="h-8 w-44">
                <SelectValueMap
                  map={{
                    [NONE_VALUE]: "해당없음",
                    "요양보호사 직종변경": "직종변경",
                    귀국: "귀국",
                    연락두절: "연락두절",
                  }}
                  placeholder="해당없음"
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>해당없음</SelectItem>
                <SelectItem value="요양보호사 직종변경">
                  요양보호사 직종변경
                </SelectItem>
                <SelectItem value="귀국">귀국</SelectItem>
                <SelectItem value="연락두절">연락두절</SelectItem>
              </SelectContent>
            </Select>
          </ItemBox>
        </StageRow>

        {/* 대기 섹션 — 맨 마지막 */}
        <StageRow title="대기" complete={false} locked={waitingLocked}>
          <ItemBox label="대기중" hint="단계 무관, 일시 홀딩 시 사용">
            <Switch
              checked={state.is_waiting}
              onCheckedChange={setWaiting}
              disabled={pending || waitingLocked}
            />
          </ItemBox>
          {state.is_waiting && (
            <>
              <ItemBox label="재연락일">
                <Input
                  type="date"
                  value={state.recontact_date ?? ""}
                  onChange={(e) => setRecontactDate(e.target.value)}
                  disabled={pending || waitingLocked}
                  className="h-8 w-44"
                />
              </ItemBox>
              <ItemBox label="메모" hint="최대 500자" grow>
                <Textarea
                  value={state.waiting_memo ?? ""}
                  onChange={(e) => setWaitingMemo(e.target.value)}
                  rows={2}
                  maxLength={500}
                  disabled={pending || waitingLocked}
                />
              </ItemBox>
            </>
          )}
        </StageRow>
      </div>

      {/* 챙길 일정 — 대기중과 별개. 자체 즉시 저장. */}
      <CustomerRemindersPanel
        customerId={customerId}
        reminders={reminders}
      />
    </div>
  );
}

// =============================================================================
// 공통 UI 파트
// =============================================================================

const NONE_VALUE = "__none__";

/**
 * 단계 한 줄. 좌측에 title + complete/locked badge, 우측에 children (mini-box 들 flex-wrap).
 */
function StageRow({
  title,
  complete,
  locked,
  children,
}: {
  title: string;
  complete: boolean;
  locked?: boolean;
  children: React.ReactNode;
}) {
  // locked 가 complete 보다 우선 (종료된 단계는 완료 tint 보다 잠금 tint 노출)
  return (
    <Card
      className={cn(
        "transition-colors p-3",
        locked
          ? "bg-muted/40 border-border/50 opacity-70"
          : complete
            ? "bg-success/5 border-success/30"
            : ""
      )}
    >
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-[110px] shrink-0 pt-1">
          <CardTitle
            className={cn(
              "text-base",
              locked && "text-muted-foreground"
            )}
          >
            {title}
          </CardTitle>
          {locked ? (
            <Badge
              variant="outline"
              className="bg-muted text-muted-foreground border-border"
            >
              <Lock className="size-3" />
              잠김
            </Badge>
          ) : (
            complete && (
              <Badge className="bg-success/10 text-success border-success/20">
                <Check className="size-3" />
                완료
              </Badge>
            )
          )}
        </div>
        <div className="flex-1 flex flex-wrap gap-2 min-w-0">{children}</div>
      </div>
    </Card>
  );
}

/**
 * 항목 mini-box. label + hint 가 같은 줄, control/state 가 아래.
 * - grow=true: 남은 폭을 채움 (메모 등)
 * - align="end": flex-wrap row 에서 오른쪽 끝으로 밀림 (terminal/포기 항목)
 */
function ItemBox({
  label,
  hint,
  locked,
  grow,
  align,
  children,
}: {
  label: string;
  hint?: string;
  /** 자동 (읽기 전용) 항목은 자물쇠 아이콘 표시 */
  locked?: boolean;
  grow?: boolean;
  align?: "end";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-md border border-border bg-background/60 px-2.5 py-2 min-w-[130px]",
        grow && "flex-1",
        align === "end" && "ml-auto"
      )}
    >
      <div className="flex items-center gap-1.5 text-xs">
        <span className="font-medium text-foreground">{label}</span>
        {hint && (
          <span className="text-[10px] text-muted-foreground">{hint}</span>
        )}
        {locked && <Lock className="size-3 text-muted-foreground" />}
      </div>
      <div className="mt-auto pt-1">{children}</div>
    </div>
  );
}

/** 자동 항목 (읽기 전용). */
function AutoItem({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <ItemBox label={label} locked>
      {children}
    </ItemBox>
  );
}

/** 수동 스위치 항목 — blocker / terminal 구분은 스위치 thumb 색으로. terminal 은 우측 끝 정렬. */
function ManualSwitchItem({
  flag,
  value,
  locked,
  onChange,
  pending,
}: {
  flag: FlagKey;
  value: boolean;
  locked: boolean;
  onChange: (v: boolean) => void;
  pending: boolean;
}) {
  const category = CATEGORY[flag];
  const onClass =
    category === "blocker"
      ? "data-[state=checked]:bg-warning"
      : category === "terminal"
        ? "data-[state=checked]:bg-destructive"
        : "";
  return (
    <ItemBox
      label={FLAG_LABELS[flag]}
      hint={FLAG_HINTS[flag]}
      align={category === "terminal" ? "end" : undefined}
    >
      <Switch
        checked={value}
        onCheckedChange={onChange}
        disabled={pending || locked}
        className={cn(onClass)}
      />
    </ItemBox>
  );
}

/** 마일스톤 항목 — X / O 쌍이 나란히. 클릭으로 토글. */
function MilestoneItem({
  flag,
  value,
  locked,
  onChange,
  pending,
}: {
  flag: FlagKey;
  value: boolean;
  locked: boolean;
  onChange: (v: boolean) => void;
  pending: boolean;
}) {
  const disabled = pending || locked;
  return (
    <ItemBox label={FLAG_LABELS[flag]} hint={FLAG_HINTS[flag]}>
      <div className="inline-flex rounded-md overflow-hidden border border-border">
        <button
          type="button"
          onClick={() => !disabled && value !== false && onChange(false)}
          disabled={disabled}
          aria-pressed={!value}
          className={cn(
            "inline-flex items-center gap-1 px-2 py-1 text-xs font-medium transition-colors",
            !value
              ? "bg-destructive/10 text-destructive"
              : "bg-transparent text-muted-foreground/60 hover:bg-muted",
            disabled && "opacity-60 cursor-not-allowed"
          )}
        >
          <X className="size-3" />
          아니오
        </button>
        <button
          type="button"
          onClick={() => !disabled && value !== true && onChange(true)}
          disabled={disabled}
          aria-pressed={value}
          className={cn(
            "inline-flex items-center gap-1 px-2 py-1 text-xs font-medium transition-colors border-l border-border",
            value
              ? "bg-success/10 text-success"
              : "bg-transparent text-muted-foreground/60 hover:bg-muted",
            disabled && "opacity-60 cursor-not-allowed"
          )}
        >
          <Check className="size-3" />예
        </button>
      </div>
    </ItemBox>
  );
}

/**
 * 접수 "등록" 결정 — 3-state (예/아니오/미선택). 활성 옵션을 다시 누르면
 * 미선택으로 toggle off.
 */
function IntakeDecisionItem({
  confirmed,
  abandoned,
  yesLocked,
  noLocked,
  onSelectYes,
  onSelectNo,
  onClear,
  pending,
}: {
  confirmed: boolean;
  abandoned: boolean;
  yesLocked: boolean;
  noLocked: boolean;
  onSelectYes: () => void;
  onSelectNo: () => void;
  onClear: () => void;
  pending: boolean;
}) {
  const noDisabled = pending || (!abandoned && noLocked);
  const yesDisabled = pending || (!confirmed && yesLocked);
  return (
    <ItemBox
      label={FLAG_LABELS.intake_confirmed}
      hint="예 = 진행 / 아니오 = 포기"
    >
      <div className="inline-flex rounded-md overflow-hidden border border-border">
        <button
          type="button"
          onClick={() => {
            if (pending) return;
            if (abandoned) onClear();
            else if (!noLocked) onSelectNo();
          }}
          disabled={noDisabled}
          aria-pressed={abandoned}
          className={cn(
            "inline-flex items-center gap-1 px-2 py-1 text-xs font-medium transition-colors",
            abandoned
              ? "bg-destructive/10 text-destructive"
              : "bg-transparent text-muted-foreground/60 hover:bg-muted",
            noDisabled && "opacity-60 cursor-not-allowed"
          )}
        >
          <X className="size-3" />
          아니오
        </button>
        <button
          type="button"
          onClick={() => {
            if (pending) return;
            if (confirmed) onClear();
            else if (!yesLocked) onSelectYes();
          }}
          disabled={yesDisabled}
          aria-pressed={confirmed}
          className={cn(
            "inline-flex items-center gap-1 px-2 py-1 text-xs font-medium transition-colors border-l border-border",
            confirmed
              ? "bg-success/10 text-success"
              : "bg-transparent text-muted-foreground/60 hover:bg-muted",
            yesDisabled && "opacity-60 cursor-not-allowed"
          )}
        >
          <Check className="size-3" />예
        </button>
      </div>
    </ItemBox>
  );
}

/** 기존 BoolPill — 자동 행에서 예/아니오 한쪽만 표시. */
function BoolPill({ v }: { v: boolean }) {
  if (v) {
    return (
      <Badge className="bg-success/10 text-success border-success/20">
        <Check className="size-3" />예
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      <X className="size-3" />
      아니오
    </Badge>
  );
}

/**
 * 0017: '강의 일정 업데이트' 상태 표시. 토글이 아니라 derived 결과 read-only.
 * needsUpdate = true 면 빨강 (필요), false 면 초록 (완료).
 */
function ScheduleStatusBadge({ needsUpdate }: { needsUpdate: boolean }) {
  if (needsUpdate) {
    return (
      <Badge className="bg-destructive/10 text-destructive border-destructive/20">
        <X className="size-3" />
        업데이트 필요
      </Badge>
    );
  }
  return (
    <Badge className="bg-success/10 text-success border-success/20">
      <Check className="size-3" />
      완료
    </Badge>
  );
}
