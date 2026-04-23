"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2, Lock, Save, Undo2, X } from "lucide-react";

import { updateProgressState } from "@/app/(app)/customers/actions";
import {
  computeCustomerStatus,
  type StatusInputs,
} from "@/lib/customer-status";
import type {
  ProgressStateInput,
  StatusFlagsInput,
} from "@/lib/validators";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

type Props = {
  customerId: string;
  inputs: StatusInputs;
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
  study_abroad_consultation: "terminal",
  training_center_finding: "blocker",
  class_schedule_confirmation_needed: "blocker",
  training_reservation_abandoned: "terminal",
  certificate_acquired: "milestone",
  training_dropped: "terminal",
  welcome_pack_abandoned: "terminal",
  care_home_finding: "blocker",
  resume_sent: "milestone",
  interview_passed: "milestone",
};

const FLAG_LABELS: Record<FlagKey, string> = {
  intake_abandoned: "접수포기",
  study_abroad_consultation: "유학상담으로 전환",
  training_center_finding: "교육원 발굴 필요",
  class_schedule_confirmation_needed: "강의 일정 확인 필요",
  training_reservation_abandoned: "교육 예약포기",
  certificate_acquired: "자격증 취득",
  training_dropped: "교육 드랍",
  welcome_pack_abandoned: "웰컴팩 예약포기",
  care_home_finding: "요양원 발굴 필요",
  resume_sent: "이력서 발송",
  interview_passed: "면접 합격",
};

const FLAG_HINTS: Partial<Record<FlagKey, string>> = {
  training_center_finding: "교육원 매칭하면 자동으로 해제됩니다.",
  class_schedule_confirmation_needed:
    "강의 일정 정보가 없어 교육원에 확인이 필요합니다.",
  care_home_finding: "요양원 매칭하면 자동으로 해제됩니다.",
  intake_abandoned: "체크 시 이후 모든 단계 판정이 중지됩니다.",
  study_abroad_consultation: "유학으로 전환 → 이후 단계 중지.",
  training_reservation_abandoned: "체크 시 이후 단계 중지.",
  training_dropped: "교육 중 이탈 → 이후 단계 중지.",
  welcome_pack_abandoned: "체크 시 취업 단계 종결.",
  resume_sent: "요양원에 이력서를 보냈으면 ON.",
};

// =============================================================================
// 메인
// =============================================================================

