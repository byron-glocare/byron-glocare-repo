"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { setTermsClosedAction } from "./actions";

/** 학기 종료·되돌리기 버튼 — confirmText 가 있으면 먼저 묻는다 */
export function TermCloseButton({
  ids,
  closed,
  label,
  confirmText,
  variant = "outline",
}: {
  ids: string[];
  /** 누르면 이 상태가 된다 */
  closed: boolean;
  label: string;
  confirmText: string;
  variant?: "outline" | "default" | "ghost";
}) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(confirmText)) return;
        start(async () => {
          const res = await setTermsClosedAction(ids, closed);
          if (res.ok) toast.success(closed ? "학기를 종료했습니다." : "학기 종료를 되돌렸습니다.");
          else toast.error("처리하지 못했습니다", { description: res.error });
        });
      }}
    >
      {label}
    </Button>
  );
}
