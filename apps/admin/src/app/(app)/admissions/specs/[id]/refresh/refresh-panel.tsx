"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  buildRefreshItems,
  displayLines,
  type RefreshDept,
  type RefreshItem,
  type RefreshTerm,
} from "@/lib/admission/spec-refresh";
import type { CallExtractResult } from "@/lib/admission/call-extract";
import { applySpecRefreshAction } from "./actions";

const selectClass = "rounded-md border border-input bg-background px-2 py-1.5 text-sm";

const PROGRAM_KO: Record<string, string> = {
  language_program: "어학연수",
  associate_2yr: "전문학사(2년제)",
  bachelor_3yr_extension: "학사 3년(전공심화)",
  bachelor_4yr: "학사 4년",
};

export function RefreshPanel({
  specId,
  depts,
  terms,
  specEligibility,
}: {
  specId: string;
  depts: RefreshDept[];
  terms: Array<RefreshTerm & { label: string }>;
  specEligibility: Record<string, unknown> | null;
}) {
  const router = useRouter();
  const [deptId, setDeptId] = useState(depts[0]?.id ?? "");
  const [termId, setTermId] = useState(terms[0]?.id ?? "");
  const [extracted, setExtracted] = useState<Record<string, unknown> | null>(null);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [applying, startApply] = useTransition();

  useEffect(() => {
    if (!running) return;
    const started = Date.now();
    const t = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(t);
  }, [running]);

  const dept = depts.find((d) => d.id === deptId) ?? null;
  const term = terms.find((t) => t.id === termId) ?? null;
  const items = useMemo<RefreshItem[]>(
    () => (extracted && dept ? buildRefreshItems({ extracted, dept, term, specEligibility }) : []),
    [extracted, dept, term, specEligibility]
  );
  const groups = useMemo(() => {
    const m = new Map<string, RefreshItem[]>();
    for (const it of items) m.set(it.group, [...(m.get(it.group) ?? []), it]);
    return Array.from(m);
  }, [items]);

  const programType = String((extracted?.identity as { program_type?: string } | undefined)?.program_type ?? "");
  const kindMismatch =
    !!extracted && !!dept && !!programType && (programType === "language_program") !== (dept.kind === "language");

  const run = async () => {
    setRunning(true);
    setElapsed(0);
    setError(null);
    setPicked(new Set());
    try {
      const res = await fetch(`/api/admissions/specs/${specId}/refresh-extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term: term?.term ?? "" }),
      });
      const raw = await res.text();
      let json: CallExtractResult | null = null;
      try {
        json = JSON.parse(raw) as CallExtractResult;
      } catch {
        json = null;
      }
      if (!json) {
        setError(res.status === 504 ? "AI 추출이 제한 시간을 넘겼습니다. 잠시 뒤 다시 해 주세요." : `서버 오류 (HTTP ${res.status})`);
        return;
      }
      if (!json.ok) {
        setError(json.error);
        return;
      }
      setExtracted(json.spec);
      // 원본 종류에 맞는 학과로
      const pt = String((json.spec.identity as { program_type?: string } | undefined)?.program_type ?? "");
      const wantLanguage = pt === "language_program";
      if (dept && (dept.kind === "language") !== wantLanguage) {
        const next = depts.find((d) => (d.kind === "language") === wantLanguage);
        if (next) setDeptId(next.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const apply = () => {
    const chosen = items.filter((it) => picked.has(it.id));
    if (chosen.length === 0) return;
    const risky = chosen.filter((it) => it.caution).length;
    const ask = `고른 ${chosen.length}개 항목을 원본 값으로 바꿀까요?${risky ? `\n그중 ${risky}개는 "주의" 항목입니다(지금 입력이 더 자세함).` : ""}`;
    if (!window.confirm(ask)) return;
    startApply(async () => {
      const res = await applySpecRefreshAction(
        specId,
        chosen.map((it) => ({ target: it.target, path: it.path, value: it.proposed }))
      );
      if (!res.ok) {
        toast.error("적용하지 못했습니다", { description: res.error });
        return;
      }
      toast.success(`${res.applied}개 항목을 바꿨습니다.`);
      setPicked(new Set());
      router.refresh();
    });
  };

  const fillable = items.filter((it) => it.fillsEmpty);
  const cautionCount = items.filter((it) => it.caution).length;

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-end gap-3 p-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">비교할 학과</span>
          <select className={selectClass} value={deptId} onChange={(e) => { setDeptId(e.target.value); setPicked(new Set()); }} disabled={running || applying}>
            {depts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name_ko}
                {d.kind === "language" ? " (어학당)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">일정을 비교할 학기</span>
          <select className={selectClass} value={termId} onChange={(e) => { setTermId(e.target.value); setPicked(new Set()); }} disabled={running || applying || terms.length === 0}>
            {terms.length === 0 ? <option value="">학기 없음</option> : null}
            {terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <Button type="button" onClick={run} disabled={running || applying || !dept}>
          {running ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          {running ? `원본 읽는 중… ${elapsed}초` : extracted ? "원본 다시 읽기" : "원본 읽기"}
        </Button>
        <p className="w-full text-xs text-muted-foreground">
          AI 가 보관된 원본을 읽는 데 1~3분 걸립니다. 읽기만 해서는 아무것도 바뀌지 않습니다. 서류 목록은 비교하지 않습니다(서류 탭에서 관리).
        </p>
      </Card>

      {error ? <Card className="border-destructive/40 p-4 text-sm text-destructive">{error}</Card> : null}

      {extracted ? (
        <>
          <Card className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4 text-sm">
            <span>
              원본 종류: <b>{PROGRAM_KO[programType] ?? (programType || "알 수 없음")}</b>
            </span>
            <span>
              다른 항목 <b>{items.length}</b>개 · 빈 칸 채우기 {fillable.length}개 · 주의 {cautionCount}개
            </span>
            {kindMismatch ? (
              <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="size-4" />
                원본 종류와 고른 학과 종류가 다릅니다. 학과를 확인하세요.
              </span>
            ) : null}
            <div className="ml-auto flex gap-2">
              <Button type="button" variant="outline" size="sm" disabled={fillable.length === 0 || applying} onClick={() => setPicked(new Set(fillable.map((it) => it.id)))}>
                빈 칸 채우기만 고르기
              </Button>
              <Button type="button" variant="ghost" size="sm" disabled={picked.size === 0 || applying} onClick={() => setPicked(new Set())}>
                선택 해제
              </Button>
              <Button type="button" size="sm" disabled={picked.size === 0 || applying} onClick={apply}>
                {applying ? <Loader2 className="size-4 animate-spin" /> : null}
                고른 {picked.size}개 적용
              </Button>
            </div>
          </Card>

          {items.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">지금 입력값과 원본이 다른 항목이 없습니다.</Card>
          ) : (
            groups.map(([group, list]) => (
              <Card key={group} className="gap-0 p-0">
                <h2 className="border-b border-border px-4 py-3 text-sm font-semibold">{group}</h2>
                <ul className="divide-y divide-border">
                  {list.map((it) => (
                    <li key={it.id} className="px-4 py-3.5">
                      <label className="flex cursor-pointer items-start gap-3">
                        <input
                          type="checkbox"
                          className="mt-1 size-4 shrink-0"
                          checked={picked.has(it.id)}
                          onChange={() => toggle(it.id)}
                          disabled={applying}
                        />
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium">{it.label}</span>
                            {it.fillsEmpty ? <Badge variant="secondary">빈 칸 채움</Badge> : null}
                            {it.caution ? (
                              <span className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
                                <AlertTriangle className="size-3.5" />
                                주의: {it.caution}
                              </span>
                            ) : null}
                          </div>
                          <div className="grid gap-2 md:grid-cols-2">
                            <ValueBox title="지금" value={it.current} />
                            <ValueBox title="원본" value={it.proposed} highlight />
                          </div>
                        </div>
                      </label>
                    </li>
                  ))}
                </ul>
              </Card>
            ))
          )}
        </>
      ) : null}
    </div>
  );
}

function ValueBox({ title, value, highlight }: { title: string; value: unknown; highlight?: boolean }) {
  return (
    <div className={`rounded-md border p-2.5 ${highlight ? "border-primary/30 bg-primary/5" : "border-border bg-muted/30"}`}>
      <div className="mb-1 text-xs text-muted-foreground">{title}</div>
      <pre className="max-h-64 overflow-auto font-sans text-xs leading-relaxed whitespace-pre-wrap">{displayLines(value).join("\n")}</pre>
    </div>
  );
}
