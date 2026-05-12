"use client";

/**
 * [시안] '한눈에 보기' 5번째 탭 — 4개 탭 (진행 단계 / 기본 정보 / 상담 / 정산)
 * 의 모든 폼을 한 페이지의 영역별 collapsible 카드로 통합. 평균 4개월 동안
 * 자주 들어오는 관리자가 한 화면에서 흐름 파악 + 편집까지 가능.
 *
 * 4개 탭은 그대로 유지 — 이 탭은 시안. 자체 ref / 자체 저장 사용해서 다른
 * 탭과 ref 충돌 없음. (같은 customer 데이터의 별개 인스턴스라 양쪽 탭에서
 * 동시 편집은 권장 X — 한쪽 저장 후 새로고침 필요.)
 */

import {
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  BookOpen,
  Briefcase,
  Building2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  GraduationCap,
  Loader2,
  MessageCircle,
  Phone,
  Receipt,
  Save,
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
import { Button } from "@/components/ui/button";
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
}: Props) {
  const router = useRouter();
  const summary = computeCustomerStatus(progressInputs);

  // 시안 자체 ref / dirty — 4탭과 분리 (ref 객체 자체가 다름)
  const basicRef = useRef<CustomerBasicFormHandle | null>(null);
  const progressRef = useRef<CustomerProgressTabHandle | null>(null);
  const [basicDirty, setBasicDirty] = useState(false);
  const [progressDirty, setProgressDirty] = useState(false);
  const dirty = basicDirty || progressDirty;

  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function handleSave() {
    if (!dirty) return;
    startTransition(async () => {
      const tasks: Array<Promise<{ ok: boolean; error?: string }>> = [];
      if (basicDirty && basicRef.current) {
        tasks.push(basicRef.current.submit());
      }
      if (progressDirty && progressRef.current) {
        tasks.push(progressRef.current.submit());
      }
      const results = await Promise.all(tasks);
      const errors = results.filter((r) => !r.ok);
      if (errors.length > 0) {
        toast.error("저장 실패", {
          description: errors
            .map((e) => e.error ?? "알 수 없는 오류")
            .join(" / "),
        });
        return;
      }
      toast.success("저장되었습니다.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {/* === 헤더: 한 줄 요약 + 저장 버튼 === */}
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
              {customer.visa_type && <span>비자 {customer.visa_type}</span>}
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

        <StageTrail summary={summary} />
      </Card>

      {/* === 시안 안내 + 저장 카드 === */}
      <Card className="p-3 bg-info/5 border-info/30">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            <span className="font-medium text-info">시안</span> · 진행 단계와
            기본 정보 영역에서 편집한 변경사항은 아래 저장 버튼을 눌러야
            반영됩니다. 다른 탭과 동시 편집은 피해주세요.
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {dirty
                ? "저장하지 않은 변경사항"
                : "변경사항 없음"}
            </span>
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
      </Card>

      {/* === 영역별 collapsible === */}
      <SectionCard
        icon={<ClipboardList className="size-4" />}
        title="진행 단계"
        dirty={progressDirty}
        defaultOpen={true}
      >
        <CustomerProgressTab
          customerId={customer.id}
          inputs={progressInputs}
          embedded
          ref={progressRef}
          onDirtyChange={setProgressDirty}
        />
      </SectionCard>

      <SectionCard
        icon={<User className="size-4" />}
        title="기본 정보"
        dirty={basicDirty}
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
          onDirtyChange={setBasicDirty}
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
 * (폼 state 보존)
 */
function SectionCard({
  icon,
  title,
  subtitle,
  dirty,
  defaultOpen = false,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  /** 진행 단계 / 기본 정보 카드만 사용 — 변경사항 있을 때 작은 점 */
  dirty?: boolean;
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
          {dirty && (
            <span
              className="ml-1 inline-block size-1.5 rounded-full bg-warning"
              aria-label="변경사항 있음"
            />
          )}
        </div>
      </button>
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

/** 5단계 가로 progress trail */
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
