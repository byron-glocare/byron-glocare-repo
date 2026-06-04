"use client";

/**
 * '챙길 일정' (customer_reminders) 관리 패널.
 *
 * 진행 단계 탭의 "대기" StageCard 아래에 렌더링. 대기중 (단일 holding)과 별개로
 * 한 고객당 여러 챙길 항목 등록 가능. remind_date 가 지나면 대시보드 [연락 필요]
 * 카드에 포함됨.
 *
 * 자체 server action 으로 즉시 저장 — progress tab 의 페이지 레벨 dirty 와 무관.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlarmClock,
  Check,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import {
  createCustomerReminder,
  deleteCustomerReminder,
  toggleCustomerReminderCompleted,
  updateCustomerReminder,
} from "@/app/(app)/customers/actions";
import type { CustomerReminder } from "@/types/database";

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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Props = {
  customerId: string;
  reminders: CustomerReminder[];
};

export function CustomerRemindersPanel({ customerId, reminders }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // 추가 폼 state
  const [newDate, setNewDate] = useState("");
  const [newContent, setNewContent] = useState("");

  // 편집 중인 reminder id + 임시 값
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editContent, setEditContent] = useState("");

  // 오늘 (KST) — 도래 여부 시각화
  const todayKst = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  // 정렬: 미완료 먼저 (도래 임박순), 완료는 뒤
  const sorted = [...reminders].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return a.remind_date.localeCompare(b.remind_date);
  });

  function handleAdd() {
    if (!newDate || !newContent.trim()) {
      toast.error("날짜와 내용을 모두 입력해주세요.");
      return;
    }
    startTransition(async () => {
      const result = await createCustomerReminder(customerId, {
        remind_date: newDate,
        content: newContent.trim(),
      });
      if (result.ok) {
        toast.success("챙길 일정이 추가되었습니다.");
        setNewDate("");
        setNewContent("");
        router.refresh();
      } else {
        toast.error("추가 실패", { description: result.error });
      }
    });
  }

  function handleEditStart(r: CustomerReminder) {
    setEditingId(r.id);
    setEditDate(r.remind_date);
    setEditContent(r.content);
  }

  function handleEditCancel() {
    setEditingId(null);
    setEditDate("");
    setEditContent("");
  }

  function handleEditSave(r: CustomerReminder) {
    if (!editDate || !editContent.trim()) {
      toast.error("날짜와 내용을 모두 입력해주세요.");
      return;
    }
    startTransition(async () => {
      const result = await updateCustomerReminder(r.id, {
        remind_date: editDate,
        content: editContent.trim(),
        completed: r.completed,
      });
      if (result.ok) {
        toast.success("수정되었습니다.");
        handleEditCancel();
        router.refresh();
      } else {
        toast.error("수정 실패", { description: result.error });
      }
    });
  }

  function handleToggle(r: CustomerReminder) {
    startTransition(async () => {
      const result = await toggleCustomerReminderCompleted(r.id, !r.completed);
      if (result.ok) {
        router.refresh();
      } else {
        toast.error("처리 실패", { description: result.error });
      }
    });
  }

  function handleDelete(r: CustomerReminder) {
    if (!confirm(`"${r.content}" 일정을 삭제하시겠습니까?`)) return;
    startTransition(async () => {
      const result = await deleteCustomerReminder(r.id);
      if (result.ok) {
        toast.success("삭제되었습니다.");
        router.refresh();
      } else {
        toast.error("삭제 실패", { description: result.error });
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <AlarmClock className="size-4" />
          챙길 일정
        </CardTitle>
        <CardDescription className="text-xs">
          특정 날짜에 챙겨야 할 항목. 날짜가 지나면 대시보드 [연락 필요]
          카드에 자동으로 포함됩니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* 추가 폼 */}
        <div className="grid grid-cols-[10rem_1fr_auto] gap-2 items-end">
          <div>
            <Label className="text-xs text-muted-foreground">날짜</Label>
            <Input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              disabled={pending}
              min={todayKst}
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">내용</Label>
            <Input
              type="text"
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdd();
                }
              }}
              disabled={pending}
              placeholder="예: 비자 갱신 서류 확인 / 면접 결과 확인 / 입금 확인"
            />
          </div>
          <Button type="button" onClick={handleAdd} disabled={pending}>
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            추가
          </Button>
        </div>

        {/* 리스트 */}
        {sorted.length === 0 ? (
          <p className="text-xs text-muted-foreground py-3 text-center border border-dashed border-border rounded-md">
            등록된 챙길 일정이 없습니다.
          </p>
        ) : (
          <ul className="divide-y divide-border border border-border rounded-md">
            {sorted.map((r) => {
              const isOverdue = !r.completed && r.remind_date <= todayKst;
              const isEditing = editingId === r.id;
              return (
                <li
                  key={r.id}
                  className={cn(
                    "flex items-start gap-2 p-2.5 text-sm",
                    r.completed && "opacity-50",
                    isOverdue && "bg-warning/5"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => handleToggle(r)}
                    disabled={pending}
                    className={cn(
                      "mt-0.5 size-4 rounded border flex items-center justify-center shrink-0",
                      r.completed
                        ? "bg-success border-success text-white"
                        : "border-input hover:border-primary"
                    )}
                    title={r.completed ? "완료 해제" : "완료 표시"}
                  >
                    {r.completed && <Check className="size-3" />}
                  </button>

                  {isEditing ? (
                    <>
                      <div className="flex-1 grid grid-cols-[10rem_1fr] gap-2">
                        <Input
                          type="date"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                          disabled={pending}
                          className="h-8 text-xs"
                        />
                        <Textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          disabled={pending}
                          rows={1}
                          className="text-xs min-h-[2rem]"
                        />
                      </div>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEditSave(r)}
                          disabled={pending}
                        >
                          <Check className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={handleEditCancel}
                          disabled={pending}
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span
                            className={cn(
                              "font-mono",
                              isOverdue && "text-warning font-semibold"
                            )}
                          >
                            {r.remind_date}
                          </span>
                          {isOverdue && (
                            <Badge
                              variant="outline"
                              className="text-[10px] py-0 bg-warning/10 text-warning border-warning/20"
                            >
                              도래
                            </Badge>
                          )}
                        </div>
                        <div className="mt-0.5 whitespace-pre-wrap break-words">
                          {r.content}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEditStart(r)}
                          disabled={pending}
                          className="text-info hover:text-info hover:bg-info/5"
                          title="편집"
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(r)}
                          disabled={pending}
                          className="text-destructive hover:text-destructive hover:bg-destructive/5"
                          title="삭제"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
