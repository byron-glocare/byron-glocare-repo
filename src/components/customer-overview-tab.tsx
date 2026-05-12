"use client";

/**
 * 통합 view — 진행 단계 / 기본 정보 / 상담 일지 / 정산 을 한 페이지에 모음.
 *
 * 의도:
 *  - 평균 4개월 동안 자주 들어와 업데이트하는 관리자 워크플로
 *  - 탭 왔다갔다 없이 한 화면에서 흐름 파악 + 편집
 *  - 영역별 collapsible 로 스크롤 부담 줄임
 *  - 펼침/접힘 시 폼 state 유지 (display:hidden 으로만 숨김)
 *
 * 페이지 레벨 저장 (sticky bottom) 은 부모 (customer-edit-tabs) 가 담당.
 * 진행 단계 / 기본 정보 ref 는 부모로부터 받아서 forward.
 */

import { useState, type Ref } from "react";
import {
  BookOpen,
  Briefcase,
  Building2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  GraduationCap,
  MessageCircle,
  Phone,
  Receipt,
  Sparkles,
  User,
} from "lucide-react";

import {
  computeCustomerStatus,
  type StatusInputs,
} from "@/lib/customer-status";
import { cn } from "@/lib/utils";
import type {
  CareHome,
  CommissionPayment,
  Consultation,
  Customer,
  EventPayment,
  Json,
  ReservationPayment,
  TrainingCenter,
  TrainingClass,
  WelcomePackPayment,
} from "@/types/database";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

import {
  CustomerBasicForm,
  type CustomerBasicFormHandle,
} from "@/components/customer-basic-form";
import {
  CustomerProgressTab,
  type CustomerProgressTabHandle,
} from "@/components/customer-progress-tab";
import { CustomerConsultationsTab } from "@/components/customer-consultations-tab";
import { CustomerSettlementTab } from "@/components/customer-settlement-tab";

type Props = {
  customer: Customer;
  progressInputs: StatusInputs;
  consultations: Consultation[];
  reservationPayments: ReservationPayment[];
  welcomePackPayment: WelcomePackPayment | null;
  commissionPayments: CommissionPayment[];
  eventPayments: EventPayment[];
  trainingCenters: Pick<TrainingCenter, "id" | "code" | "name" | "region">[];
  trainingClasses: Pick<
    TrainingClass,
    | "id"
    | "training_center_id"
    | "year"
    | "month"
    | "class_type"
    | "start_date"
    | "end_date"
  >[];
  careHomes: Pick<CareHome, "id" | "code" | "name" | "region">[];
  customerOptions: {
    id: string;
    code: string;
    name_kr: string | null;
    name_vi: string | null;
  }[];
  careHomeLocked: boolean;
  settings: Record<string, Json | undefined>;

  // 페이지 레벨 통합 저장에 사용 — 부모(customer-edit-tabs) 가 ref forward
  basicRef: Ref<CustomerBasicFormHandle>;
  progressRef: Ref<CustomerProgressTabHandle>;
  onBasicDirty: (dirty: boolean) => void;
  onProgressDirty: (dirty: boolean) => void;
};

