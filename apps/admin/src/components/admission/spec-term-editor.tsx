"use client";

/**
 * 모집요강 편집 — 학기 탭.
 *   학기마다 카드 하나 = 일정(일반학과·어학당 각각 ScheduleField)·메모 폼 + 그 학기에 모집하는 학과 체크리스트(study_offerings).
 *   체크 = draft 모집 행 추가, 해제 = draft 일 때만 삭제(published/closed 는 모집 메뉴 몫).
 */

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScheduleField, type Schedule } from "@/components/admission/schedule-field";
import type { SpecDepartmentKind, SpecTerm } from "@/lib/admission/spec-departments";
import {
  addSpecTermAction,
  deleteSpecTermAction,
  saveSpecTermAction,
  setTermDepartmentAction,
  type TermActionState,
} from "@/app/(app)/admissions/specs/[id]/edit/term-actions";

const inputClass = "rounded-md border border-input bg-background px-2 py-1.5 text-sm";
const SEASONS = ["Spring", "Summer", "Fall", "Winter", "Year"] as const;
const OFFERING_STATUS_LABEL: Record<string, string> = { draft: "초안", published: "노출 중", closed: "마감", archived: "보관" };

export type TermDept = { id: string; department_id: number; name_ko: string; kind: SpecDepartmentKind; is_active: boolean };
export type TermOffering = {
  id: string;
  department_id: number;
  term: string;
  status: string;
  /** 글로케어 모집 인원 */
  intake_quota: number | null;
  /** 학교 전체 정원 (0069) — 호출부가 아직 안 넘기면 undefined */
  total_quota?: number | null;
  /** 지원자 수 (취소 제외) — 선택 */
  applicant_count?: number;
};

/** "글로케어 N / 전체 M" — 값이 없는 쪽은 생략 */
export function quotaText(o: { intake_quota: number | null; total_quota?: number | null }): string | null {
  const parts: string[] = [];
  if (o.intake_quota != null) parts.push(`글로케어 ${o.intake_quota}`);
  if (o.total_quota != null) parts.push(`전체 ${o.total_quota}`);
  return parts.length ? parts.join(" / ") : null;
}

/** 올해-1 ~ 올해+2 의 학기 목록 */
export function termOptions(): string[] {
  const y = new Date().getFullYear();
  const out: string[] = [];
  for (let yy = y - 1; yy <= y + 2; yy++) for (const s of SEASONS) out.push(`${yy}-${s}`);
  return out;
}

export function SpecTermEditor({
  specId,
  terms,
  departments,
  offerings,
  revisions,
}: {
  specId: string;
  terms: SpecTerm[];
  departments: TermDept[];
  offerings: TermOffering[];
  revisions: Record<string, string>;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">학기마다 일정이 다릅니다. 그 학기에 모집하는 학과를 체크하면 모집(초안) 행이 만들어집니다.</p>
        <AddTermDialog specId={specId} terms={terms} />
      </div>
      {terms.length === 0 ? (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">학기가 없습니다. 학기를 추가하세요.</div>
      ) : null}
      {terms.map((t) => (
        <TermCard
          key={`${t.id}:${revisions[t.id] ?? ""}`}
          specId={specId}
          term={t}
          departments={departments}
          offerings={offerings.filter((o) => o.term === t.term)}
        />
      ))}
    </div>
  );
}

