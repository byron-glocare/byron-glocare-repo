"use client";

/**
 * [시안] 5번째 탭 — 한 화면 통합 뷰.
 * 4개 탭에 흩어진 정보를 영역별 collapsible 카드로 한 페이지에 모은다.
 *
 * 의도:
 *  - 평균 4개월 동안 자주 들락날락하며 업데이트하는 관리자가
 *    "지금 이 사람 어디까지 왔지 / 뭐 해야 하지" 를 한눈에 파악
 *  - 영역 닫기/열기로 스크롤 부담 줄임
 *  - 편집 액션은 해당 탭으로 점프 (이 탭은 read-friendly 요약)
 */

import { useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Briefcase,
  Building2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  GraduationCap,
  Hospital,
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
import { dash, formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  CareHome,
  CommissionPayment,
  Consultation,
  Customer,
  EventPayment,
  ReservationPayment,
  TrainingCenter,
  TrainingClass,
  WelcomePackPayment,
} from "@/types/database";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

type Props = {
  customer: Customer;
  progressInputs: StatusInputs;
  consultations: Consultation[];
  reservationPayments: ReservationPayment[];
  welcomePackPayment: WelcomePackPayment | null;
  commissionPayments: CommissionPayment[];
  eventPayments: EventPayment[];
  trainingCenters: Pick<TrainingCenter, "id" | "name" | "region">[];
  trainingClasses: Pick<
    TrainingClass,
    "id" | "year" | "month" | "class_type" | "start_date" | "end_date"
  >[];
  careHomes: Pick<CareHome, "id" | "name" | "region">[];
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
}: Props) {
  const summary = computeCustomerStatus(progressInputs);

  const trainingCenter = customer.training_center_id
    ? trainingCenters.find((c) => c.id === customer.training_center_id)
    : null;
  const trainingClass = customer.training_class_id
    ? trainingClasses.find((c) => c.id === customer.training_class_id)
    : null;
  const careHome = customer.care_home_id
    ? careHomes.find((c) => c.id === customer.care_home_id)
    : null;

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

      {/* === 영역별 collapsible === */}
      <SectionCard
        icon={<User className="size-4" />}
        title="기본 정보 / 희망 조건"
        defaultOpen={false}
        editHref={`?tab=basic`}
      >
        <DataGrid
          rows={[
            ["이름 (한)", customer.name_kr],
            ["이름 (베)", customer.name_vi],
            ["전화", customer.phone],
            ["이메일", customer.email],
            ["성별", customer.gender],
            ["생년", customer.birth_year],
            ["주소", customer.address],
            ["비자", customer.visa_type],
            ["TOPIK", customer.topik_level],
            ["체류 남은기간", customer.stay_remaining],
            ["희망 기간", customer.desired_period],
            ["희망 시간대", customer.desired_time],
            ["희망 지역", customer.desired_region],
          ]}
        />
      </SectionCard>

      <SectionCard
        icon={<GraduationCap className="size-4" />}
        title="교육"
        subtitle={
          summary.training.complete
            ? "자격증 취득"
            : summary.trainingReservation.complete
              ? "교육 진행 중"
              : "교육 예약 단계"
        }
        defaultOpen={
          summary.currentStage === "교육예약중" ||
          summary.currentStage === "교육중"
        }
        editHref={`?tab=basic`}
      >
        <DataGrid
          rows={[
            [
              "교육원",
              trainingCenter
                ? `${trainingCenter.name}${trainingCenter.region ? ` (${trainingCenter.region})` : ""}`
                : null,
            ],
            [
              "강의 일정",
              trainingClass
                ? `${trainingClass.year}년 ${trainingClass.month}월 — ${trainingClass.class_type === "weekday" ? "주간" : "야간"}`
                : null,
            ],
            [
              "강의 시작 — 종료",
              trainingClass?.start_date && trainingClass?.end_date
                ? `${trainingClass.start_date} ~ ${trainingClass.end_date}`
                : null,
            ],
            ["교육 진행 phase", summary.training.phase ?? "—"],
            [
              "예약금 입금",
              summary.trainingReservation.reservationPaid ? "✓" : "—",
            ],
            ["강의 접수 SMS 발송", summary.trainingReservation.smsSent ? "✓" : "—"],
            ["자격증 취득", summary.training.certificateAcquired ? "✓" : "—"],
            ["교육 드랍", summary.training.dropped ? "⚠" : "—"],
          ]}
        />
        {/* 예약금 결제 요약 */}
        {reservationPayments.length > 0 && (
          <div className="mt-3 border-t border-border pt-3">
            <div className="text-xs font-medium text-muted-foreground mb-1.5">
              교육 예약금 결제
            </div>
            <ul className="space-y-1 text-xs">
              {reservationPayments.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between"
                >
                  <span>{formatDate(p.payment_date)}</span>
                  <span className="font-mono">{formatCurrency(p.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </SectionCard>

      <SectionCard
        icon={<Hospital className="size-4" />}
        title="취업"
        subtitle={
          summary.employment.complete
            ? "취업 완료"
            : summary.employment.careHomeMatched
              ? "면접/이력서 진행"
              : "요양원 매칭 단계"
        }
        defaultOpen={summary.currentStage === "취업중"}
        editHref={`?tab=basic`}
      >
        <DataGrid
          rows={[
            [
              "요양원",
              careHome
                ? `${careHome.name}${careHome.region ? ` (${careHome.region})` : ""}`
                : null,
            ],
            ["건강검진 완료", progressInputs.status.health_check_completed ? "✓" : "—"],
            ["요양원 발굴 중", progressInputs.status.care_home_finding ? "⏳" : "—"],
            ["면접일", customer.interview_date],
            ["면접 phase", summary.employment.interviewPhase ?? "—"],
            ["이력서 발송", summary.employment.resumeSent ? "✓" : "—"],
            ["면접 합격", summary.employment.interviewPassed ? "✓" : "—"],
            [
              "웰컴팩 예약금",
              summary.employment.welcomePackReservationPaid ? "✓" : "—",
            ],
            [
              "웰컴팩 예약 포기",
              summary.employment.welcomePackAbandoned ? "⚠" : "—",
            ],
          ]}
        />
        {welcomePackPayment && (
          <div className="mt-3 border-t border-border pt-3">
            <div className="text-xs font-medium text-muted-foreground mb-1.5">
              웰컴팩 결제
            </div>
            <ul className="space-y-1 text-xs">
              <li className="flex items-center justify-between">
                <span>예약금 입금일</span>
                <span>{formatDate(welcomePackPayment.reservation_date)}</span>
              </li>
            </ul>
          </div>
        )}
      </SectionCard>

      <SectionCard
        icon={<Briefcase className="size-4" />}
        title="근무"
        subtitle={summary.work.workPhase ?? "근무 시작 전"}
        defaultOpen={
          summary.currentStage === "근무중" ||
          summary.currentStage === "근무종료"
        }
        editHref={`?tab=basic`}
      >
        <DataGrid
          rows={[
            ["근무 시작일", customer.work_start_date],
            ["근무 종료일", customer.work_end_date],
            ["근무 phase", summary.work.workPhase ?? "—"],
            ["비자변경일", customer.visa_change_date],
            ["비자변경 phase", summary.work.visaChangePhase ?? "—"],
            ["종료 사유", customer.termination_reason],
          ]}
        />
      </SectionCard>

      <SectionCard
        icon={<Receipt className="size-4" />}
        title="정산 요약"
        subtitle={`소개비 ${commissionPayments.length}건 · 친구소개 ${eventPayments.length}건`}
        defaultOpen={false}
        editHref={`?tab=settlement`}
      >
        {commissionPayments.length === 0 &&
        eventPayments.length === 0 &&
        !welcomePackPayment ? (
          <div className="text-xs text-muted-foreground">정산 내역 없음</div>
        ) : (
          <div className="space-y-3 text-xs">
            {commissionPayments.length > 0 && (
              <div>
                <div className="font-medium text-muted-foreground mb-1">
                  교육원 소개비
                </div>
                <ul className="space-y-1">
                  {commissionPayments.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between"
                    >
                      <span>
                        {p.settlement_month?.slice(0, 7)} ·{" "}
                        <span
                          className={
                            p.status === "abandoned"
                              ? "text-destructive"
                              : "text-success"
                          }
                        >
                          {p.status === "abandoned" ? "수금 포기" : "완료"}
                        </span>
                      </span>
                      <span className="font-mono">
                        {formatCurrency(
                          Math.max(0, p.total_amount - p.deduction_amount)
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {eventPayments.length > 0 && (
              <div>
                <div className="font-medium text-muted-foreground mb-1">
                  친구 소개 / 이벤트
                </div>
                <ul className="space-y-1">
                  {eventPayments.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between"
                    >
                      <span>{p.event_type}</span>
                      <span className="font-mono">
                        {formatCurrency(p.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </SectionCard>

      <SectionCard
        icon={<MessageCircle className="size-4" />}
        title="상담 일지"
        subtitle={`총 ${consultations.length}건`}
        defaultOpen={true}
        editHref={`?tab=consultations`}
      >
        {consultations.length === 0 ? (
          <div className="text-xs text-muted-foreground">상담 일지 없음</div>
        ) : (
          <ol className="space-y-3 border-l-2 border-border pl-4 ml-1">
            {consultations.slice(0, 8).map((c) => (
              <li key={c.id} className="relative">
                <span className="absolute -left-[1.4rem] top-1 size-2.5 rounded-full bg-primary" />
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{formatDate(c.created_at?.slice(0, 10) ?? "")}</span>
                  {c.consultation_type && (
                    <Badge variant="outline" className="text-[10px] py-0">
                      {c.consultation_type === "training_center"
                        ? "교육원"
                        : "요양원"}
                    </Badge>
                  )}
                </div>
                <div className="mt-1 text-sm whitespace-pre-wrap line-clamp-3">
                  {c.content_kr || c.content_vi || "—"}
                </div>
                {Array.isArray(c.tags) && c.tags.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {c.tags.slice(0, 5).map((t, i) => (
                      <Badge
                        key={`${c.id}-${i}`}
                        variant="outline"
                        className="text-[10px] py-0 bg-info/5 text-info border-info/20"
                      >
                        {String(t)}
                      </Badge>
                    ))}
                  </div>
                )}
              </li>
            ))}
            {consultations.length > 8 && (
              <li className="text-xs text-muted-foreground">
                외 {consultations.length - 8}건 — 상담 일지 탭에서 전체 보기
              </li>
            )}
          </ol>
        )}
      </SectionCard>
    </div>
  );
}

// =============================================================================
// 부속 컴포넌트
// =============================================================================

function SectionCard({
  icon,
  title,
  subtitle,
  defaultOpen = false,
  editHref,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  /** 클릭 시 해당 탭으로 점프 (?tab=...) */
  editHref?: string;
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
        {editHref && (
          <Link
            href={editHref}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "h-7 px-2 text-xs"
            )}
          >
            편집 탭으로 →
          </Link>
        )}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-border bg-muted/10">
          {children}
        </div>
      )}
    </Card>
  );
}

function DataGrid({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1.5 text-sm">
      {rows.map(([label, value]) => (
        <div
          key={label}
          className="flex items-center justify-between gap-3 py-1 border-b border-border/50 last:border-0"
        >
          <dt className="text-xs text-muted-foreground shrink-0">{label}</dt>
          <dd className="text-right truncate">
            {value === null || value === undefined || value === "" ? (
              <span className="text-muted-foreground/60">—</span>
            ) : (
              <span>{String(value)}</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
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
