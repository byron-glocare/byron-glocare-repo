"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";

import { sendClassInquirySms } from "@/app/(app)/sms/actions";
import { pickClassInquiryMessage } from "@/lib/sms-templates";
import { pickCenterSmsPhone, SMS_RECIPIENT_LABEL } from "@/lib/sms-recipient";
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

/**
 * 강의 정보 문의 발송 다이얼로그 — 5종 랜덤 문구 + 편집 후 발송.
 * 수신 번호 기본값 = 교육원의 문자 발송 선택(sms_recipient) → 대표 연락처.
 */
export function ClassInquiryDialog({
  center,
  open,
  onOpenChange,
  onSent,
}: {
  center: InquiryCenter;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent?: () => void;
}) {
  const smsSelected = pickCenterSmsPhone(center);
  const defaultSmsPhone = smsSelected?.phone ?? center.phone ?? "";
  const defaultSmsLabel = smsSelected
    ? SMS_RECIPIENT_LABEL[smsSelected.source]
    : "대표 연락처";

  const [body, setBody] = useState("");
  const [phone, setPhone] = useState("");
  const [pending, startTransition] = useTransition();

  // 열릴 때마다 랜덤 문구 + 기본 번호로 리셋
  useEffect(() => {
    if (open) {
      setBody(pickClassInquiryMessage());
      setPhone(defaultSmsPhone);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, center.id]);

  function onSend() {
    const trimmedPhone = phone.trim();
    if (!trimmedPhone) {
      toast.error("수신 전화번호를 입력하세요.");
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
        phoneOverride: trimmedPhone,
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
            <label className="text-xs text-muted-foreground block mb-1">
              수신 전화번호 (기본값: 교육원 {defaultSmsLabel}
              {defaultSmsPhone ? ` ${defaultSmsPhone}` : " 없음"})
            </label>
            <Input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="010-0000-0000"
              disabled={pending}
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">
                본문 {new TextEncoder().encode(body).length} byte / 2000 byte
              </span>
              <button
                type="button"
                className="text-[11px] text-muted-foreground underline hover:text-foreground"
                onClick={() => setBody(pickClassInquiryMessage())}
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