export function CustomerOverviewTab({
  customer,
  progressInputs,
  consultations,
  reservationPayments,
  welcomePackPayment,
  commissionPayments,
  eventPayments,
  trainingCenters,
  trainingClasses,
  careHomes,
  customerOptions,
  careHomeLocked,
  settings,
  basicRef,
  progressRef,
  onBasicDirty,
  onProgressDirty,
}: Props) {
  const summary = computeCustomerStatus(progressInputs);

  return (
    <div className="space-y-4">
      {/* === 헤더: 한 줄 요약 === */}
      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">
                {customer.name_kr || customer.name_vi || "(이름 없음)"}
              </h2>
              {customer.name_kr && customer.name_vi && (
                <span className="text-sm text-muted-foreground">
                  {customer.name_vi}
                </span>
              )}
              <span className="text-xs text-muted-foreground font-mono">
                {customer.code}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {customer.phone && (
                <span className="inline-flex items-center gap-1">
                  <Phone className="size-3" />
                  {customer.phone}
                </span>
              )}
              {customer.visa_type && (
                <span>비자 {customer.visa_type}</span>
              )}
              {customer.birth_year && (
                <span>{new Date().getFullYear() - customer.birth_year}세</span>
              )}
              {customer.product_type && (
                <Badge variant="outline" className="text-[10px] py-0">
                  {customer.product_type}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <div className="text-[11px] text-muted-foreground">현재 단계</div>
            <Badge
              className={cn(
                "text-sm py-1 px-2.5",
                summary.currentStage === "종료"
                  ? "bg-destructive/10 text-destructive border-destructive/20"
                  : summary.currentStage === "대기중"
                    ? "bg-warning/10 text-warning border-warning/20"
                    : summary.currentStage === "근무중"
                      ? "bg-success/10 text-success border-success/20"
                      : "bg-info/10 text-info border-info/20"
              )}
              variant="outline"
            >
              {summary.label}
            </Badge>
          </div>
        </div>

        {/* 5단계 진행 trail */}
        <StageTrail summary={summary} />
      </Card>

      {/* === 통합 폼 영역 === */}
      <SectionCard
        icon={<ClipboardList className="size-4" />}
        title="진행 단계"
        defaultOpen={true}
      >
        <CustomerProgressTab
          customerId={customer.id}
          inputs={progressInputs}
          embedded
          ref={progressRef}
          onDirtyChange={onProgressDirty}
        />
      </SectionCard>

      <SectionCard
        icon={<User className="size-4" />}
        title="기본 정보"
        defaultOpen={false}
      >
        <CustomerBasicForm
          mode="edit"
          customerId={customer.id}
          defaultValues={customer}
          trainingCenters={trainingCenters}
          trainingClasses={trainingClasses}
          careHomes={careHomes}
          careHomeLocked={careHomeLocked}
          embedded
          ref={basicRef}
          onDirtyChange={onBasicDirty}
        />
      </SectionCard>

      <SectionCard
        icon={<MessageCircle className="size-4" />}
        title="상담 일지"
        subtitle={`총 ${consultations.length}건`}
        defaultOpen={false}
      >
        <CustomerConsultationsTab
          customerId={customer.id}
          consultations={consultations}
        />
      </SectionCard>

      <SectionCard
        icon={<Receipt className="size-4" />}
        title="정산"
        subtitle={`소개비 ${commissionPayments.length}건 · 친구소개 ${eventPayments.length}건`}
        defaultOpen={false}
      >
        <CustomerSettlementTab
          customer={customer}
          reservationPayments={reservationPayments}
          commissionPayments={commissionPayments}
          eventPayments={eventPayments}
          welcomePackPayment={welcomePackPayment}
          trainingCenters={trainingCenters}
          customerOptions={customerOptions}
          settings={settings}
        />
      </SectionCard>
    </div>
  );
}

// =============================================================================
// 부속 컴포넌트
// =============================================================================

/**
 * Collapsible 카드. children 은 항상 mount — 펼침/접힘은 display 만 토글.
 * (폼 state / 입력 중인 값이 사라지지 않도록)
 */
function SectionCard({
  icon,
  title,
  subtitle,
  defaultOpen = false,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="overflow-hidden p-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          {open ? (
            <ChevronDown className="size-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 text-muted-foreground" />
          )}
          <div className="size-7 rounded-md bg-primary/10 text-primary flex items-center justify-center">
            {icon}
          </div>
          <span className="text-sm font-medium">{title}</span>
          {subtitle && (
            <span className="text-xs text-muted-foreground">· {subtitle}</span>
          )}
        </div>
      </button>
      {/* 항상 mount — 폼 state 보존 */}
      <div
        className={cn(
          "px-4 pb-4 pt-3 border-t border-border bg-muted/10",
          !open && "hidden"
        )}
      >
        {children}
      </div>
    </Card>
  );
}

/** 5단계 가로 progress trail — 현재 단계 강조 */
function StageTrail({
  summary,
}: {
  summary: ReturnType<typeof computeCustomerStatus>;
}) {
  const stages: {
    key: string;
    label: string;
    icon: React.ReactNode;
    done: boolean;
    active: boolean;
  }[] = [
    {
      key: "intake",
      label: "접수",
      icon: <ClipboardList className="size-3.5" />,
      done: summary.intake.complete,
      active: summary.currentStage === "접수중",
    },
    {
      key: "training_reservation",
      label: "교육 예약",
      icon: <BookOpen className="size-3.5" />,
      done: summary.trainingReservation.complete,
      active: summary.currentStage === "교육예약중",
    },
    {
      key: "training",
      label: "교육",
      icon: <GraduationCap className="size-3.5" />,
      done: summary.training.complete,
      active: summary.currentStage === "교육중",
    },
    {
      key: "employment",
      label: "취업",
      icon: <Building2 className="size-3.5" />,
      done: summary.employment.complete,
      active: summary.currentStage === "취업중",
    },
    {
      key: "work",
      label: "근무",
      icon: <Briefcase className="size-3.5" />,
      done: summary.work.workPhase === "종료",
      active:
        summary.currentStage === "근무중" ||
        summary.currentStage === "근무종료",
    },
  ];

  return (
    <div className="mt-4 flex items-center gap-1">
      {stages.map((s, i) => (
        <div key={s.key} className="flex items-center flex-1">
          <div
            className={cn(
              "flex flex-col items-center gap-1 flex-1 px-1",
              s.active && "text-primary",
              s.done && !s.active && "text-success",
              !s.done && !s.active && "text-muted-foreground"
            )}
          >
            <div
              className={cn(
                "size-7 rounded-full flex items-center justify-center border-2",
                s.active && "bg-primary text-primary-foreground border-primary",
                s.done && !s.active && "bg-success text-white border-success",
                !s.done && !s.active && "bg-muted border-border"
              )}
            >
              {s.done && !s.active ? (
                <Sparkles className="size-3.5" />
              ) : (
                s.icon
              )}
            </div>
            <span className="text-[10px] font-medium">{s.label}</span>
          </div>
          {i < stages.length - 1 && (
            <div
              className={cn(
                "h-0.5 flex-1 -mx-1",
                s.done ? "bg-success" : "bg-border"
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

