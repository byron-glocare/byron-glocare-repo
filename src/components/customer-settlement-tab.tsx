"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Check,
  Gift,
  Loader2,
  MinusCircle,
  Package,
  Plus,
  Receipt,
  Trash2,
  Users,
  X,
} from "lucide-react";

import {
  createReservationPayment,
  updateReservationPayment,
  deleteReservationPayment,
  createEventPayment,
  deleteEventPayment,
  upsertWelcomePackPayment,
} from "@/app/(app)/customers/settlement-actions";
import {
  computeSettlementSummary,
  computeWelcomePackAmounts,
  suggestWelcomePackInterim,
  type SettlementFlag,
} from "@/lib/settlement";
import type {
  Customer,
  ReservationPayment,
  CommissionPayment,
  EventPayment,
  WelcomePackPayment,
  TrainingCenter,
} from "@/types/database";
import type { Json } from "@/types/database";
import { formatCurrency, formatDate } from "@/lib/format";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValueMap,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// =============================================================================
// Props
// =============================================================================

type Settings = Record<string, Json | undefined>;

type Props = {
  customer: Customer;
  reservationPayments: ReservationPayment[];
  commissionPayments: CommissionPayment[];
  eventPayments: EventPayment[];
  welcomePackPayment: WelcomePackPayment | null;
  trainingCenters: Pick<TrainingCenter, "id" | "name" | "region">[];
  /** 친구 소개용 고객 목록 (id, code, name_kr, name_vi) */
  customerOptions: {
    id: string;
    code: string;
    name_kr: string | null;
    name_vi: string | null;
  }[];
  settings: Settings;
};

export function CustomerSettlementTab({
  customer,
  reservationPayments,
  commissionPayments,
  eventPayments,
  welcomePackPayment,
  trainingCenters,
  customerOptions,
  settings,
}: Props) {
  const summary = computeSettlementSummary({
    customer,
    reservationPayments,
    commissionPayments,
    eventPayments,
    welcomePackPayment,
  });

  // education_reservation_amount (신규) 우선, 없으면 legacy training_reservation_fee
  const trainingReservationFee = toNumber(
    settings.education_reservation_amount ?? settings.training_reservation_fee,
    35000
  );
  const welcomePackReservationFee = toNumber(
    settings.welcome_pack_reservation_fee,
    100000
  );
  const welcomePackPrice = toNumber(settings.welcome_pack_price, 1500000);
  const welcomePackEarlyDiscount = toNumber(
    settings.welcome_pack_early_discount,
    300000
  );
  const eventTypes = toStringArray(settings.event_types, [
    "친구 소개",
    "등록 할인",
    "교통비 지원",
    "기타",
  ]);
  const giftTypes = toStringArray(settings.gift_types, [
    "쿠팡상품권",
    "현금",
    "기타",
  ]);

  return (
    <div className="space-y-6">
      {/* 요약 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">정산 요약</CardTitle>
          <CardDescription>
            4종 정산 상태 — 개발지시서 §5.2 자동 계산
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <SummaryBadge label="예약금 입금" flag={summary.reservation} />
          <SummaryBadge label="소개비 정산" flag={summary.commission} />
          <SummaryBadge label="이벤트 정산" flag={summary.event} />
          <SummaryBadge label="웰컴팩 정산" flag={summary.welcomePack} />
        </CardContent>
      </Card>

      {/* 교육 예약금 — product_type 에 따라 활성 */}
      <ReservationPaymentsCard
        customerId={customer.id}
        payments={reservationPayments}
        defaultAmount={trainingReservationFee}
        productType={customer.product_type}
        welcomePackReservationPaid={!!welcomePackPayment?.reservation_date}
      />

      {/* 소개비(commission_payments) 는 /settlements 페이지에서 교육원×월
          단위로 관리 — 여기 UI 없음. 정산 요약 뱃지는 위쪽에서 commissionPayments
          prop 을 받아 자동 계산. */}

      {/* 이벤트 */}
      <EventPaymentsCard
        customerId={customer.id}
        payments={eventPayments}
        customerOptions={customerOptions.filter((c) => c.id !== customer.id)}
        eventTypes={eventTypes}
        giftTypes={giftTypes}
      />

      {/* 웰컴팩 */}
      <WelcomePackPaymentCard
        customer={customer}
        payment={welcomePackPayment}
        trainingCenters={trainingCenters}
        defaultTotalPrice={welcomePackPrice}
        defaultDiscount={welcomePackEarlyDiscount}
        defaultReservation={welcomePackReservationFee}
      />
    </div>
  );
}

