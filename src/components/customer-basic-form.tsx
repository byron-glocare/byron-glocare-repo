"use client";

import { useEffect, useImperativeHandle, useState, useTransition, type Ref } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Save, Trash2 } from "lucide-react";

import {
  customerSchema,
  type CustomerInput,
  type CustomerOutput,
} from "@/lib/validators";
import {
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from "@/app/(app)/customers/actions";
import type { TrainingCenter, TrainingClass, CareHome } from "@/types/database";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RegionSelect } from "@/components/region-select";
import { navigateBackOrTo } from "@/lib/navigate-back";
import { asciiUpper } from "@/lib/name-utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValueMap,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** embedded 모드에서 부모(페이지)가 호출하는 imperative API */
export type CustomerBasicFormHandle = {
  submit: () => Promise<{ ok: boolean; error?: string }>;
  reset: () => void;
};

type Props = {
  mode: "create" | "edit";
  customerId?: string;
  defaultValues?: Partial<CustomerInput>;
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
  /**
   * 요양원 / 근무 관련 필드 잠금 여부.
   * 진행 단계 탭의 종료 플래그 (웰컴팩 예약포기, 교육 드랍, 근무 종료 등)
   * 가 ON 인 경우 페이지에서 계산해 전달. 잠기면 요양원/면접/근무/비자변경
   * 관련 필드가 모두 disabled.
   */
  careHomeLocked?: boolean;
  /**
   * 페이지 레벨 통합 저장에 embed 되는 경우 true.
   * - 내부 저장/취소/삭제 버튼 숨김
   * - submit / reset 은 ref 로 부모가 트리거
   * - dirty 변경 시 onDirtyChange 콜백
   */
  embedded?: boolean;
  ref?: Ref<CustomerBasicFormHandle>;
  onDirtyChange?: (dirty: boolean) => void;
};

const EMPTY: CustomerInput = {
  name_vi: null,
  name_kr: null,
  address: null,
  gender: null,
  birth_year: null,
  phone: null,
  email: null,
  visa_type: null,
  topik_level: null,
  stay_remaining: null,
  desired_period: null,
  desired_time: null,
  desired_region: null,
  training_center_id: null,
  training_class_id: null,
  care_home_id: null,
  // class_start_date / class_end_date 는 training_class 에서 파생 (서버가 동기화)
  work_start_date: null,
  work_end_date: null,
  visa_change_date: null,
  interview_date: null,
  product_type: null,
  is_waiting: false,
  recontact_date: null,
  waiting_memo: null,
  termination_reason: null,
  legacy_status: null,
};

const NONE_VALUE = "__none__";

