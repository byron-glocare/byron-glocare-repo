"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";

import {
  trainingClassSchema,
  type TrainingClassInput,
  type TrainingClassOutput,
} from "@/lib/validators";
import {
  createTrainingClass,
  deleteTrainingClass,
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

  function onAdd(values: TrainingClassOutput) {
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
        {/* 추가 폼 */}
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onAdd)}
            className="grid grid-cols-2 sm:grid-cols-7 gap-3 items-end"
          >
            <FormField
              control={form.control}
              name="year"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>연</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={2020}
                      max={2100}
                      {...field}
                      onChange={(e) => {
                        const n = e.target.valueAsNumber;
                        field.onChange(Number.isNaN(n) ? 0 : n);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="month"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>월</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={12}
                      {...field}
                      onChange={(e) => {
                        const n = e.target.valueAsNumber;
                        field.onChange(Number.isNaN(n) ? 0 : n);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
                  <FormLabel>시작일</FormLabel>
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
                  <FormLabel>종료일</FormLabel>
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
            <Button type="submit" disabled={pending}>
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              추가
            </Button>
          </form>
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
                  <TableHead className="w-16" />
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
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(cls.id)}
                        disabled={deletingId === cls.id}
                        className="text-destructive hover:text-destructive hover:bg-destructive/5"
                      >
                        {deletingId === cls.id ? (
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
