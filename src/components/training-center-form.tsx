"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Save, Trash2 } from "lucide-react";

import {
  trainingCenterSchema,
  type TrainingCenterInput,
  type TrainingCenterOutput,
} from "@/lib/validators";
import {
  createTrainingCenter,
  updateTrainingCenter,
  deleteTrainingCenter,
} from "@/app/(app)/training-centers/actions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { RegionSelect } from "@/components/region-select";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Props = {
  mode: "create" | "edit";
  centerId?: string;
  defaultValues?: Partial<TrainingCenterInput>;
  /** 2-col 그리드와 메모 사이에 삽입할 컨텐츠 (월별 개강 등) */
  extraContent?: ReactNode;
};

const EMPTY: TrainingCenterInput = {
  name: "",
  region: null,
  address: null,
  business_number: null,
  director_name: null,
  phone: null,
  email: null,
  bank_name: null,
  bank_account: null,
  tuition_fee_2025: null,
  tuition_fee_2026: null,
  class_hours: null,
  naeil_card_eligible: false,
  contract_active: false,
  notes: null,
};

export function TrainingCenterForm({
  mode,
  centerId,
  defaultValues,
  extraContent,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deleting, setDeleting] = useState(false);

  const form = useForm<TrainingCenterInput, unknown, TrainingCenterOutput>({
    resolver: zodResolver(trainingCenterSchema),
    defaultValues: { ...EMPTY, ...defaultValues },
  });

  function onSubmit(values: TrainingCenterOutput) {
    startTransition(async () => {
      if (mode === "create") {
        const result = await createTrainingCenter(values);
        // create는 성공 시 redirect 되므로 여기 도달하면 에러
        if (result && !result.ok) {
          toast.error("등록 실패", { description: result.error });
        }
      } else if (centerId) {
        const result = await updateTrainingCenter(centerId, values);
        if (result.ok) {
          toast.success("저장되었습니다.");
          router.refresh();
        } else {
          toast.error("저장 실패", { description: result.error });
        }
      }
    });
  }

  async function handleDelete() {
    if (!centerId) return;
    setDeleting(true);
    const result = await deleteTrainingCenter(centerId);
    // 성공 시 redirect 발생. 여기 도달 시 = 실패.
    if (result && !result.ok) {
      toast.error("삭제 실패", { description: result.error });
      setDeleting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* 좌측: 기본 정보 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">기본 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      교육원 이름 <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        placeholder="예: 대구 미래 요양보호사교육원"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="region"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>지역</FormLabel>
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
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>주소</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="business_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>사업자등록번호</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        placeholder="000-00-00000"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contract_active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-md border border-border p-3">
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm">계약 상태</FormLabel>
                      <div className="text-xs text-muted-foreground">
                        ON = 계약 완료
                      </div>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* 우측: 담당자/연락처/금액 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">담당자 · 결제 · 강의</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="director_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>원장</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ""} />
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
              </div>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>이메일</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        type="email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="bank_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>입금 은행</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="bank_account"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>입금 계좌</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="tuition_fee_2025"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>수강료 (2025)</FormLabel>
                      <FormControl>
                        <Input
                          inputMode="numeric"
                          placeholder="원"
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
                  name="tuition_fee_2026"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>수강료 (2026)</FormLabel>
                      <FormControl>
                        <Input
                          inputMode="numeric"
                          placeholder="원"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="class_hours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>강의 시간</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        placeholder="예: 9:30~16:50 / 야간 18:30~22:30"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="naeil_card_eligible"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-md border border-border p-3">
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm">
                        내일배움카드 가능
                      </FormLabel>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        </div>

        {/* 월별 개강정보 등 외부에서 주입하는 컨텐츠 */}
        {extraContent}

        {/* 메모 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">메모</CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value ?? ""}
                      rows={4}
                      placeholder="특이사항, 협의 내용 등"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          {mode === "edit" && centerId ? (
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
                  <DialogTitle>교육원 삭제</DialogTitle>
                  <DialogDescription>
                    이 교육원을 삭제하시겠습니까? 소속 교육생이나 강의가 있다면
                    삭제되지 않습니다.
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
                    {deleting ? "삭제 중…" : "확인 — 삭제"}
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
      </form>
    </Form>
  );
}
