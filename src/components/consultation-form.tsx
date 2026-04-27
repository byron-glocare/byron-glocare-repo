"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save, Search, User, X } from "lucide-react";

import {
  createConsultationWithAnalysis,
  createCustomer,
  updateConsultation,
} from "@/app/(app)/customers/actions";
import { asciiUpper } from "@/lib/name-utils";
import type { ConsultationAnalysis } from "@/lib/consultation-tags";
import type { Customer } from "@/types/database";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { AnalysisReviewDialog } from "@/components/analysis-review-dialog";
import { navigateBackOrTo } from "@/lib/navigate-back";

type CustomerBrief = Pick<
  Customer,
  "id" | "code" | "name_vi" | "name_kr" | "phone"
>;

type Props =
  | {
      mode: "create";
      customers: CustomerBrief[];
      prefillCustomerId?: string;
    }
  | {
      mode: "edit";
      consultationId: string;
      customer: CustomerBrief;
      consultationType: "training_center" | "care_home";
      initialContent: string;
    };

export function ConsultationForm(props: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const initialCustomer = useMemo<CustomerBrief | null>(() => {
    if (props.mode === "edit") return props.customer;
    if (props.prefillCustomerId) {
      return (
        props.customers.find((c) => c.id === props.prefillCustomerId) ?? null
      );
    }
    return null;
  }, [props]);

  const [customer, setCustomer] = useState<CustomerBrief | null>(
    initialCustomer
  );
  // 상담 유형은 DB 제약상 남아있지만 UI 에선 숨김 — 기본값 'training_center'
  // (실제 구분은 AI 가 추출한 태그로 대체).
  const consultationType: "training_center" | "care_home" =
    props.mode === "edit" ? props.consultationType : "training_center";
  const [content, setContent] = useState(
    props.mode === "edit" ? props.initialContent : ""
  );
  const [query, setQuery] = useState("");

  // 신규 / 기존 고객 모드. create 모드 + 미리지정된 customer 가 없을 때만 의미.
  // prefillCustomerId 있으면 기존 모드로 시작.
  const [customerMode, setCustomerMode] = useState<"new" | "existing">(
    props.mode === "create" && !initialCustomer ? "new" : "existing"
  );
  // 신규 고객 입력 필드 (스텁 등록용)
  const [newNameVi, setNewNameVi] = useState("");
  const [newNameKr, setNewNameKr] = useState("");
  const [newPhone, setNewPhone] = useState("");

  // 분석 검토 다이얼로그 상태
  const [review, setReview] = useState<{
    customerId: string;
    analysis: ConsultationAnalysis;
  } | null>(null);

  const newCustomerHasMinInfo =
    !!(newNameVi.trim() || newNameKr.trim() || newPhone.trim());
  const canSave =
    !pending &&
    content.trim().length > 0 &&
    (props.mode === "edit" ||
      (customerMode === "existing" ? !!customer : newCustomerHasMinInfo));

  const filteredCustomers = useMemo<CustomerBrief[]>(() => {
    if (props.mode === "edit") return [];
    const q = query.trim().toLowerCase();
    if (!q) return props.customers.slice(0, 5);
    return props.customers
      .filter((c) => {
        return (
          c.code.toLowerCase().includes(q) ||
          (c.name_vi ?? "").toLowerCase().includes(q) ||
          (c.name_kr ?? "").toLowerCase().includes(q) ||
          (c.phone ?? "").toLowerCase().includes(q)
        );
      })
      .slice(0, 5);
  }, [query, props]);

  function handleSave() {
    if (!content.trim()) {
      toast.error("상담 내용을 입력해주세요.");
      return;
    }
    startTransition(async () => {
      if (props.mode === "create") {
        // 신규 고객 모드 — 먼저 고객 생성 후 customer.id 사용
        let customerId: string | undefined;
        if (customerMode === "new" && !customer) {
          if (!newCustomerHasMinInfo) {
            toast.error("이름 또는 전화번호 중 하나는 입력해야 합니다.");
            return;
          }
          const created = await createCustomer({
            name_vi: newNameVi.trim() ? asciiUpper(newNameVi) : null,
            name_kr: newNameKr.trim() || null,
            phone: newPhone.trim() || null,
          });
          if (!created.ok) {
            toast.error("고객 등록 실패", { description: created.error });
            return;
          }
          customerId = created.data.id;
        } else if (customer) {
          customerId = customer.id;
        } else {
          toast.error("고객을 선택해주세요.");
          return;
        }

        const result = await createConsultationWithAnalysis({
          customer_id: customerId,
          consultation_type: consultationType,
          content: content.trim(),
        });
        if (!result.ok) {
          toast.error("저장 실패", { description: result.error });
          return;
        }
        toast.success("상담 일지 저장 완료");
        const analysis = result.data.analysis;
        if (analysis && hasAnySuggestion(analysis)) {
          setReview({ customerId, analysis });
        } else {
          navigateBackOrTo(router, `/customers/${customerId}?tab=consultations`);
        }
      } else {
        if (!customer) return;
        const result = await updateConsultation({
          consultation_id: props.consultationId,
          content: content.trim(),
        });
        if (!result.ok) {
          toast.error("저장 실패", { description: result.error });
          return;
        }
        toast.success("상담 일지 수정 완료");
        const analysis = result.data.analysis;
        if (analysis && hasAnySuggestion(analysis)) {
          setReview({ customerId: customer.id, analysis });
        } else {
          navigateBackOrTo(router, `/customers/${customer.id}?tab=consultations`);
        }
      }
    });
  }

  function handleReviewClose(applied: boolean) {
    const customerId = review?.customerId;
    setReview(null);
    if (customerId) {
      if (applied) {
        toast.success("AI 제안이 고객 정보에 반영됐습니다.");
      }
      navigateBackOrTo(router, `/customers/${customerId}?tab=consultations`);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {props.mode === "create" ? "새 상담 일지" : "상담 일지 수정"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 신규/기존 고객 선택 라디오 — create 모드 + 미선택 상태에서 노출 */}
          {props.mode === "create" && !customer && (
            <div>
              <Label className="text-sm">고객 종류</Label>
              <div className="flex gap-4 mt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="customer-mode"
                    value="new"
                    checked={customerMode === "new"}
                    onChange={() => setCustomerMode("new")}
                  />
                  <span className="text-sm">신규 고객</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="customer-mode"
                    value="existing"
                    checked={customerMode === "existing"}
                    onChange={() => {
                      setCustomerMode("existing");
                      setNewNameVi("");
                      setNewNameKr("");
                      setNewPhone("");
                    }}
                  />
                  <span className="text-sm">기존 고객</span>
                </label>
              </div>
            </div>
          )}

          {/* 신규 고객 모드 — 최소 정보 입력 */}
          {props.mode === "create" && !customer && customerMode === "new" && (
            <div className="space-y-3 rounded-md border border-border p-3 bg-muted/30">
              <div className="text-xs text-muted-foreground">
                최소 1개 (이름 또는 전화) 입력 후 저장하면 고객도 함께 등록됩니다.
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">베트남 이름 (영문)</Label>
                  <Input
                    value={newNameVi}
                    onChange={(e) => setNewNameVi(asciiUpper(e.target.value))}
                    placeholder="PHAM THI DUNG"
                    autoFocus
                  />
                </div>
                <div>
                  <Label className="text-xs">한국 이름</Label>
                  <Input
                    value={newNameKr}
                    onChange={(e) => setNewNameKr(e.target.value)}
                    placeholder="팜 티 중"
                  />
                </div>
                <div>
                  <Label className="text-xs">전화번호</Label>
                  <Input
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="010-0000-0000"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 기존 고객 검색 / 선택 */}
          {props.mode === "create" && customerMode === "existing" ? (
            customer ? (
              <div>
                <Label className="text-sm">고객</Label>
                <div className="flex items-center gap-2 mt-1 px-3 py-2 rounded-md border border-border bg-muted/30">
                  <User className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {customer.name_vi || customer.name_kr || "(이름 없음)"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {customer.code}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCustomer(null)}
                    className="ml-auto text-muted-foreground hover:text-foreground"
                    aria-label="고객 변경"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <Label className="text-sm">고객 선택</Label>
                <div className="relative mt-1">
                  <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="코드 · 이름 · 전화로 검색"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="pl-8"
                    autoFocus
                  />
                </div>
                <div className="mt-2 max-h-64 overflow-y-auto rounded-md border border-border">
                  {filteredCustomers.length === 0 ? (
                    <div className="text-sm text-muted-foreground text-center py-6">
                      일치하는 고객이 없습니다.
                    </div>
                  ) : (
                    <ul className="divide-y divide-border">
                      {filteredCustomers.map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setCustomer(c);
                              setQuery("");
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-accent/50 transition-colors flex items-center gap-3"
                          >
                            <span className="text-sm font-medium flex-1 truncate">
                              {c.name_vi || c.name_kr || "(이름 없음)"}
                              {c.name_vi && c.name_kr && (
                                <span className="ml-2 text-xs text-muted-foreground">
                                  {c.name_kr}
                                </span>
                              )}
                            </span>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {c.code}
                            </span>
                            {c.phone && (
                              <span className="text-xs text-muted-foreground shrink-0">
                                {c.phone}
                              </span>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )
          ) : null}

          {/* 수정 모드 — 고객 read-only 표시 */}
          {props.mode === "edit" && (
            <div>
              <Label className="text-sm">고객</Label>
              <div className="flex items-center gap-2 mt-1 px-3 py-2 rounded-md border border-border bg-muted/30">
                <User className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {customer?.name_vi || customer?.name_kr || "(이름 없음)"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {customer?.code}
                </span>
              </div>
            </div>
          )}

          {/* 내용 */}
          <div>
            <Label className="text-sm">
              상담 내용{" "}
              <span className="text-xs text-muted-foreground">
                (베트남어로 작성 시 자동 번역 · 저장 후 AI 가 태그 추출)
              </span>
            </Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="상담 내용을 자세히 작성할수록 AI 가 더 정확한 제안을 줍니다."
              maxLength={4000}
              className="mt-1 min-h-[480px]"
            />
            <div className="text-xs text-muted-foreground mt-1">
              {content.length} / 4000
            </div>
          </div>

          {/* 액션 */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={pending}
            >
              취소
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              {props.mode === "create" ? "저장 + AI 분석" : "수정 + AI 재분석"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {review && (
        <AnalysisReviewDialog
          open={true}
          customerId={review.customerId}
          analysis={review.analysis}
          onClose={handleReviewClose}
        />
      )}
    </div>
  );
}

function hasAnySuggestion(a: ConsultationAnalysis): boolean {
  const c = a.suggestions.customer;
  const f = a.suggestions.status_flags;
  return Object.keys(c).length > 0 || Object.keys(f).length > 0;
}
