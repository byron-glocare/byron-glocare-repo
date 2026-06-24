"use client";

/**
 * 고객 상세 페이지 — "한눈에 보기" 단일 화면 + sticky [저장 / 취소 / 삭제] 세트.
 *
 * 4탭 (기본정보 / 진행단계 / 상담 / 정산) 구조는 폐기. 한 화면의 영역별
 * collapsible 카드로 통합 — CustomerOverviewTab 이 본체.
 *
 * 기본 정보 / 진행 단계는 form 성격이라 dirty 추적 → 페이지 레벨 저장 버튼이
 * ref 통해 일괄 commit. 상담 / 정산은 별도 entity (즉시 저장 유지).
 */

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save, Trash2 } from "lucide-react";

import { CustomerOverviewTab } from "@/components/customer-overview-tab";
import type { CustomerBasicFormHandle } from "@/components/customer-basic-form";
import type { CustomerProgressTabHandle } from "@/components/customer-progress-tab";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { deleteCustomer } from "@/app/(app)/customers/actions";
import { navigateBackOrTo } from "@/lib/navigate-back";
import type { StatusInputs } from "@/lib/customer-status";
import type {
  CareHome,
  Customer,
  Consultation,
  CustomerReminder,
  EventPayment,
  ReservationPayment,
  TrainingCenter,
  TrainingClass,
  WelcomePackPayment,
  CommissionPayment,
  Json,
} from "@/types/database";

type Props = {
  customer: Customer;
  consultations: Consultation[];
  reservationPayments: ReservationPayment[];
  welcomePackPayment: WelcomePackPayment | null;
  commissionPayments: CommissionPayment[];
  eventPayments: EventPayment[];
  trainingCenters: Pick<
    TrainingCenter,
    | "id"
    | "code"
    | "name"
    | "region"
    | "tuition_fee_2026"
    | "deduct_reservation_by_default"
  >[];
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
  progressInputs: StatusInputs;
  reminders: CustomerReminder[];
  careHomeLocked: boolean;
  settings: Record<string, Json | undefined>;
  resumeDraft: {
    id: string;
    token: string;
    expires_at: string;
    submitted_at: string | null;
    data: Json;
    photo_path: string | null;
  } | null;
};

export function CustomerEditTabs({
  customer,
  consultations,
  reservationPayments,
  welcomePackPayment,
  commissionPayments,
  eventPayments,
  trainingCenters,
  trainingClasses,
  careHomes,
  customerOptions,
  progressInputs,
  reminders,
  careHomeLocked,
  settings,
  resumeDraft,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deleting, setDeleting] = useState(false);

  const basicRef = useRef<CustomerBasicFormHandle | null>(null);
  const progressRef = useRef<CustomerProgressTabHandle | null>(null);

  const [basicDirty, setBasicDirty] = useState(false);
  const [progressDirty, setProgressDirty] = useState(false);
  const dirty = basicDirty || progressDirty;

  // 페이지 이탈 시 dirty 면 브라우저 경고
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
      navigateBackOrTo(router, "/customers");
    });
  }

  function handleCancel() {
    if (dirty) {
      const ok = window.confirm(
        "저장하지 않은 변경사항이 있습니다. 정말 떠나시겠습니까?"
      );
      if (!ok) return;
    }
    navigateBackOrTo(router, "/customers");
  }

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteCustomer(customer.id);
    if (result && !result.ok) {
      toast.error("삭제 실패", { description: result.error });
      setDeleting(false);
    }
    // 성공 시 서버에서 redirect("/customers")
  }

  return (
    <>
      <CustomerOverviewTab
        customer={customer}
        progressInputs={progressInputs}
        consultations={consultations}
        reservationPayments={reservationPayments}
        welcomePackPayment={welcomePackPayment}
        commissionPayments={commissionPayments}
        eventPayments={eventPayments}
        trainingCenters={trainingCenters}
        trainingClasses={trainingClasses}
        careHomes={careHomes}
        customerOptions={customerOptions}
        reminders={reminders}
        careHomeLocked={careHomeLocked}
        settings={settings}
        resumeDraft={resumeDraft}
        basicRef={basicRef}
        progressRef={progressRef}
        basicDirty={basicDirty}
        progressDirty={progressDirty}
        onBasicDirtyChange={setBasicDirty}
        onProgressDirtyChange={setProgressDirty}
      />

      {/* 페이지 레벨 액션 (sticky bottom) — [삭제] / [취소] [저장] 세트 */}
      <div className="sticky bottom-0 -mx-6 mt-8 border-t border-border bg-background/95 backdrop-blur px-6 py-3 flex items-center justify-between gap-2">
        <Dialog>
          <DialogTrigger
            className="inline-flex h-9 items-center gap-2 rounded-md border border-destructive/30 bg-card px-3 text-sm font-medium text-destructive hover:bg-destructive/5 transition-colors"
            disabled={pending || deleting}
          >
            <Trash2 className="size-4" />
            삭제
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>고객 삭제</DialogTitle>
              <DialogDescription>
                이 고객과 관련된 모든 데이터(상담 일지, 결제, SMS 이력 등)가
                함께 삭제됩니다. 되돌릴 수 없습니다.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting && <Loader2 className="size-4 animate-spin" />}
                {deleting ? "삭제 중…" : "확인 — 영구 삭제"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {dirty
              ? "저장하지 않은 변경사항이 있습니다"
              : "변경사항 없음"}
          </span>
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={pending}
          >
            취소
          </Button>
          <Button
            type="button"
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
    </>
  );
}
