"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { reassignStudentAction } from "../actions";

/**
 * 유학생 소속 유학센터 변경(재배정) — 글로케어 어드민 전용.
 *   현재 센터 표시 + [변경] → 드롭다운(유학센터 마스터 목록) → 저장.
 */
export function ReassignCenter({
  studentId,
  currentStudyCenterId,
  centers,
}: {
  studentId: string;
  currentStudyCenterId: number | null;
  centers: { id: number; name: string }[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [sel, setSel] = useState<string>(
    currentStudyCenterId ? String(currentStudyCenterId) : ""
  );
  const [pending, start] = useTransition();

  function save() {
    const id = Number(sel);
    if (!id) {
      toast.error("유학센터를 선택하세요");
      return;
    }
    start(async () => {
      const r = await reassignStudentAction(studentId, id);
      if (!r.ok) {
        toast.error("변경 실패", { description: r.error });
        return;
      }
      toast.success("유학센터를 변경했습니다.");
      setEditing(false);
      router.refresh();
    });
  }

  if (!editing) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setEditing(true)}
      >
        유학센터 변경
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={sel}
        onChange={(e) => setSel(e.target.value)}
        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
      >
        <option value="">— 유학센터 선택 —</option>
        {centers.map((c) => (
          <option key={c.id} value={String(c.id)}>
            {c.name}
          </option>
        ))}
      </select>
      <Button type="button" size="sm" onClick={save} disabled={pending}>
        {pending ? "저장 중…" : "저장"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setEditing(false)}
        disabled={pending}
      >
        취소
      </Button>
    </div>
  );
}