export function CustomerBasicForm({
  mode,
  customerId,
  defaultValues,
  trainingCenters,
  trainingClasses,
  careHomes,
  careHomeLocked = false,
  embedded = false,
  ref,
  onDirtyChange,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deleting, setDeleting] = useState(false);

  const form = useForm<CustomerInput, unknown, CustomerOutput>({
    resolver: zodResolver(customerSchema),
    defaultValues: { ...EMPTY, ...defaultValues },
  });

  const selectedCenterId = form.watch("training_center_id");
  // 상품이 "웰컴팩" 단독이면 교육 미참여 → 교육원/강의일정 비활성화
  const productType = form.watch("product_type");
  const trainingDisabled = productType === "웰컴팩";
  const filteredClasses = trainingClasses.filter(
    (c) => c.training_center_id === selectedCenterId
  );

  // dirty 변경을 부모에게 알림 (embedded 모드 전용)
  const isDirty = form.formState.isDirty;
  useEffect(() => {
    if (embedded) onDirtyChange?.(isDirty);
  }, [embedded, isDirty, onDirtyChange]);

  // imperative API
  useImperativeHandle(
    ref,
    () => ({
      submit: async () => {
        if (mode !== "edit" || !customerId) {
          return { ok: false, error: "수정 모드 아님" };
        }
        // RHF validation 통과 후 updateCustomer 호출
        const valid = await form.trigger();
        if (!valid) {
          const err = Object.values(form.formState.errors)[0];
          return { ok: false, error: (err?.message as string) ?? "유효성 검사 실패" };
        }
        const values = form.getValues() as unknown as CustomerOutput;
        const result = await updateCustomer(customerId, values);
        if (result.ok) {
          form.reset(form.getValues()); // dirty 초기화
        }
        return result.ok
          ? { ok: true }
          : { ok: false, error: result.error };
      },
      reset: () => {
        form.reset();
      },
    }),
    [ref, mode, customerId, form]
  );

  function onSubmit(values: CustomerOutput) {
    if (embedded) return; // embedded 는 부모가 ref.submit 으로 호출
    startTransition(async () => {
      if (mode === "create") {
        const result = await createCustomer(values);
        if (!result.ok) {
          toast.error("등록 실패", { description: result.error });
          return;
        }
        toast.success("등록되었습니다.");
        navigateBackOrTo(router, "/customers");
      } else if (customerId) {
        const result = await updateCustomer(customerId, values);
        if (result.ok) {
          toast.success("저장되었습니다.");
          navigateBackOrTo(router, "/customers");
        } else {
          toast.error("저장 실패", { description: result.error });
        }
      }
    });
  }

  async function handleDelete() {
    if (!customerId) return;
    setDeleting(true);
    const result = await deleteCustomer(customerId);
    if (result && !result.ok) {
      toast.error("삭제 실패", { description: result.error });
      setDeleting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* 개인정보 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">개인정보</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FormField
              control={form.control}
              name="name_vi"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>베트남 이름 (영문 대문자)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(asciiUpper(e.target.value))}
                      placeholder="PHAM THI DUNG"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name_kr"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>한국 이름</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      placeholder="팜 티 중"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>전화번호</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      placeholder="010-0000-0000"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>이메일</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="gender"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>성별</FormLabel>
                  <Select
                    value={field.value ?? NONE_VALUE}
                    onValueChange={(v) =>
                      field.onChange(v === NONE_VALUE ? null : v)
                    }
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValueMap
                          map={{ [NONE_VALUE]: "—", "여": "여", "남": "남" }}
                          placeholder="선택"
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>—</SelectItem>
                      <SelectItem value="여">여</SelectItem>
                      <SelectItem value="남">남</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="birth_year"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>년생</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1900}
                      max={2030}
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem className="sm:col-span-2 lg:col-span-3">
                  <FormLabel>주소</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* 비자 · 희망 조건 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">비자 · 희망 조건</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FormField
              control={form.control}
              name="visa_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>비자</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      placeholder="D-10 / F-2-R / D-2 ..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="topik_level"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>TOPIK</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      placeholder="3급 / KIIP 4 ..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="stay_remaining"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>체류 남은기간</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      placeholder="6개월 / 1년 (2026/05)"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="desired_period"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>희망 기간</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      placeholder="7월 / 9월초 / 2026/3월"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="desired_time"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>희망 시간대</FormLabel>
                  <Select
                    value={field.value ?? NONE_VALUE}
                    onValueChange={(v) =>
                      field.onChange(v === NONE_VALUE ? null : v)
                    }
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValueMap
                          map={{ [NONE_VALUE]: "—", "주간": "주간", "야간": "야간" }}
                          placeholder="선택"
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>—</SelectItem>
                      <SelectItem value="주간">주간</SelectItem>
                      <SelectItem value="야간">야간</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="desired_region"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>희망 지역</FormLabel>
                  <FormControl>
                    <RegionSelect
                      value={field.value ?? ""}
                      onChange={(v) => field.onChange(v === "" ? null : v)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* 교육원 · 강의 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">교육원 · 강의</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <FormField
                control={form.control}
                name="product_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>상품</FormLabel>
                    <Select
                      value={field.value ?? NONE_VALUE}
                      onValueChange={(v) =>
                        field.onChange(v === NONE_VALUE ? null : v)
                      }
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValueMap
                            map={{
                              [NONE_VALUE]: "—",
                              "교육": "교육",
                              "웰컴팩": "웰컴팩",
                              "교육+웰컴팩": "교육+웰컴팩",
                            }}
                            placeholder="선택"
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE_VALUE}>—</SelectItem>
                        <SelectItem value="교육">교육</SelectItem>
                        <SelectItem value="웰컴팩">웰컴팩</SelectItem>
                        <SelectItem value="교육+웰컴팩">교육+웰컴팩</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="training_center_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>교육원</FormLabel>
                    <Select
                      value={field.value ?? NONE_VALUE}
                      onValueChange={(v) => {
                        const next = v === NONE_VALUE ? null : v;
                        // 실제로 다른 교육원으로 변경된 경우에만 강의일정 리셋
                        if (next !== field.value) {
                          form.setValue("training_class_id", null);
                        }
                        field.onChange(next);
                      }}
                      disabled={trainingDisabled}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValueMap
                            map={{
                              [NONE_VALUE]: "미매칭",
                              ...Object.fromEntries(
                                trainingCenters.map((tc) => [
                                  tc.id,
                                  `${tc.name}${tc.region ? ` (${tc.region})` : ""}`,
                                ])
                              ),
                            }}
                            placeholder="선택"
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE_VALUE}>미매칭</SelectItem>
                        {trainingCenters.map((tc) => (
                          <SelectItem key={tc.id} value={tc.id}>
                            {tc.name}
                            {tc.region ? ` (${tc.region})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {trainingDisabled && (
                      <p className="text-xs text-muted-foreground">
                        상품 '웰컴팩' — 교육 대상 아님
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="training_class_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>강의일정</FormLabel>
                    <Select
                      value={field.value ?? NONE_VALUE}
                      onValueChange={(v) =>
                        field.onChange(v === NONE_VALUE ? null : v)
                      }
                      disabled={
                        trainingDisabled ||
                        !selectedCenterId ||
                        filteredClasses.length === 0
                      }
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValueMap
                            map={{
                              [NONE_VALUE]: "미선택",
                              ...Object.fromEntries(
                                filteredClasses.map((cls) => [
                                  cls.id,
                                  `${cls.year}년 ${cls.month}월 — ${cls.class_type === "weekday" ? "주간" : "야간"}${cls.start_date ? ` (${cls.start_date})` : ""}`,
                                ])
                              ),
                            }}
                            placeholder={
                              !selectedCenterId
                                ? "먼저 교육원 선택"
                                : filteredClasses.length === 0
                                  ? "등록된 일정 없음"
                                  : "선택"
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE_VALUE}>미선택</SelectItem>
                        {filteredClasses.map((cls) => (
                          <SelectItem key={cls.id} value={cls.id}>
                            {cls.year}년 {cls.month}월 —{" "}
                            {cls.class_type === "weekday" ? "주간" : "야간"}
                            {cls.start_date ? ` (${cls.start_date})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {/* 선택된 강의의 시작/종료일 표시 (read-only — 교육원 마스터에서 관리) */}
            <SelectedClassDateInfo
              trainingClass={
                filteredClasses.find(
                  (c) => c.id === form.watch("training_class_id")
                ) ?? null
              }
            />
          </CardContent>
        </Card>

        {/* 요양원 · 취업 / 근무 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">요양원 · 취업 / 근무</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="care_home_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>요양원</FormLabel>
                  <Select
                    value={field.value ?? NONE_VALUE}
                    onValueChange={(v) =>
                      field.onChange(v === NONE_VALUE ? null : v)
                    }
                    disabled={careHomeLocked}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValueMap
                          map={{
                            [NONE_VALUE]: "미매칭",
                            ...Object.fromEntries(
                              careHomes.map((ch) => [
                                ch.id,
                                `${ch.name}${ch.region ? ` (${ch.region})` : ""}`,
                              ])
                            ),
                          }}
                          placeholder="선택"
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>미매칭</SelectItem>
                      {careHomes.map((ch) => (
                        <SelectItem key={ch.id} value={ch.id}>
                          {ch.name}
                          {ch.region ? ` (${ch.region})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {careHomeLocked && (
                    <p className="text-xs text-muted-foreground">
                      취업/근무 단계가 잠겨있어 수정할 수 없습니다.
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <FormField
                control={form.control}
                name="interview_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>면접일</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        value={field.value ?? ""}
                        disabled={careHomeLocked}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="work_start_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>근무 시작일</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        value={field.value ?? ""}
                        disabled={careHomeLocked}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="work_end_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>근무 종료일</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        value={field.value ?? ""}
                        disabled={careHomeLocked}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="visa_change_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>비자 변경일</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        value={field.value ?? ""}
                        disabled={careHomeLocked}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* 대기 상태 / 종료 사유는 진행 단계 탭에서 관리 (2026-04-23 이동) */}

        {/* 액션 — embedded 모드에서는 페이지 레벨에서 통합 처리 */}
        {!embedded && (
          <div className="flex items-center justify-between">
            {mode === "edit" && customerId ? (
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
            ) : (
              <span />
            )}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={pending}
              >
                취소
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="size-4 animate-spin" />}
                <Save className="size-4" />
                {mode === "create" ? "등록" : "저장"}
              </Button>
            </div>
          </div>
        )}
      </form>
    </Form>
  );
}

/**
 * 선택한 강의의 시작/종료일 표시 (읽기 전용).
 * 강의 날짜는 교육원 마스터 (training_classes) 에서만 관리되므로
 * 고객 폼에서는 참고용 정보로만 노출.
 */
function SelectedClassDateInfo({
  trainingClass,
}: {
  trainingClass: {
    start_date: string | null;
    end_date: string | null;
  } | null;
}) {
  if (!trainingClass) return null;
  return (
    <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground flex items-center gap-4 flex-wrap">
      <span className="font-medium text-foreground">강의 일정</span>
      <span>시작 {trainingClass.start_date ?? "—"}</span>
      <span>종료 {trainingClass.end_date ?? "—"}</span>
      <span className="ml-auto">교육원 마스터에서 관리</span>
    </div>
  );
}