function buildInitialState(inputs: StatusInputs): ProgressStateInput {
  return {
    flags: {
      intake_abandoned: inputs.status.intake_abandoned,
      study_abroad_consultation: inputs.status.study_abroad_consultation,
      training_center_finding: inputs.status.training_center_finding,
      class_schedule_confirmation_needed:
        inputs.status.class_schedule_confirmation_needed,
      training_reservation_abandoned:
        inputs.status.training_reservation_abandoned,
      certificate_acquired: inputs.status.certificate_acquired,
      training_dropped: inputs.status.training_dropped,
      welcome_pack_abandoned: inputs.status.welcome_pack_abandoned,
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

export function CustomerProgressTab({ customerId, inputs }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // 초기 (DB 기준) state — 저장 후 이 값으로 갱신
  const initialRef = useRef<ProgressStateInput>(buildInitialState(inputs));
  const [state, setState] = useState<ProgressStateInput>(() => initialRef.current);

  const dirty = useMemo(
    () => JSON.stringify(state) !== JSON.stringify(initialRef.current),
    [state]
  );

  // 종료 상태 판정 (UI lock 용). 저장 전 로컬 state 기준이라 즉시 반영.
  const anyTerminationOn = useMemo(() => {
    const f = state.flags;
    return (
      !!state.termination_reason ||
      f.intake_abandoned ||
      f.study_abroad_consultation ||
      f.training_reservation_abandoned ||
      f.training_dropped ||
      f.welcome_pack_abandoned
    );
  }, [state]);

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
    const category = CATEGORY[key];
    if (anyTerminationOn && category !== "terminal") return;
    setState((prev) => ({
      ...prev,
      flags: { ...prev.flags, [key]: value },
    }));
  }

  function setTerminationReason(
    value: "요양보호사 직종변경" | "귀국" | "연락두절" | null
  ) {
    setState((prev) => ({ ...prev, termination_reason: value }));
  }

  function setWaiting(value: boolean) {
    if (anyTerminationOn) return;
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
        router.refresh();
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
      {/* 저장 바 */}
      <div className="flex items-center justify-between gap-2 pb-1">
        <div className="text-xs text-muted-foreground">
          {anyTerminationOn ? (
            <span className="text-destructive">
              종료 상태 — 종료 스위치 외의 다른 필드는 잠겨 있음
            </span>
          ) : dirty ? (
            <span>변경사항 저장 대기</span>
          ) : (
            <span>변경사항 없음</span>
          )}
        </div>
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
      </div>

      {/* 단계별 상세 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <StageCard title="접수" complete={summary.intake.complete}>
          <AutoRow label="기초정보">
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
          </AutoRow>
          <ManualSwitchRow
            flag="intake_abandoned"
            value={state.flags.intake_abandoned}
            locked={anyTerminationOn && !state.flags.intake_abandoned}
            onChange={(v) => toggleFlag("intake_abandoned", v)}
            pending={pending}
          />
          <ManualSwitchRow
            flag="study_abroad_consultation"
            value={state.flags.study_abroad_consultation}
            locked={
              anyTerminationOn && !state.flags.study_abroad_consultation
            }
            onChange={(v) => toggleFlag("study_abroad_consultation", v)}
            pending={pending}
          />
        </StageCard>

        <StageCard
          title="교육 예약"
          complete={summary.trainingReservation.complete}
        >
          <ManualSwitchRow
            flag="training_center_finding"
            value={state.flags.training_center_finding}
            locked={anyTerminationOn}
            onChange={(v) => toggleFlag("training_center_finding", v)}
            pending={pending}
          />
          <AutoRow label="교육원 매칭">
            <BoolPill v={summary.trainingReservation.centerMatched} />
          </AutoRow>
          <ManualSwitchRow
            flag="class_schedule_confirmation_needed"
            value={state.flags.class_schedule_confirmation_needed}
            locked={anyTerminationOn}
            onChange={(v) =>
              toggleFlag("class_schedule_confirmation_needed", v)
            }
            pending={pending}
          />
          <AutoRow label="강의일정 확정">
            <BoolPill v={summary.trainingReservation.classMatched} />
          </AutoRow>
          <AutoRow label="예약금 입금">
            <BoolPill v={summary.trainingReservation.reservationPaid} />
          </AutoRow>
          <AutoRow label="강의 접수 메시지 발송">
            <BoolPill v={summary.trainingReservation.smsSent} />
          </AutoRow>
          <ManualSwitchRow
            flag="training_reservation_abandoned"
            value={state.flags.training_reservation_abandoned}
            locked={
              anyTerminationOn && !state.flags.training_reservation_abandoned
            }
            onChange={(v) => toggleFlag("training_reservation_abandoned", v)}
            pending={pending}
          />
        </StageCard>

        <StageCard title="교육" complete={summary.training.complete}>
          <AutoRow label="메시지 발송">
            <BoolPill v={summary.training.smsSent} />
          </AutoRow>
          <AutoRow label="교육 전/중/완료">
            {summary.training.phase ? (
              <Badge variant="outline">{summary.training.phase}</Badge>
            ) : (
              <span className="text-xs text-muted-foreground">
                강의일정 필요
              </span>
            )}
          </AutoRow>
          <MilestoneRow
            flag="certificate_acquired"
            value={state.flags.certificate_acquired}
            locked={anyTerminationOn}
            onChange={(v) => toggleFlag("certificate_acquired", v)}
            pending={pending}
          />
          <ManualSwitchRow
            flag="training_dropped"
            value={state.flags.training_dropped}
            locked={anyTerminationOn && !state.flags.training_dropped}
            onChange={(v) => toggleFlag("training_dropped", v)}
            pending={pending}
          />
        </StageCard>

        <StageCard title="취업" complete={summary.employment.complete}>
          <ManualSwitchRow
            flag="care_home_finding"
            value={state.flags.care_home_finding}
            locked={anyTerminationOn}
            onChange={(v) => toggleFlag("care_home_finding", v)}
            pending={pending}
          />
          <AutoRow label="요양원 매칭">
            <BoolPill v={summary.employment.careHomeMatched} />
          </AutoRow>
          <MilestoneRow
            flag="resume_sent"
            value={state.flags.resume_sent}
            locked={anyTerminationOn}
            onChange={(v) => toggleFlag("resume_sent", v)}
            pending={pending}
          />
          <AutoRow label="면접 전/후">
            {summary.employment.interviewPhase ? (
              <Badge variant="outline">
                {summary.employment.interviewPhase}
              </Badge>
            ) : (
              <span className="text-xs text-muted-foreground">면접일 필요</span>
            )}
          </AutoRow>
          <MilestoneRow
            flag="interview_passed"
            value={state.flags.interview_passed}
            locked={anyTerminationOn}
            onChange={(v) => toggleFlag("interview_passed", v)}
            pending={pending}
          />
          <AutoRow label="웰컴팩 예약금 입금">
            <BoolPill v={summary.employment.welcomePackReservationPaid} />
          </AutoRow>
          <ManualSwitchRow
            flag="welcome_pack_abandoned"
            value={state.flags.welcome_pack_abandoned}
            locked={anyTerminationOn && !state.flags.welcome_pack_abandoned}
            onChange={(v) => toggleFlag("welcome_pack_abandoned", v)}
            pending={pending}
          />
        </StageCard>

        <StageCard
          title="근무"
          complete={summary.work.workPhase === "종료"}
        >
          <AutoRow label="근무 전/중/종료">
            {summary.work.workPhase ? (
              <Badge variant="outline">{summary.work.workPhase}</Badge>
            ) : (
              <span className="text-xs text-muted-foreground">
                근무 시작일 필요
              </span>
            )}
          </AutoRow>
          <AutoRow label="비자변경">
            {summary.work.visaChangePhase ? (
              <Badge variant="outline">{summary.work.visaChangePhase}</Badge>
            ) : (
              <span className="text-xs text-muted-foreground">
                근무 시작일 필요
              </span>
            )}
          </AutoRow>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Label className="text-sm">근무 종료</Label>
              <p className="text-xs text-muted-foreground">
                체크 시 이 고객은 "종료" 로 분류됩니다.
              </p>
            </div>
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
              <SelectTrigger className="w-44 shrink-0">
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
          </div>
        </StageCard>

        {/* 대기 섹션 — 맨 마지막 */}
        <StageCard title="대기" complete={false}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Label className="text-sm">대기중</Label>
              <p className="text-xs text-muted-foreground">
                단계 무관, 일시 홀딩 시 사용.
              </p>
            </div>
            <Switch
              checked={state.is_waiting}
              onCheckedChange={setWaiting}
              disabled={pending || anyTerminationOn}
              className="shrink-0"
            />
          </div>
          {state.is_waiting && (
            <>
              <div>
                <Label className="text-xs text-muted-foreground">
                  재연락일
                </Label>
                <Input
                  type="date"
                  value={state.recontact_date ?? ""}
                  onChange={(e) => setRecontactDate(e.target.value)}
                  disabled={pending}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">
                  메모 <span className="text-[11px]">(최대 500자)</span>
                </Label>
                <Textarea
                  value={state.waiting_memo ?? ""}
                  onChange={(e) => setWaitingMemo(e.target.value)}
                  rows={2}
                  maxLength={500}
                  disabled={pending}
                />
              </div>
            </>
          )}
        </StageCard>
      </div>
    </div>
  );
}

// =============================================================================
// 공통 UI 파트
// =============================================================================

const NONE_VALUE = "__none__";

function StageCard({
  title,
  complete,
  children,
}: {
  title: string;
  complete: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card
      className={cn(
        "transition-colors",
        complete && "bg-success/5 border-success/30"
      )}
    >
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">{title}</CardTitle>
        {complete && (
          <Badge className="bg-success/10 text-success border-success/20">
            <Check className="size-3" />
            완료
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

/** 완전 자동 행 (읽기 전용). 잠금 아이콘은 텍스트 끝으로. */
function AutoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <span>{label}</span>
        <Lock className="size-3" />
      </div>
      {children}
    </div>
  );
}

/** 수동 스위치 행 — blocker / terminal 구분은 스위치 thumb 색으로. */
function ManualSwitchRow({
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
  // 색상 토큰: blocker=amber(warning), terminal=red(destructive)
  const onClass =
    category === "blocker"
      ? "data-[state=checked]:bg-warning"
      : category === "terminal"
        ? "data-[state=checked]:bg-destructive"
        : "";
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <Label className="text-sm">{FLAG_LABELS[flag]}</Label>
        {FLAG_HINTS[flag] && (
          <p className="text-xs text-muted-foreground">{FLAG_HINTS[flag]}</p>
        )}
      </div>
      <Switch
        checked={value}
        onCheckedChange={onChange}
        disabled={pending || locked}
        className={cn("shrink-0", onClass)}
      />
    </div>
  );
}

/**
 * 마일스톤 행 — X / O 쌍이 나란히 보이고 활성 상태만 컬러. 클릭으로 토글.
 * 자동 읽기 전용 필드와 시각적 일관성 유지를 위해 BoolPill 과 유사한 스타일.
 */
function MilestoneRow({
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
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <Label className="text-sm">{FLAG_LABELS[flag]}</Label>
        {FLAG_HINTS[flag] && (
          <p className="text-xs text-muted-foreground">{FLAG_HINTS[flag]}</p>
        )}
      </div>
      <div className="inline-flex rounded-md overflow-hidden border border-border shrink-0">
        <button
          type="button"
          onClick={() => !disabled && value !== false && onChange(false)}
          disabled={disabled}
          aria-pressed={!value}
          className={cn(
            "inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium transition-colors",
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
            "inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium transition-colors border-l border-border",
            value
              ? "bg-success/10 text-success"
              : "bg-transparent text-muted-foreground/60 hover:bg-muted",
            disabled && "opacity-60 cursor-not-allowed"
          )}
        >
          <Check className="size-3" />예
        </button>
      </div>
    </div>
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
