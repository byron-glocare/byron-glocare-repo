"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { setStudentClosedAction } from "../actions";

/** 학생 종료·되돌리기 — 학생 상세 머리 */
export function StudentCloseButton({
  studentId,
  name,
  closed,
}: {
  studentId: string;
  name: string;
  /** 지금 종료된 상태인가 */
  closed: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => {
        const ask = closed
          ? `${name} 학생의 종료를 되돌릴까요?`
          : `${name} 학생을 종료할까요?\n유학생 목록 기본 화면에서 빠집니다. 지원·서류는 그대로이고 나중에 되돌릴 수 있습니다.`;
        if (!window.confirm(ask)) return;
        start(async () => {
          const res = await setStudentClosedAction(studentId, !closed);
          if (res.ok) toast.success(closed ? "종료를 되돌렸습니다." : "학생을 종료했습니다.");
          else toast.error("처리하지 못했습니다", { description: res.error });
        });
      }}
    >
      {closed ? "종료 되돌리기" : "학생 종료"}
    </Button>
  );
}
