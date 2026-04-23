"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, CircleDashed, Loader2, Lock, X } from "lucide-react";

import { updateStatusFlags } from "@/app/(app)/customers/actions";
import {
  computeCustomerStatus,
  type StageSummary,
  type StatusInputs,
} from "@/lib/customer-status";
import type { StatusFlagsInput } from "@/lib/validators";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Props = {
  customerId: string;
  inputs: StatusInputs;
};

type FlagKey = keyof StatusFlagsInput;

const FLAG_LABELS: Record<FlagKey, string> = {
  intake_abandoned: "접수포기",
  study_abroad_consultation: "유학상담으로 전환",
  training_center_finding: "교육원 발굴 중",
  class_schedule_confirmation_needed: "강의 일정 확인",
  training_reservation_abandoned: "교육 예약포기",
  certificate_acquired: "자격증 취득",
  training_dropped: "교육 드랍",
  welcome_pack_abandoned: "웰컴팩 예약포기",
  care_home_finding: "요양원 발굴 중",
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
  training_dropped: "교육 중 이탈 — 이후 모든 단계 중지.",
  welcome_pack_abandoned: "체크 시 취업 단계가 종료 처리됩니다.",
  resume_sent: "요양원에 이력서를 보냈으면 ON.",
};

export function CustomerProgressTab({ customerId, inputs }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<StatusFlagsInput>({
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
  });

  const summary = computeCustomerStatus({
    ...inputs,
    status: { ...inputs.status, ...optimistic },
  });

  function handleToggle(key: FlagKey, value: boolean) {
    const next = { ...optimistic, [key]: value };
    setOptimistic(next);

    startTransition(async () => {
      const result = await updateStatusFlags(customerId, next);
      if (result.ok) {
        toast.success(
          `${FLAG_LABELS[key]} ${value ? "ON" : "OFF"}`
        );
        router.refresh();
      } else {
        setOptimistic(optimistic); // 롤백
        toast.error("변경 실패", { description: result.error });
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* 현재 단계 요약 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">현재 단계 (자동 판정)</CardTitle>
          <CardDescription>
            기초정보, 매칭, 결제, 일정, 수동 플래그를 종합해 런타임에 계산됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3 flex-wrap">
          <CurrentStageBadge stage={summary.currentStage} />
          <span className="text-sm">{summary.label}</span>
          {pending && (
            <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
              <Loader2 className="size-3 animate-spin" />
              저장 중
            </span>
          )}
        </CardContent>
      </Card>

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
          <ManualRow
            flag="intake_abandoned"
            checked={optimistic.intake_abandoned}
            onChange={(v) => handleToggle("intake_abandoned", v)}
            pending={pending}
          />
          <ManualRow
            flag="study_abroad_consultation"
            checked={optimistic.study_abroad_consultation}
            onChange={(v) => handleToggle("study_abroad_consultation", v)}
            pending={pending}
          />
        </StageCard>

        <StageCard
          title="교육 예약"
          complete={summary.trainingReservation.complete}
        >
          <ManualRow
            flag="training_center_finding"
            checked={optimistic.training_center_finding}
            onChange={(v) => handleToggle("training_center_finding", v)}
            pending={pending}
          />
          <AutoRow label="교육원 매칭">
            <BoolPill v={summary.trainingReservation.centerMatched} />
          </AutoRow>
          <ManualRow
            flag="class_schedule_confirmation_needed"
            checked={optimistic.class_schedule_confirmation_needed}
            onChange={(v) =>
              handleToggle("class_schedule_confirmation_needed", v)
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
          <ManualRow
            flag="training_reservation_abandoned"
            checked={optimistic.training_reservation_abandoned}
            onChange={(v) => handleToggle("training_reservation_abandoned", v)}
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
          <ManualRow
            flag="training_dropped"
            checked={optimistic.training_dropped}
            onChange={(v) => handleToggle("training_dropped", v)}
            pending={pending}
          />
          <ManualRow
            flag="certificate_acquired"
            checked={optimistic.certificate_acquired}
            onChange={(v) => handleToggle("certificate_acquired", v)}
            pending={pending}
          />
        </StageCard>

        <StageCard title="취업" complete={summary.employment.complete}>
          <ManualRow
            flag="care_home_finding"
            checked={optimistic.care_home_finding}
            onChange={(v) => handleToggle("care_home_finding", v)}
            pending={pending}
          />
          <AutoRow label="요양원 매칭">
            <BoolPill v={summary.employment.careHomeMatched} />
          </AutoRow>
          <ManualRow
            flag="resume_sent"
            checked={optimistic.resume_sent}
            onChange={(v) => handleToggle("resume_sent", v)}
            pending={pending}
          />
          <AutoRow label="면접 전/후">
            {summary.employment.interviewPhase ? (
              <Badge variant="outline">{summary.employment.interviewPhase}</Badge>
            ) : (
              <span className="text-xs text-muted-foreground">면접일 필요</span>
            )}
          </AutoRow>
          <ManualRow
            flag="interview_passed"
            checked={optimistic.interview_passed}
            onChange={(v) => handleToggle("interview_passed", v)}
            pending={pending}
          />
          <AutoRow label="웰컴팩 예약금 입금">
            <BoolPill v={summary.employment.welcomePackReservationPaid} />
          </AutoRow>
          <ManualRow
            flag="welcome_pack_abandoned"
            checked={optimistic.welcome_pack_abandoned}
            onChange={(v) => handleToggle("welcome_pack_abandoned", v)}
            pending={pending}
          />
        </StageCard>

        <StageCard title="근무" complete={summary.work.workPhase === "종료"}>
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
        </StageCard>
      </div>
    </div>
  );
}

// =============================================================================
// 하위 컴포넌트
// =============================================================================

function CurrentStageBadge({
  stage,
}: {
  stage: StageSummary["currentStage"];
}) {
  const cls =
    stage === "종료"
      ? "bg-destructive/10 text-destructive border-destructive/20"
      : stage === "대기중"
        ? "bg-warning/10 text-warning border-warning/20"
        : stage === "근무종료"
          ? "bg-muted text-muted-foreground border-border"
          : stage === "근무중" || stage === "취업중"
            ? "bg-success/10 text-success border-success/20"
            : "bg-info/10 text-info border-info/20";
  return (
    <Badge variant="outline" className={cn("text-sm px-3 py-1", cls)}>
      {stage}
    </Badge>
  );
}

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
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">{title}</CardTitle>
        {complete ? (
          <Badge className="bg-success/10 text-success border-success/20">
            <Check className="size-3" />
            완료
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            <CircleDashed className="size-3" />
            진행중
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

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
        <Lock className="size-3" />
        <span>{label}</span>
      </div>
      {children}
    </div>
  );
}

function ManualRow({
  flag,
  checked,
  onChange,
  pending,
}: {
  flag: FlagKey;
  checked: boolean;
  onChange: (v: boolean) => void;
  pending: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <Label className="text-sm">{FLAG_LABELS[flag]}</Label>
        {FLAG_HINTS[flag] && (
          <p className="text-xs text-muted-foreground">{FLAG_HINTS[flag]}</p>
        )}
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        disabled={pending}
        className="shrink-0"
      />
    </div>
  );
}

function BoolPill({ v }: { v: boolean }) {
  if (v) {
    return (
      <Badge className="bg-success/10 text-success border-success/20">
        <Check className="size-3" />
        예
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
