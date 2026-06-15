"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cloneSpecToTermAction } from "./clone-action";

const TERM_OPTIONS = [
  "2026-Spring",
  "2026-Summer",
  "2026-Fall",
  "2026-Winter",
  "2026-Year",
  "2027-Spring",
  "2027-Fall",
];

/**
 * U4: 이 모집요강을 새 학기로 복제.
 *   서류·자격·학비·장학은 그대로, 일정 날짜는 비운 초안을 만들고 편집 화면으로 이동.
 */
export function CloneSpecButton({
  specId,
  currentTerm,
}: {
  specId: string;
  currentTerm: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState(
    TERM_OPTIONS.find((t) => t !== currentTerm) ?? ""
  );
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <Copy className="size-4" />
        새 학기로 복제
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1.5 rounded-md border bg-background px-2 py-1">
      <select
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        className="h-8 rounded-md border border-input bg-background px-2 text-sm"
      >
        {TERM_OPTIONS.map((t) => (
          <option key={t} value={t} disabled={t === currentTerm}>
            {t}
            {t === currentTerm ? " (현재)" : ""}
          </option>
        ))}
      </select>
      <Button
        type="button"
        size="sm"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            const res = await cloneSpecToTermAction(specId, term);
            if (res.ok && res.id) {
              if (res.error) toast.info(res.error);
              else toast.success(`${term} 초안을 만들었습니다. 일정을 입력하세요.`);
              router.push(`/admissions/specs/${res.id}/edit`);
            } else {
              toast.error("복제 실패", { description: res.error });
            }
          });
        }}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Copy className="size-4" />}
        복제
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen(false)}
        disabled={pending}
      >
        취소
      </Button>
    </div>
  );
}
