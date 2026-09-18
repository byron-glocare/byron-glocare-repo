"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, RotateCcw, Save, Trash2 } from "lucide-react";

import { updateSystemSetting } from "@/app/(app)/settings/actions";
import { CLASS_INQUIRY_MESSAGES_KEY } from "@/lib/class-inquiry-messages";
import { CLASS_INQUIRY_MESSAGES } from "@/lib/sms-templates";
import type { Json } from "@/types/database";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

/** LMS 본문 한도 (참고 표시용) */
const LMS_BYTE_LIMIT = 2000;

function byteLen(s: string): number {
  return new TextEncoder().encode(s).length;
}

/** system_settings.value → 문자열 배열 (없으면 기본 5종) */
function toMessages(value: Json | undefined): string[] {
  if (Array.isArray(value)) {
    const arr = value.filter(
      (x): x is string => typeof x === "string"
    );
    if (arr.length > 0) return arr;
  }
  return CLASS_INQUIRY_MESSAGES;
}

export function ClassInquiryMessagesEditor({
  value,
}: {
  value: Json | undefined;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const saved = toMessages(value);
  const [items, setItems] = useState<string[]>(saved);

  const dirty = JSON.stringify(items) !== JSON.stringify(saved);
  const nonEmpty = items.filter((m) => m.trim() !== "");

  function updateItem(index: number, text: string) {
    setItems((prev) => prev.map((m, i) => (i === index ? text : m)));
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function addItem() {
    setItems((prev) => [...prev, ""]);
  }

  function resetToDefault() {
    if (
      confirm(
        "기본 문구 5종으로 되돌릴까요? 현재 편집 중인 내용은 사라집니다.\n(저장을 눌러야 실제 반영됩니다.)"
      )
    ) {
      setItems([...CLASS_INQUIRY_MESSAGES]);
    }
  }

  function onSave() {
    const cleaned = items.map((m) => m.trim()).filter((m) => m !== "");
    if (cleaned.length === 0) {
      toast.error("최소 1개 이상의 문구가 필요합니다.");
      return;
    }
    startTransition(async () => {
      const result = await updateSystemSetting(
        CLASS_INQUIRY_MESSAGES_KEY,
        cleaned as unknown as Json
      );
      if (result.ok) {
        toast.success("강의 정보 문의 문구 저장됨");
        setItems(cleaned);
        router.refresh();
      } else {
        toast.error("저장 실패", { description: result.error });
      }
    });
  }

  return (
    <Card id="class-inquiry-messages" className="scroll-mt-20">
      <CardHeader>
        <CardTitle className="text-base">강의 정보 문의 문구 (랜덤 발송)</CardTitle>
        <CardDescription>
          [알림발송 › 강의 정보 문의]에서 문자를 보낼 때 아래 문구 중 하나가
          무작위로 선택됩니다. 매달 같은 문자가 반복돼 기계 발송처럼 보이는 걸
          줄이기 위한 것이니, 내용은 같되 표현만 조금씩 다르게 여러 개
          두는 것을 권장합니다. 최소 1개는 있어야 합니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((msg, i) => {
          const bytes = byteLen(msg);
          const over = bytes > LMS_BYTE_LIMIT;
          return (
            <div
              key={i}
              className="space-y-1 rounded-md border border-border p-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  문구 {i + 1}
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs ${
                      over ? "text-destructive" : "text-muted-foreground"
                    }`}
                  >
                    {bytes} / {LMS_BYTE_LIMIT} byte
                  </span>
                  <button
                    type="button"
                    onClick={() => removeItem(i)}
                    disabled={pending}
                    className="text-muted-foreground hover:text-destructive disabled:opacity-50"
                    aria-label={`문구 ${i + 1} 삭제`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
              <Textarea
                value={msg}
                onChange={(e) => updateItem(i, e.target.value)}
                rows={4}
                disabled={pending}
                className="text-sm leading-relaxed"
                placeholder="발송 문구를 입력하세요"
              />
            </div>
          );
        })}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addItem}
              disabled={pending}
            >
              <Plus className="size-3" />
              문구 추가
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetToDefault}
              disabled={pending}
              className="text-muted-foreground"
            >
              <RotateCcw className="size-3" />
              기본값으로
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {nonEmpty.length}개 문구
            </span>
            <Button
              type="button"
              size="sm"
              onClick={onSave}
              disabled={!dirty || pending}
            >
              {pending ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Save className="size-3" />
              )}
              저장
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