// =============================================================================
// 요약 뱃지
// =============================================================================

function SummaryBadge({
  label,
  flag,
}: {
  label: string;
  flag: SettlementFlag;
}) {
  const cls =
    flag === "완료"
      ? "bg-success/10 text-success border-success/20"
      : flag === "미완료"
        ? "bg-warning/10 text-warning border-warning/20"
        : "bg-muted text-muted-foreground border-border";
  const Icon = flag === "완료" ? Check : flag === "미완료" ? X : MinusCircle;

  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-card p-3">
      <div className="flex-1 min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm font-medium mt-0.5">
          <Badge variant="outline" className={cls}>
            <Icon className="size-3" />
            {flag}
          </Badge>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// 예약 결제 카드
// =============================================================================

function ReservationPaymentsCard({
  customerId,
  payments,
  defaultAmount,
  productType,
  welcomePackReservationPaid,
}: {
  customerId: string;
  payments: ReservationPayment[];
  defaultAmount: number;
  productType: Customer["product_type"];
  welcomePackReservationPaid: boolean;
}) {
  // 교육 예약금 활성 조건:
  //  - product_type 이 "교육" 또는 "교육+웰컴팩" (웰컴팩 only 는 비활성)
  //  - 웰컴팩 예약금 미납 (납부했으면 교육 예약금 면제)
  const productAllowsEducation =
    productType === "교육" || productType === "교육+웰컴팩";
  const exemptByWelcomePack = welcomePackReservationPaid;
  const addDisabled = !productAllowsEducation || exemptByWelcomePack;
  const disabledReason = !productAllowsEducation
    ? `상품 '${productType ?? "없음"}' — 교육 예약금 대상 아님`
    : exemptByWelcomePack
      ? "웰컴팩 예약금 납부로 교육 예약금 면제"
      : null;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const amount = Number(form.get("amount")) || 0;
    const payment_date = (form.get("payment_date") as string) || null;

    startTransition(async () => {
      const result = await createReservationPayment(customerId, {
        amount,
        payment_date,
        refund_amount: 0,
        refund_date: null,
        refund_reason: null,
      });
      if (result.ok) {
        toast.success("예약 결제가 추가되었습니다.");
        setShowAdd(false);
        router.refresh();
      } else {
        toast.error("추가 실패", { description: result.error });
      }
    });
  }

  async function onUpdateRefund(
    p: ReservationPayment,
    patch: {
      refund_amount?: number;
      refund_date?: string | null;
      refund_reason?: ReservationPayment["refund_reason"];
    }
  ) {
    startTransition(async () => {
      const result = await updateReservationPayment(p.id, customerId, {
        amount: p.amount,
        payment_date: p.payment_date,
        refund_amount: patch.refund_amount ?? p.refund_amount,
        refund_date:
          patch.refund_date !== undefined ? patch.refund_date : p.refund_date,
        refund_reason:
          patch.refund_reason !== undefined
            ? patch.refund_reason
            : p.refund_reason,
      });
      if (result.ok) {
        toast.success("저장되었습니다.");
        router.refresh();
      } else {
        toast.error("저장 실패", { description: result.error });
      }
    });
  }

  async function onDelete(id: string) {
    setDeleteId(id);
    const result = await deleteReservationPayment(id, customerId);
    if (result.ok) {
      toast.success("삭제되었습니다.");
      router.refresh();
    } else {
      toast.error("삭제 실패", { description: result.error });
    }
    setDeleteId(null);
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="size-4" />
            교육 예약금
          </CardTitle>
          <CardDescription>
            기본 금액 {formatCurrency(defaultAmount)}
            {disabledReason && (
              <span className="ml-2 text-warning">· {disabledReason}</span>
            )}
          </CardDescription>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowAdd((v) => !v)}
          disabled={addDisabled}
        >
          <Plus className="size-3" />
          추가
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {showAdd && (
          <form
            onSubmit={onAdd}
            className="grid sm:grid-cols-3 gap-3 items-end rounded-md border border-border p-3 bg-muted/30"
          >
            <div>
              <Label className="text-xs">금액</Label>
              <Input
                type="number"
                name="amount"
                defaultValue={defaultAmount}
                min={0}
              />
            </div>
            <div>
              <Label className="text-xs">입금일</Label>
              <Input type="date" name="payment_date" />
            </div>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              등록
            </Button>
          </form>
        )}

        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border rounded-md">
            예약 결제 이력이 없습니다.
          </p>
        ) : (
          <div className="overflow-hidden rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">금액</TableHead>
                  <TableHead className="w-32">입금일</TableHead>
                  <TableHead>환불 사유</TableHead>
                  <TableHead className="w-24">환불 금액</TableHead>
                  <TableHead className="w-32">환불일</TableHead>
                  <TableHead className="w-14" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      {formatCurrency(p.amount)}
                    </TableCell>
                    <TableCell>{formatDate(p.payment_date)}</TableCell>
                    <TableCell>
                      <Select
                        value={p.refund_reason ?? "__none__"}
                        onValueChange={(v) =>
                          onUpdateRefund(p, {
                            refund_reason:
                              v === "__none__"
                                ? null
                                : (v as ReservationPayment["refund_reason"]),
                          })
                        }
                      >
                        <SelectTrigger className="h-8">
                          <SelectValueMap
                            map={{
                              "__none__": "환불 없음",
                              "중도탈락_매출인식": "중도탈락 → 매출 인식",
                              "교육생환급_공제없음": "교육생 환급 (공제 없음)",
                              "소개비_공제": "소개비 공제",
                              "교육원섭외실패_환불": "교육원 섭외 실패 환불",
                            }}
                            placeholder="환불 없음"
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">환불 없음</SelectItem>
                          <SelectItem value="중도탈락_매출인식">
                            중도탈락 → 매출 인식
                          </SelectItem>
                          <SelectItem value="교육생환급_공제없음">
                            교육생 환급 (공제 없음)
                          </SelectItem>
                          <SelectItem value="소개비_공제">
                            소개비 공제
                          </SelectItem>
                          <SelectItem value="교육원섭외실패_환불">
                            교육원 섭외 실패 환불
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        defaultValue={p.refund_amount}
                        className="h-8"
                        min={0}
                        onBlur={(e) => {
                          const v = Number(e.target.value) || 0;
                          if (v !== p.refund_amount) {
                            onUpdateRefund(p, { refund_amount: v });
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="date"
                        defaultValue={p.refund_date ?? ""}
                        className="h-8"
                        onBlur={(e) => {
                          const v = e.target.value || null;
                          if (v !== p.refund_date) {
                            onUpdateRefund(p, { refund_date: v });
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(p.id)}
                        disabled={deleteId === p.id}
                        className="text-destructive hover:text-destructive hover:bg-destructive/5"
                      >
                        {deleteId === p.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Trash2 className="size-4" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// =============================================================================
// 이벤트 카드
// =============================================================================

function EventPaymentsCard({
  customerId,
  payments,
  customerOptions,
  eventTypes,
  giftTypes,
}: {
  customerId: string;
  payments: EventPayment[];
  customerOptions: {
    id: string;
    code: string;
    name_kr: string | null;
    name_vi: string | null;
  }[];
  eventTypes: string[];
  giftTypes: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [eventType, setEventType] = useState(eventTypes[0] ?? "친구 소개");
  const [friendId, setFriendId] = useState<string>("");

  function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const amount = Number(form.get("amount")) || 0;
    const gift_type = (form.get("gift_type") as string) || null;

    // 친구 소개 선택했는데 친구 미선택 → 거부
    if (eventType === "친구 소개" && !friendId) {
      toast.error("친구 소개 선택 시 친구 고객을 선택해주세요.");
      return;
    }

    startTransition(async () => {
      const result = await createEventPayment(customerId, {
        event_type: eventType,
        amount,
        gift_type,
        friend_customer_id:
          eventType === "친구 소개" && friendId ? friendId : null,
        gift_given: false,
        gift_given_date: null,
      });
      if (result.ok) {
        toast.success(
          eventType === "친구 소개" && friendId
            ? "친구 소개 이벤트가 양쪽에 등록되었습니다."
            : "이벤트가 추가되었습니다."
        );
        setShowAdd(false);
        setFriendId("");
        router.refresh();
      } else {
        toast.error("추가 실패", { description: result.error });
      }
    });
  }

  async function onDelete(id: string) {
    const result = await deleteEventPayment(id, customerId);
    if (result.ok) {
      toast.success("삭제되었습니다.");
      router.refresh();
    } else {
      toast.error("삭제 실패", { description: result.error });
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Gift className="size-4" />
            이벤트
          </CardTitle>
          <CardDescription>
            친구 소개 선택 시 상대 고객 계정에도 자동 등록
          </CardDescription>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowAdd((v) => !v)}
        >
          <Plus className="size-3" />
          추가
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {showAdd && (
          <form
            onSubmit={onAdd}
            className="grid sm:grid-cols-3 gap-3 items-end rounded-md border border-border p-3 bg-muted/30"
          >
            <div>
              <Label className="text-xs">종류</Label>
              <Select
                value={eventType}
                onValueChange={(v) => setEventType(v ?? eventTypes[0] ?? "")}
              >
                <SelectTrigger>
                  <SelectValueMap
                    map={Object.fromEntries(eventTypes.map((t) => [t, t]))}
                    placeholder="선택"
                  />
                </SelectTrigger>
                <SelectContent>
                  {eventTypes.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">금액</Label>
              <Input type="number" name="amount" min={0} />
            </div>
            <div>
              <Label className="text-xs">상품권 종류</Label>
              <select
                name="gift_type"
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">—</option>
                {giftTypes.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
            {eventType === "친구 소개" && (
              <div className="sm:col-span-2">
                <Label className="text-xs">친구 (상대 고객)</Label>
                <Select
                  value={friendId}
                  onValueChange={(v) => setFriendId(v ?? "")}
                >
                  <SelectTrigger>
                    <SelectValueMap
                      map={Object.fromEntries(
                        customerOptions.map((c) => [
                          c.id,
                          `${c.code} · ${c.name_kr || c.name_vi || "(이름 없음)"}`,
                        ])
                      )}
                      placeholder="선택"
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {customerOptions.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.code} · {c.name_kr || c.name_vi || "(이름 없음)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button
              type="submit"
              disabled={pending}
              className={eventType === "친구 소개" ? "sm:col-span-1" : "sm:col-span-3"}
            >
              {pending && <Loader2 className="size-4 animate-spin" />}
              등록
            </Button>
          </form>
        )}

        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border rounded-md">
            이벤트 레코드가 없습니다.
          </p>
        ) : (
          <div className="overflow-hidden rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">종류</TableHead>
                  <TableHead className="w-24 text-right">금액</TableHead>
                  <TableHead className="w-28">상품권</TableHead>
                  <TableHead className="w-40">친구</TableHead>
                  <TableHead className="w-24 text-center">지급 여부</TableHead>
                  <TableHead className="w-14" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Badge variant="outline">{p.event_type}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(p.amount)}
                    </TableCell>
                    <TableCell>{p.gift_type ?? "—"}</TableCell>
                    <TableCell className="text-sm">
                      {p.friend_customer_id
                        ? customerOptions.find(
                            (c) => c.id === p.friend_customer_id
                          )?.code ?? "—"
                        : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {p.gift_given ? (
                        <Badge className="bg-success/10 text-success border-success/20">
                          지급
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          미지급
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(p.id)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/5"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// =============================================================================
// 웰컴팩 카드
// =============================================================================

function WelcomePackPaymentCard({
  customer,
  payment,
  trainingCenters,
  defaultTotalPrice,
  defaultDiscount,
  defaultReservation,
}: {
  customer: Customer;
  payment: WelcomePackPayment | null;
  trainingCenters: Pick<TrainingCenter, "id" | "name" | "region">[];
  defaultTotalPrice: number;
  defaultDiscount: number;
  defaultReservation: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const targetCenter = trainingCenters.find(
    (c) => c.id === customer.training_center_id
  );
  const suggested = suggestWelcomePackInterim(targetCenter?.region ?? null);

  // 상태 (초기값: 기존 payment or default)
  const [totalPrice, setTotalPrice] = useState<number>(
    payment?.total_price ?? defaultTotalPrice
  );
  const [discount, setDiscount] = useState<number>(
    payment?.discount_amount ?? defaultDiscount
  );
  const [reservation, setReservation] = useState<number>(
    payment?.reservation_amount ?? defaultReservation
  );
  const [reservationDate, setReservationDate] = useState<string>(
    payment?.reservation_date ?? ""
  );
  const [interim, setInterim] = useState<number>(
    payment?.interim_amount ?? suggested ?? 0
  );
  const [interimDate, setInterimDate] = useState<string>(
    payment?.interim_date ?? ""
  );
  const [balance, setBalance] = useState<number>(payment?.balance_amount ?? 0);
  const [balanceDate, setBalanceDate] = useState<string>(
    payment?.balance_date ?? ""
  );
  const [salesReported, setSalesReported] = useState<boolean>(
    payment?.sales_reported ?? false
  );
  const [salesReportedDate, setSalesReportedDate] = useState<string>(
    payment?.sales_reported_date ?? ""
  );

  const { finalAmount, balanceAmount: calculatedBalance } =
    computeWelcomePackAmounts(totalPrice, discount, reservation, interim);

  const isWelcomePackTarget =
    customer.product_type === "웰컴팩" || customer.product_type === "교육+웰컴팩";

  async function onSave() {
    startTransition(async () => {
      const result = await upsertWelcomePackPayment(customer.id, {
        total_price: totalPrice,
        discount_amount: discount,
        reservation_amount: reservation,
        reservation_date: reservationDate || null,
        interim_amount: interim,
        interim_date: interimDate || null,
        balance_amount: balance || calculatedBalance,
        balance_date: balanceDate || null,
        sales_reported: salesReported,
        sales_reported_date: salesReportedDate || null,
      });
      if (result.ok) {
        toast.success("웰컴팩 결제가 저장되었습니다.");
        router.refresh();
      } else {
        toast.error("저장 실패", { description: result.error });
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Package className="size-4" />
          웰컴팩 결제 (3회차 분할)
        </CardTitle>
        <CardDescription>
          {isWelcomePackTarget
            ? "상품에 웰컴팩 포함 — 예약 → 잔금1 → 잔금2 순서로 진행"
            : `상품 '${customer.product_type ?? "없음"}' — 웰컴팩 대상이 아닙니다. 상품을 '웰컴팩' 또는 '교육+웰컴팩'으로 변경하세요.`}
        </CardDescription>
      </CardHeader>
      <CardContent className={isWelcomePackTarget ? "space-y-5" : "opacity-60 pointer-events-none space-y-5"}>
        {/* 정가 + 할인 */}
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">정가</Label>
            <Input
              type="number"
              value={totalPrice}
              onChange={(e) => setTotalPrice(Number(e.target.value) || 0)}
              min={0}
            />
          </div>
          <div>
            <Label className="text-xs">할인 (예약 시 즉시)</Label>
            <Input
              type="number"
              value={discount}
              onChange={(e) => setDiscount(Number(e.target.value) || 0)}
              min={0}
            />
          </div>
          <div>
            <Label className="text-xs">최종 결제액 (자동)</Label>
            <Input value={formatCurrency(finalAmount)} readOnly className="bg-muted" />
          </div>
        </div>

        {/* 3회차 분할 */}
        <div className="rounded-md border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">회차</TableHead>
                <TableHead>금액</TableHead>
                <TableHead>결제일</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">1회차 (예약금)</TableCell>
                <TableCell>
                  <Input
                    type="number"
                    value={reservation}
                    onChange={(e) => setReservation(Number(e.target.value) || 0)}
                    min={0}
                    className="h-8"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="date"
                    value={reservationDate}
                    onChange={(e) => setReservationDate(e.target.value)}
                    className="h-8"
                  />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">
                  2회차 (잔금1)
                  {suggested && suggested !== interim && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      추천: {formatCurrency(suggested)}
                      <button
                        type="button"
                        onClick={() => setInterim(suggested)}
                        className="ml-2 text-primary hover:underline"
                      >
                        적용
                      </button>
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <Select
                    value={String(interim)}
                    onValueChange={(v) => setInterim(Number(v))}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValueMap
                        map={{
                          "0": "0원",
                          "250000": "250,000원 (서울권)",
                          "300000": "300,000원 (충청권)",
                          "350000": "350,000원 (원거리)",
                        }}
                        placeholder="선택"
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0원</SelectItem>
                      <SelectItem value="250000">250,000원 (서울권)</SelectItem>
                      <SelectItem value="300000">300,000원 (충청권)</SelectItem>
                      <SelectItem value="350000">350,000원 (원거리)</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Input
                    type="date"
                    value={interimDate}
                    onChange={(e) => setInterimDate(e.target.value)}
                    className="h-8"
                  />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">
                  3회차 (잔금2)
                  <div className="text-xs text-muted-foreground mt-0.5">
                    자동 계산: {formatCurrency(calculatedBalance)}
                  </div>
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    value={balance || calculatedBalance}
                    onChange={(e) => setBalance(Number(e.target.value) || 0)}
                    min={0}
                    className="h-8"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="date"
                    value={balanceDate}
                    onChange={(e) => setBalanceDate(e.target.value)}
                    className="h-8"
                  />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {/* 매출 보고 */}
        <div className="flex flex-wrap items-center gap-4 p-3 rounded-md border border-border">
          <div className="flex items-center gap-2">
            <Label className="text-sm">매출 보고 완료</Label>
            <Switch checked={salesReported} onCheckedChange={setSalesReported} />
          </div>
          {salesReported && (
            <div className="flex items-center gap-2">
              <Label className="text-xs">보고일</Label>
              <Input
                type="date"
                value={salesReportedDate}
                onChange={(e) => setSalesReportedDate(e.target.value)}
                className="h-8 w-40"
              />
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button type="button" onClick={onSave} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            저장
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// 유틸
// =============================================================================

function toNumber(v: Json | undefined, fallback: number): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function toStringArray(v: Json | undefined, fallback: string[]): string[] {
  if (Array.isArray(v) && v.every((x) => typeof x === "string")) {
    return v as string[];
  }
  return fallback;
}
