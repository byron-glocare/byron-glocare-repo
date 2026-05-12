"use client";

/**
 * 고객 상세 페이지 — 4탭 통합 + 페이지 레벨 저장 버튼.
 *
 * 기본 정보 / 진행 단계 두 탭은 form 성격이라 변경사항을 페이지 레벨에서
 * 모은다. 저장 버튼 한 번 누르면 두 탭의 dirty 변경을 일괄 commit.
 *
 * 상담 일지 / 정산 탭은 별도 entity (즉시 저장 유지) — 페이지 저장과 무관.
 *
 * 동작:
 *  - 탭 이동해도 form state 보존 (Tabs.Panel keepMounted)
 *  - 페이지 이탈 시 dirty 면 브라우저 경고
 *  - 저장 후 이전 화면 복귀
 */

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save, Trash2 } from "lucide-react";

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
import { CustomerOverviewTab } from "@/components/customer-overview-tab";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
  EventPayment,
  ReservationPayment,
  TrainingCenter,
  TrainingClass,
  WelcomePackPayment,
  CommissionPayment,
  Json,
} from "@/types/database";

type Props = {
  initialTab:
    | "basic"
    | "progress"
    | "consultations"
    | "settlement"
    | "overview";
  customer: Customer;
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
  progressInputs: StatusInputs;
  careHomeLocked: boolean;
  settings: Record<string, Json | undefined>;
};

export function CustomerEditTabs({
  initialTab,
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
  careHomeLocked,
  settings,
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
      // 일부 브라우저는 returnValue 가 truthy 여야 경고
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
    // 성공 시 redirect 발생 (서버에서 redirect("/customers"))
  }

  return (
    <>
      <Tabs defaultValue={initialTab} className="w-full">
        <TabsList className="grid grid-cols-5 w-full h-10">
          <TabsTrigger
            value="progress"
            className="text-sm data-active:bg-primary data-active:text-primary-foreground data-active:font-semibold"
          >
            진행 단계
            {progressDirty && <DirtyDot />}
          </TabsTrigger>
          <TabsTrigger
            value="basic"
            className="text-sm data-active:bg-primary data-active:text-primary-foreground data-active:font-semibold"
          >
            기본 정보
            {basicDirty && <DirtyDot />}
          </TabsTrigger>
          <TabsTrigger
            value="consultations"
            className="text-sm data-active:bg-primary data-active:text-primary-foreground data-active:font-semibold"
          >
            상담 일지
          </TabsTrigger>
          <TabsTrigger
            value="settlement"
            className="text-sm data-active:bg-primary data-active:text-primary-foreground data-active:font-semibold"
          >
            정산
          </TabsTrigger>
          <TabsTrigger
            value="overview"
            className="text-sm data-active:bg-primary data-active:text-primary-foreground data-active:font-semibold"
          >
            한눈에 보기
            <Badge
              variant="outline"
              className="ml-1.5 text-[9px] py-0 px-1 bg-info/10 text-info border-info/20"
            >
              시안
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="mt-6" keepMounted>
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
        </TabsContent>

        <TabsContent value="progress" className="mt-6" keepMounted>
          <CustomerProgressTab
            customerId={customer.id}
            inputs={progressInputs}
            embedded
            ref={progressRef}
            onDirtyChange={setProgressDirty}
          />
        </TabsContent>

        <TabsContent value="consultations" className="mt-6" keepMounted>
          <CustomerConsultationsTab
            customerId={customer.id}
            consultations={consultations}
          />
        </TabsContent>

        <TabsContent value="settlement" className="mt-6" keepMounted>
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
        </TabsContent>

        <TabsContent value="overview" className="mt-6" keepMounted>
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
            careHomeLocked={careHomeLocked}
            settings={settings}
          />
        </TabsContent>
      </Tabs>

      {/* 페이지 레벨 액션 (sticky bottom) */}
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

function DirtyDot() {
  return (
    <span
      className="ml-1 inline-block size-1.5 rounded-full bg-warning"
      aria-label="변경사항 있음"
    />
  );
}