function TermCard({ specId, term, departments, offerings }: { specId: string; term: SpecTerm; departments: TermDept[]; offerings: TermOffering[] }) {
  const router = useRouter();
  const bound = saveSpecTermAction.bind(null, specId, term.id);
  const [state, action, pending] = useActionState<TermActionState, FormData>(bound, undefined);
  const [busy, startTransition] = useTransition();

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(`${term.term} 저장됨`);
      router.refresh();
    } else toast.error("저장 실패", { description: state.error });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const offeringByDept = new Map(offerings.map((o) => [o.department_id, o]));

  const toggle = (departmentId: number, on: boolean) =>
    startTransition(async () => {
      const res = await setTermDepartmentAction(specId, term.term, departmentId, on);
      if (res.ok) router.refresh();
      else toast.error(res.error);
    });

  const remove = () => {
    if (!confirm(`${term.term} 학기를 지울까요? 이 학기의 초안 모집 행도 함께 지워집니다.`)) return;
    startTransition(async () => {
      const res = await deleteSpecTermAction(specId, term.id);
      if (res.ok) {
        toast.success("학기를 지웠습니다");
        router.refresh();
      } else toast.error("지울 수 없습니다", { description: res.error });
    });
  };

  const fieldErr = (k: string) => (state && !state.ok ? state.fieldErrors?.[k] : undefined);

  return (
    <Card className="p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold">{term.term}</h3>
        <Badge variant="secondary">{offerings.length} 학과 모집</Badge>
        <div className="ml-auto">
          <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={busy} onClick={remove}>
            <Trash2 className="size-3.5" />
            학기 삭제
          </Button>
        </div>
      </div>

      <form action={action} className="space-y-3">
        <div className="grid gap-2 md:grid-cols-[12rem_1fr]">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">학기 (YYYY-Spring/Summer/Fall/Winter/Year)</span>
            <input type="text" name="term" defaultValue={term.term} pattern="^\d{4}-(Spring|Summer|Fall|Winter|Year)$" required className={inputClass} />
            {fieldErr("term") ? <span className="text-xs text-destructive">{fieldErr("term")}</span> : null}
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">메모</span>
            <input type="text" name="term_notes" defaultValue={term.notes ?? ""} className={inputClass} placeholder="이 학기만의 안내" />
          </label>
        </div>
        <details open className="rounded-md border border-input bg-muted/30">
          <summary className="cursor-pointer px-4 py-2 text-sm font-medium hover:bg-muted/50">일반학과 모집 일정</summary>
          <div className="border-t border-input p-3">
            <ScheduleField name="term_schedule" initial={(Object.keys(term.schedule).length ? term.schedule : null) as Schedule | null} />
          </div>
        </details>
        <details open className="rounded-md border border-input bg-muted/30">
          <summary className="cursor-pointer px-4 py-2 text-sm font-medium hover:bg-muted/50">어학당 모집 일정</summary>
          <div className="border-t border-input p-3">
            <ScheduleField name="term_schedule_language" initial={(Object.keys(term.schedule_language).length ? term.schedule_language : null) as Schedule | null} />
          </div>
        </details>
        {state && !state.ok ? <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</div> : null}
        <div className="flex items-center gap-2">
          <Button type="submit" size="sm" disabled={pending || busy}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            {term.term} 저장
          </Button>
        </div>
      </form>

      {/* 모집 학과 — 폼 밖: 체크 즉시 서버 반영 */}
      <div className="mt-4 rounded-md border p-3">
        <div className="mb-2 text-sm font-medium">이 학기에 모집하는 학과</div>
        {departments.length === 0 ? (
          <p className="text-xs text-muted-foreground">학과 탭에서 학과를 먼저 추가하세요.</p>
        ) : (
          <ul className="space-y-1.5">
            {departments.map((d) => {
              const o = offeringByDept.get(d.department_id);
              const locked = !!o && o.status !== "draft";
              return (
                <li key={d.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <label className={`flex items-center gap-2 ${locked ? "opacity-70" : ""}`}>
                    <input type="checkbox" checked={!!o} disabled={busy || locked} onChange={(e) => toggle(d.department_id, e.target.checked)} />
                    <span>{d.name_ko}</span>
                  </label>
                  <Badge variant="outline" className="text-[10px]">{d.kind === "language" ? "어학당" : "일반학과"}</Badge>
                  {!d.is_active ? <Badge variant="outline" className="text-[10px] text-muted-foreground">비활성</Badge> : null}
                  {o ? (
                    <>
                      <Badge variant={o.status === "published" ? "default" : "secondary"} className="text-[10px]">{OFFERING_STATUS_LABEL[o.status] ?? o.status}</Badge>
                      {o.applicant_count != null ? <span className="text-xs text-muted-foreground">지원 {o.applicant_count}</span> : null}
                      {quotaText(o) ? <span className="text-xs text-muted-foreground">{quotaText(o)}</span> : null}
                    </>
                  ) : null}
                  {locked ? <span className="text-xs text-muted-foreground">모집 메뉴에서 관리</span> : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}

function AddTermDialog({ specId, terms }: { specId: string; terms: SpecTerm[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const have = new Set(terms.map((t) => t.term));
  const options = termOptions().filter((t) => !have.has(t));
  const [term, setTerm] = useState(options[0] ?? "");
  const [custom, setCustom] = useState("");
  const [copyFrom, setCopyFrom] = useState(terms[0]?.id ?? "");
  const [copyDepts, setCopyDepts] = useState(true);
  const [pending, startTransition] = useTransition();

  const chosen = custom.trim() || term;
  const run = () =>
    startTransition(async () => {
      const res = await addSpecTermAction(specId, { term: chosen, copy_from_term_id: copyFrom || null, copy_departments: copyDepts && !!copyFrom });
      if (res.ok) {
        toast.success(`${chosen} 학기를 추가했습니다. 일정을 입력하세요.`);
        setOpen(false);
        setCustom("");
        router.refresh();
      } else toast.error("학기 추가 실패", { description: res.error });
    });

  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        학기 추가
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>학기 추가</DialogTitle>
            <DialogDescription>일정은 다른 학기에서 차수 이름만 가져오고 날짜는 비웁니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs text-muted-foreground">학기</span>
              <select className={inputClass} value={term} onChange={(e) => setTerm(e.target.value)} disabled={!!custom.trim()}>
                {options.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs text-muted-foreground">직접 입력 (목록에 없을 때, 예: 2029-Spring)</span>
              <input type="text" className={inputClass} value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="YYYY-Spring" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs text-muted-foreground">일정을 다음 학기에서 복사</span>
              <select className={inputClass} value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)}>
                <option value="">복사 안 함</option>
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>{t.term}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={copyDepts} onChange={(e) => setCopyDepts(e.target.checked)} disabled={!copyFrom} />
              그 학기의 모집 학과도 초안으로 넣기
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>취소</Button>
            <Button type="button" onClick={run} disabled={pending || !chosen}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              추가
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
