"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil, Save, X } from "lucide-react";

import {
  updateStudyContactStatus,
  updateStudyClaimStatus,
} from "@/app/(app)/students/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Status = "미확인" | "연락완료" | "등록완료";
type Kind = "contact" | "claim";

export function StudyStatusEditor({
  kind,
  id,
  initialStatus,
  initialMemo,
}: {
  kind: Kind;
  id: number;
  initialStatus: Status;
  initialMemo: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>(initialStatus);
  const [memo, setMemo] = useState(initialMemo ?? "");
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const action =
        kind === "contact" ? updateStudyContactStatus : updateStudyClaimStatus;
      const r = await action(id, {
        status,
        memo: memo.trim() === "" ? null : memo,
      });
      if (r.ok) {
        toast.success("저장되었습니다.");
        setOpen(false);
      } else {
        toast.error("저장 실패", { description: r.error });
      }
    });
  }

  function cancel() {
    setStatus(initialStatus);
    setMemo(initialMemo ?? "");
    setOpen(false);
  }

  if (!open) {
    return (
      <div className="flex items-center justify-between gap-2 group">
        <StatusBadge status={initialStatus} />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen(true)}
          className="opacity-0 group-hover:opacity-100 h-6 px-1.5"
        >
          <Pencil className="size-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value as Status)}
        className="h-7 rounded-md border border-input bg-card px-2 text-xs"
        disabled={pending}
      >
        <option value="미확인">미확인</option>
        <option value="연락완료">연락완료</option>
        <option value="등록완료">등록완료</option>
      </select>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={save}
        disabled={pending}
        className="h-7 px-1.5"
      >
        <Save className="size-3" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={cancel}
        disabled={pending}
        className="h-7 px-1.5"
      >
        <X className="size-3" />
      </Button>
    </div>
  );
}

export function MemoEditor({
  kind,
  id,
  status,
  initialMemo,
}: {
  kind: Kind;
  id: number;
  status: Status;
  initialMemo: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [memo, setMemo] = useState(initialMemo ?? "");
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const action =
        kind === "contact" ? updateStudyContactStatus : updateStudyClaimStatus;
      const r = await action(id, {
        status,
        memo: memo.trim() === "" ? null : memo,
      });
      if (r.ok) {
        toast.success("저장되었습니다.");
        setOpen(false);
      } else {
        toast.error("저장 실패", { description: r.error });
      }
    });
  }

  if (!open) {
    return (
      <div
        className="text-xs text-muted-foreground cursor-text hover:text-foreground min-h-[1.5rem] py-1 px-1 rounded hover:bg-muted/30"
        onClick={() => setOpen(true)}
        title="클릭해서 편집"
      >
        {initialMemo || (
          <span className="italic text-muted-foreground/60">+ 메모</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <textarea
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        rows={2}
        className="text-xs rounded border border-input bg-card p-1.5 resize-none"
        disabled={pending}
        autoFocus
      />
      <div className="flex gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={save}
          disabled={pending}
          className="h-6 px-2 text-xs"
        >
          저장
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setMemo(initialMemo ?? "");
            setOpen(false);
          }}
          disabled={pending}
          className="h-6 px-2 text-xs"
        >
          취소
        </Button>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const cls =
    status === "등록완료"
      ? "bg-success/10 text-success border-success/20"
      : status === "연락완료"
        ? "bg-info/10 text-info border-info/20"
        : "bg-warning/10 text-warning border-warning/20";
  return <Badge variant="outline" className={cls}>{status}</Badge>;
}
