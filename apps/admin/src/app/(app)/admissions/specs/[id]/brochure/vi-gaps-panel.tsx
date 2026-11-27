"use client";

/**
 * 모집요강 PDF 베트남어판 — 베트남어 빈 칸 목록 (KAN-40). 인쇄 때 숨김.
 *   빈 칸이 있으면 경고하고, 칸마다 베트남어를 직접 넣거나 「AI 로 채우기」로 한 번에 채운다.
 *   AI 결과는 칸에만 들어간다 — 사람이 확인·수정한 뒤 「확인한 베트남어 저장」을 눌러야 반영된다.
 */

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronDown, ChevronUp, Languages, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { ViGap } from "@/lib/admission/brochure-vi-gaps";
import { saveViGapsAction, translateViGapsAction } from "./vi-actions";

export function ViGapsPanel({ specId, gaps }: { specId: string; gaps: ViGap[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [aiFilled, setAiFilled] = useState<Set<string>>(new Set());
  const [translating, startTranslate] = useTransition();
  const [saving, startSave] = useTransition();

  const groups = useMemo(() => {
    const m = new Map<string, ViGap[]>();
    for (const g of gaps) m.set(g.group, [...(m.get(g.group) ?? []), g]);
    return Array.from(m);
  }, [gaps]);
  const ready = gaps.filter((g) => values[g.id]?.trim());

  if (gaps.length === 0) {
    return (
      <div className="mx-6 mt-4 rounded-md border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm text-emerald-800 print:hidden">
        베트남어가 비어 있는 칸이 없습니다.
      </div>
    );
  }

  const fillWithAi = () =>
    startTranslate(async () => {
      const todo = gaps.filter((g) => !values[g.id]?.trim());
      if (todo.length === 0) return;
      const res = await translateViGapsAction(todo.map((g) => ({ where: g.where, text: g.ko })));
      if (!res.ok) {
        toast.error("번역하지 못했습니다", { description: res.error });
        return;
      }
      setValues((cur) => {
        const next = { ...cur };
        todo.forEach((g, i) => {
          if (res.items[i]) next[g.id] = res.items[i];
        });
        return next;
      });
      setAiFilled((cur) => new Set([...cur, ...todo.map((g) => g.id)]));
      setOpen(true);
      toast.success(`${todo.length}칸을 AI 로 채웠습니다. 확인·수정한 뒤 저장하세요.`);
    });

  const save = () => {
    if (ready.length === 0) return;
    if (!window.confirm(`확인한 베트남어 ${ready.length}칸을 저장할까요?\n서류 이름은 모든 대학 모집요강에 함께 쓰입니다.`)) return;
    startSave(async () => {
      const res = await saveViGapsAction(
        specId,
        ready.map((g) => ({ target: g.target, value: values[g.id] }))
      );
      if (!res.ok) {
        toast.error("저장하지 못했습니다", { description: res.error });
        return;
      }
      toast.success(`${res.saved}칸을 저장했습니다.`);
      setValues({});
      setAiFilled(new Set());
      router.refresh();
    });
  };

  return (
    <div className="mx-6 mt-4 rounded-md border border-amber-300 bg-amber-50 print:hidden">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <AlertTriangle className="size-5 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1 text-sm">
          <b>베트남어가 비어 있는 칸 {gaps.length}개</b>
          <span className="text-amber-900/80"> — 이대로 PDF 를 저장하면 한국어가 섞이거나 PC 에 따라 글자가 빠집니다.</span>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={fillWithAi} disabled={translating || saving}>
          {translating ? <Loader2 className="size-4 animate-spin" /> : <Languages className="size-4" />}
          {translating ? "번역 중…" : "AI 로 빈 칸 채우기"}
        </Button>
        <Button type="button" size="sm" onClick={save} disabled={ready.length === 0 || saving || translating}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          확인한 베트남어 저장 ({ready.length})
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>
          {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          {open ? "접기" : "칸 보기"}
        </Button>
      </div>
      {open ? (
        <div className="max-h-[60vh] space-y-4 overflow-auto border-t border-amber-200 bg-white px-4 py-3">
          {aiFilled.size > 0 ? (
            <p className="text-xs text-muted-foreground">노란 칸은 AI 가 채운 값입니다. 하나씩 읽고 고친 뒤 저장하세요.</p>
          ) : null}
          {groups.map(([group, list]) => (
            <section key={group}>
              <h3 className="mb-2 text-sm font-semibold">{group}</h3>
              <div className="space-y-2">
                {list.map((g) => (
                  <div key={g.id} className="grid gap-2 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_minmax(0,1fr)] md:items-start">
                    <div className="text-xs text-muted-foreground">{g.where}</div>
                    <div className="whitespace-pre-wrap rounded border border-border bg-muted/30 px-2 py-1.5 text-sm">{g.ko}</div>
                    <textarea
                      value={values[g.id] ?? ""}
                      onChange={(e) => setValues((cur) => ({ ...cur, [g.id]: e.target.value }))}
                      rows={g.ko.length > 60 ? 3 : 1}
                      placeholder="베트남어"
                      className={`w-full rounded border px-2 py-1.5 text-sm ${aiFilled.has(g.id) && values[g.id] ? "border-amber-300 bg-amber-50" : "border-input bg-background"}`}
                    />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}
