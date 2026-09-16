"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { addSpecTermAction } from "./edit/term-actions";
import { termOptions } from "@/components/admission/spec-term-editor";

/**
 * 상세 화면의 "학기 추가" — 가장 늦은 학기의 일정에서 차수 이름만 가져와(날짜 비움) 새 학기를 만들고
 * 편집 화면 학기 탭으로 간다. (옛 "새 학기로 복제"를 대체 — 요강은 대학당 1개라 복제하지 않는다.)
 */
export function AddTermButton({ specId, terms }: { specId: string; terms: Array<{ id: string; term: string }> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const have = new Set(terms.map((t) => t.term));
  const options = termOptions().filter((t) => !have.has(t));
  const [term, setTerm] = useState(options[0] ?? "");
  const [pending, startTransition] = useTransition();
  const latest = terms[0] ?? null;

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <CalendarPlus className="size-4" />
        학기 추가
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1.5 rounded-md border bg-background px-2 py-1">
      <select value={term} onChange={(e) => setTerm(e.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-sm">
        {options.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
      <Button
        type="button"
        size="sm"
        disabled={pending || !term}
        onClick={() => {
          startTransition(async () => {
            const res = await addSpecTermAction(specId, { term, copy_from_term_id: latest?.id ?? null, copy_departments: true });
            if (res.ok) {
              toast.success(`${term} 학기를 만들었습니다. 일정을 입력하세요.`);
              router.push(`/admissions/specs/${specId}/edit?tab=terms`);
            } else toast.error("학기 추가 실패", { description: res.error });
          });
        }}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <CalendarPlus className="size-4" />}
        추가
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={pending}>
        취소
      </Button>
    </div>
  );
}
