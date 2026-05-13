"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Save, Trash2, X } from "lucide-react";

import {
  trainingClassSchema,
  type TrainingClassInput,
  type TrainingClassOutput,
} from "@/lib/validators";
import {
  createTrainingClass,
  deleteTrainingClass,
  updateTrainingClass,
} from "@/app/(app)/training-centers/actions";
import type { TrainingClass } from "@/types/database";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { dash, formatDate } from "@/lib/format";

type Props = {
  centerId: string;
  classes: TrainingClass[];
};

export function TrainingClassesManager({ centerId, classes }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // 수정 중인 강의 id — null 이면 추가 모드
  const [editingId, setEditingId] = useState<string | null>(null);
  const now = new Date();

  const form = useForm<TrainingClassInput, unknown, TrainingClassOutput>({
    resolver: zodResolver(trainingClassSchema),
    defaultValues: {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      class_type: "weekday",
      start_date: null,
      end_date: null,
      notes: null,
    },
  });

  // 시작일 + 구분 변경 시 종료일 / year / month 자동 파생.
  // - 주간(weekday): 시작일 + 2개월
  // - 야간(night):   시작일 + 3개월
  // - 종료일은 자동으로 들어가지만 사용자가 그 후 직접 수정 가능.
  //   다만 시작일 또는 구분을 다시 바꾸면 종료일도 다시 덮어쓰기 됨 (의도).
  // year/month 는 DB 컬럼 유지를 위해 시작일에서 항상 자동 채움.
  const startDate = form.watch("start_date");
  const classType = form.watch("class_type");
  useEffect(() => {
    if (!startDate) return;
    const d = parseLocalDate(startDate);
    if (!d) return;
    form.setValue("year", d.getFullYear(), { shouldDirty: true });
    form.setValue("month", d.getMonth() + 1, { shouldDirty: true });
    const months = classType === "weekday" ? 2 : 3;
    form.setValue("end_date", formatLocalDate(addMonths(d, months)), {
      shouldDirty: true,
    });
  }, [startDate, classType, form]);

  function onAdd(values: TrainingClassOutput) {
    if (!values.start_date) {
      toast.error("시작일을 입력해주세요.");
      return;
    }
    startTransition(async () => {
      const result = await createTrainingClass(centerId, values);
      if (result.ok) {
        toast.success("월별 개강 정보가 추가되었습니다.");
        form.reset({
          ...form.getValues(),
          start_date: null,
          end_date: null,
          notes: null,
        });
        router.refresh();
      } else {
        toast.error("추가 실패", { description: result.error });
      }
    });
  }

  function onUpdate(values: TrainingClassOutput) {
    if (!editingId) return;
    if (!values.start_date) {
      toast.error("시작일을 입력해주세요.");
      return;
    }
    startTransition(async () => {
      const result = await updateTrainingClass(editingId, centerId, values);
      if (result.ok) {
        toast.success(
          "수정되었습니다. 연결된 교육생 정보도 같이 업데이트됨."
        );
        setEditingId(null);
        form.reset({
          year: now.getFullYear(),
          month: now.getMonth() + 1,
          class_type: "weekday",
          start_date: null,
          end_date: null,
          notes: null,
        });
        router.refresh();
      } else {
        toast.error("수정 실패", { description: result.error });
      }
    });
  }

  function onEditStart(cls: TrainingClass) {
    setEditingId(cls.id);
    form.reset({
      year: cls.year,
      month: cls.month,
      class_type: cls.class_type as "weekday" | "night",
      start_date: cls.start_date,
      end_date: cls.end_date,
      notes: cls.notes,
    });
    // 폼 영역으로 스크롤 — 사용자가 한참 아래 행을 편집할 때 필요
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function onCancelEdit() {
    setEditingId(null);
    form.reset({
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      class_type: "weekday",
      start_date: null,
      end_date: null,
      notes: null,
    });
  }

  async function onDelete(id: string) {
    setDeletingId(id);
    const result = await deleteTrainingClass(id, centerId);
    if (result.ok) {
      toast.success("삭제되었습니다.");
      router.refresh();
    } else {
      toast.error("삭제 실패", { description: result.error });
    }
    setDeletingId(null);
  }

  // 정렬: 최신 연도/월 우선
  const sorted = [...classes].sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">월별 개강 정보</CardTitle>
        <CardDescription>
          교육원의 연·월별 강의 개강/종료 일정. 주간/야간 구분 필수 (소개비 정산 기준).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 추가 폼.
         *
         * NOTE: 이 컴포넌트는 TrainingCenterForm 의 outer <form> 안에 extraContent
         * 로 주입된다. HTML 에서 nested <form> 은 invalid 라 안쪽 form 의 submit
         * 이 outer form 으로 가버리는 버그가 있었다 (2026-05-08).
         * → 안쪽은 <div> 로 두고, "추가" 버튼만 type="button" + onClick 으로
         *   form.handleSubmit(onAdd) 호출. RHF validation/submit 흐름은 동일.
         */}
        <Form {...form}>
          <div
            className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-end"
          >
            <FormField
              control={form.control}
              name="class_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>구분</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValueMap
                          map={{ weekday: "주간", night: "야간" }}
                          placeholder="선택"
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="weekday">주간</SelectItem>
                      <SelectItem value="night">야간</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="start_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    시작일 <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="end_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    종료일{" "}
                    <span className="text-xs text-muted-foreground font-normal">
                      (자동 · 수정가능)
                    </span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>비고</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      placeholder="선택"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {editingId ? (
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={form.handleSubmit(onUpdate)}
                  disabled={pending}
                >
                  {pending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  수정
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancelEdit}
                  disabled={pending}
                >
                  <X className="size-4" />
                  취소
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                onClick={form.handleSubmit(onAdd)}
                disabled={pending}
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                추가
              </Button>
            )}
          </div>
          {editingId && (
            <p className="mt-2 text-xs text-info">
              💡 수정 모드 — 시작일/구분/종료일/비고 변경 후 [수정] 버튼.
              연결된 교육생들의 강의 시작·종료일도 자동으로 같이
              업데이트됩니다.
            </p>
          )}
        </Form>

        {/* 목록 */}
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border rounded-md">
            등록된 월별 개강 정보가 없습니다.
          </p>
        ) : (
          <div className="overflow-hidden rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">연</TableHead>
                  <TableHead className="w-16">월</TableHead>
                  <TableHead className="w-20">구분</TableHead>
                  <TableHead className="w-32">시작일</TableHead>
                  <TableHead className="w-32">종료일</TableHead>
                  <TableHead>비고</TableHead>
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((cls) => (
                  <TableRow key={cls.id}>
                    <TableCell>{cls.year}</TableCell>
                    <TableCell>{cls.month}월</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          cls.class_type === "weekday"
                            ? "bg-info/10 text-info border-info/20"
                            : "bg-warning/10 text-warning border-warning/20"
                        }
                      >
                        {cls.class_type === "weekday" ? "주간" : "야간"}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(cls.start_date)}</TableCell>
                    <TableCell>{formatDate(cls.end_date)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {dash(cls.notes)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => onEditStart(cls)}
                          disabled={pending || editingId === cls.id}
                          className="text-info hover:text-info hover:bg-info/5"
                          title="편집"
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(cls.id)}
                          disabled={deletingId === cls.id || editingId === cls.id}
                          className="text-destructive hover:text-destructive hover:bg-destructive/5"
                          title="삭제"
                        >
                          {deletingId === cls.id ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Trash2 className="size-4" />
                          )}
                        </Button>
                      </div>
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
// 날짜 유틸 (로컬 시간 기준 — UTC 변환으로 인한 하루 밀림 방지)
// =============================================================================

function parseLocalDate(s: string): Date | null {
  // "YYYY-MM-DD" 만 처리. 시간을 00:00 로컬로 고정.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const date = new Date(y, mo - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addMonths(d: Date, months: number): Date {
  // JS Date 의 setMonth 는 day overflow 시 다음 달로 넘김.
  // 예: 1/31 + 1m → 3/3 (2월에 31일 없음) — 일반적 교육 일정 정밀도에선 OK.
  return new Date(d.getFullYear(), d.getMonth() + months, d.getDate());
}
