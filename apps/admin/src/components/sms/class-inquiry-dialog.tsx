"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";

import { sendClassInquirySms } from "@/app/(app)/sms/actions";
import { pickClassInquiryMessage } from "@/lib/sms-templates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type InquiryCenter = {
  id: string;
  name: string;
  phone: string | null;
  director_phone: string | null;
  contact_phone: string | null;
  sms_recipient: "phone" | "director" | "contact" | null;
};

type Choice = "phone" | "director" | "contact" | "custom";

/** "01012345678" → "010-1234-5678", "0212345678" → "02-1234-5678" */
function formatPhoneInput(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.startsWith("02")) {
    if (d.length <= 2) return d;
    if (d.length <= 5) return `${d.slice(0, 2)}-${d.slice(2)}`;
    if (d.length <= 9) return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`;
    return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6, 10)}`;
  }
  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

/**
 * 강의 정보 문의 발송 다이얼로그 — 5종 랜덤 문구 + 편집 후 발송.
 * 수신 번호: 교육원에 등록된 모든 번호를 라디오로 보여주고 대표번호가
 * 기본 선택. 직접 입력(하이픈 자동완성)도 가능.
 */
export function ClassInquiryDialog({
  center,
  messages,
  open,
  onOpenChange,
  onSent,
}: {
  center: InquiryCenter;
  /** 랜덤 문구 풀 (설정에서 편집, 미설정 시 기본 5종) */
  messages: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent?: () => void;
}) {
  const numberOptions: { key: Choice; label: string; value: string }[] = [
    { key: "phone" as const, label: "대표번호", value: center.phone?.trim() ?? "" },
    {
      key: "director" as const,
      label: "대표자 연락처",
      value: center.director_phone?.trim() ?? "",
    },
    {
      key: "contact" as const,
      label: "담당자 연락처",
      value: center.contact_phone?.trim() ?? "",
    },
  ].filter((o) => o.value);

  const [body, setBody] = useState("");
  const [choice, setChoice] = useState<Choice>("phone");
  const [customPhone, setCustomPhone] = useState("");
  const [pending, startTransition] = useTransition();

  // 열릴 때마다 랜덤 문구 + 기본 선택(대표번호 → 있는 번호 → 직접 입력)로 리셋
  useEffect(() => {
    if (open) {
      setBody(pickClassInquiryMessage(messages));
      setCustomPhone("");
      setChoice(numberOptions[0]?.key ?? "custom");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, center.id]);

  const selectedPhone =
    choice === "custom"
      ? customPhone.trim()
      : (numberOptions.find((o) => o.key === choice)?.value ?? "");

  function onSend() {
    if (!selectedPhone) {
      toast.error("수신 전화번호를 선택하거나 입력하세요.");
      return;
    }
    if (!body.trim()) {
      toast.error("본문이 비어있습니다.");
      return;
    }
    startTransition(async () => {
      const r = await sendClassInquirySms({
        centerId: center.id,
        bodyOverride: body,
        phoneOverride: selectedPhone,
      });
      if (r.ok) {
        toast.success(`${center.name} 에 강의 문의를 발송했습니다.`, {
          description: r.warning,
        });
        onOpenChange(false);
        onSent?.();
      } else {
        toast.error("발송 실패", { description: r.error });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>강의 정보 문의 — {center.name}</DialogTitle>
          <DialogDescription className="text-xs">
            이번 달/다음 달 개강 일정 확인 요청. 문구는 5종 중 랜덤으로
            선택되며 발송 전 수정할 수 있습니다.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <div className="text-xs text-muted-foreground mb-1.5">
              수신 전화번호
            </div>
            <div className="space-y-1.5 rounded-md border border-border p-3">
              {numberOptions.length === 0 && (
                <p className="text-xs text-warning">
                  이 교육원에 등록된 번호가 없습니다. 직접 입력해주세요.
                </p>
              )}
              {numberOptions.map((o) => (
                <label
                  key={o.key}
                  className="flex items-center gap-2 text-sm cursor-pointer"
                >
                  <input
                    type="radio"
                    name="inquiry-phone-choice"
                    className="accent-primary"
                    checked={choice === o.key}
                    onChange={() => setChoice(o.key)}
                    disabled={pending}
                  />
                  <span className="font-mono">{o.value}</span>
                  <span className="text-xs text-muted-foreground">
                    {o.label}
                  </span>
                </label>
              ))}
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="inquiry-phone-choice"
                  className="accent-primary shrink-0"
                  checked={choice === "custom"}
                  onChange={() => setChoice("custom")}
                  disabled={pending}
                />
                <span className="text-xs text-muted-foreground shrink-0">
                  직접 입력
                </span>
                <Input
                  type="tel"
                  value={customPhone}
                  onChange={(e) =>
                    setCustomPhone(formatPhoneInput(e.target.value))
                  }
                  onFocus={() => setChoice("custom")}
                  placeholder="010-0000-0000"
                  className="h-8 font-mono text-sm"
                  disabled={pending}
                />
              </label>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">
                본문 {new TextEncoder().encode(body).length} byte / 2000 byte
              </span>
              <button
                type="button"
                className="text-[11px] text-muted-foreground underline hover:text-foreground"
                onClick={() => setBody(pickClassInquiryMessage(messages))}
                disabled={pending}
              >
                다른 문구로 바꾸기
              </button>
            </div>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={7}
              className="text-sm leading-relaxed"
              disabled={pending}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            취소
          </Button>
          <Button type="button" onClick={onSend} disabled={pending}>
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            발송
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
