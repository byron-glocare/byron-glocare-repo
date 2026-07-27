"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  approveUniversityRequestAction,
  rejectUniversityRequestAction,
} from "./actions";

export function RequestRowActions({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const approve = () =>
    start(async () => {
      const r = await approveUniversityRequestAction({ requestId });
      if (r.ok) {
        toast.success("승인 — 대학을 카탈로그에 추가했습니다.");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });

  const reject = () =>
    start(async () => {
      const r = await rejectUniversityRequestAction(requestId);
      if (r.ok) {
        toast.success("요청을 거절했습니다.");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });

  return (
    <div className="flex gap-2">
      <Button size="sm" onClick={approve} disabled={pending}>
        승인
      </Button>
      <Button size="sm" variant="outline" onClick={reject} disabled={pending}>
        거절
      </Button>
    </div>
  );
}
