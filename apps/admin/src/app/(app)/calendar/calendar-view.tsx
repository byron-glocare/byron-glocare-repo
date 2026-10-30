"use client";

/**
 * 모집 일정 달력 — 승인된 모집요강의 일정을 월 달력에 띄운다.
 *
 *   왼쪽 필터 두 개(엑셀 필터처럼 체크박스):
 *     · 모집요강별 = 대학 > 학과·학기
 *     · 단계별     = 원서 마감, 면접, 합격 발표 …
 *   체크 상태는 저장하지 않는다 — 들어올 때마다 전부 체크된 상태로 시작(요청 사항).
 *   마감(…마감) 일정은 붉게 — 놓치면 안 되는 날.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CalendarEvent, CalendarItem, StageKey } from "@/lib/admission/schedule-calendar";

const PALETTE = ["#2563eb", "#db2777", "#059669", "#d97706", "#7c3aed", "#0891b2", "#dc2626", "#65a30d", "#c026d3", "#0d9488", "#ea580c", "#4f46e5"];
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const MAX_IN_CELL = 4;

const pad = (n: number) => String(n).padStart(2, "0");
const isDeadline = (e: CalendarEvent) => e.label.endsWith("마감");

export function CalendarView({
  items,
  events,
  stages,
  today,
}: {
  items: CalendarItem[];
  events: CalendarEvent[];
  stages: readonly { key: StageKey; label: string }[];
  /** 'YYYY-MM-DD' (서울 기준, 서버에서 넘김) */
  today: string;
}) {
  const [checkedItems, setCheckedItems] = useState<Set<string>>(() => new Set(items.map((i) => i.id)));
  const [checkedStages, setCheckedStages] = useState<Set<StageKey>>(() => new Set(stages.map((s) => s.key)));
  const [month, setMonth] = useState(() => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 }));
  const [selected, setSelected] = useState(today);

  const colorOf = useMemo(() => {
    const ids = Array.from(new Set(items.map((i) => i.universityId)));
    return (uid: number) => PALETTE[ids.indexOf(uid) % PALETTE.length] ?? PALETTE[0];
  }, [items]);
  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const visible = useMemo(
    () => events.filter((e) => checkedStages.has(e.stage) && e.itemIds.some((id) => checkedItems.has(id))),
    [events, checkedItems, checkedStages]
  );
  const byDate = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    for (const e of visible) {
      const list = m.get(e.date) ?? [];
      list.push(e);
      m.set(e.date, list);
    }
    return m;
  }, [visible]);

  // 이 달 칸 — 일요일 시작 주 단위
  const cells = useMemo(() => {
    const first = new Date(Date.UTC(month.y, month.m, 1));
    const startDow = first.getUTCDay();
    const days = new Date(Date.UTC(month.y, month.m + 1, 0)).getUTCDate();
    const out: { date: string; inMonth: boolean; day: number }[] = [];
    const total = Math.ceil((startDow + days) / 7) * 7;
    for (let i = 0; i < total; i++) {
      const d = new Date(Date.UTC(month.y, month.m, 1 - startDow + i));
      out.push({
        date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
        inMonth: d.getUTCMonth() === month.m,
        day: d.getUTCDate(),
      });
    }
    return out;
  }, [month]);

  const moveMonth = (delta: number) =>
    setMonth(({ y, m }) => {
      const n = m + delta;
      return { y: y + Math.floor(n / 12), m: ((n % 12) + 12) % 12 };
    });
  const goToday = () => {
    setMonth({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 });
    setSelected(today);
  };

  // 체크박스 조작
  const toggleItems = (ids: string[], on: boolean) =>
    setCheckedItems((cur) => {
      const next = new Set(cur);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  const toggleStage = (k: StageKey) =>
    setCheckedStages((cur) => {
      const next = new Set(cur);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  // 대학별 묶음
  const groups = useMemo(() => {
    const out: { universityId: number; university: string; items: CalendarItem[] }[] = [];
    for (const it of items) {
      const g = out.find((x) => x.universityId === it.universityId);
      if (g) g.items.push(it);
      else out.push({ universityId: it.universityId, university: it.university, items: [it] });
    }
    return out;
  }, [items]);

  const stageCount = useMemo(() => {
    const m = new Map<StageKey, number>();
    for (const e of events) if (e.itemIds.some((id) => checkedItems.has(id))) m.set(e.stage, (m.get(e.stage) ?? 0) + 1);
    return m;
  }, [events, checkedItems]);

  /** 이 일정에 해당하는(체크된) 학과 이름 */
  const deptText = (e: CalendarEvent) => {
    const names = e.itemIds.filter((id) => checkedItems.has(id)).map((id) => itemById.get(id)?.department ?? "");
    if (e.isLanguage) return names[0] ?? "어학당";
    return names.length <= 2 ? names.join(", ") : `${names[0]} 외 ${names.length - 1}개 학과`;
  };
  const chipText = (e: CalendarEvent) =>
    `${e.university}${e.isLanguage ? " 어학당" : ""} ${e.round ? `${e.round} ` : ""}${e.label}`;

  const selectedEvents = byDate.get(selected) ?? [];
  const monthCount = visible.filter((e) => e.date.startsWith(`${month.y}-${pad(month.m + 1)}`)).length;

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      {/* 필터 */}
      <div className="space-y-4">
        <FilterBox
          title="모집요강별"
          onAll={() => setCheckedItems(new Set(items.map((i) => i.id)))}
          onNone={() => setCheckedItems(new Set())}
        >
          {groups.map((g) => {
            const ids = g.items.map((i) => i.id);
            const n = ids.filter((id) => checkedItems.has(id)).length;
            return (
              <div key={g.universityId} className="py-1">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <TriCheckbox
                    checked={n === ids.length}
                    indeterminate={n > 0 && n < ids.length}
                    onChange={(on) => toggleItems(ids, on)}
                  />
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: colorOf(g.universityId) }} />
                  <span className="truncate">{g.university}</span>
                </label>
                <div className="mt-0.5 space-y-0.5 pl-6">
                  {g.items.map((it) => (
                    <label key={it.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        className="size-3.5 accent-primary"
                        checked={checkedItems.has(it.id)}
                        onChange={(e) => toggleItems([it.id], e.target.checked)}
                      />
                      <span className="truncate">
                        {it.department} · {it.termLabel}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
          {groups.length === 0 ? <p className="py-2 text-xs text-muted-foreground">승인된 모집요강에 일정이 없습니다.</p> : null}
        </FilterBox>

        <FilterBox
          title="단계별"
          onAll={() => setCheckedStages(new Set(stages.map((s) => s.key)))}
          onNone={() => setCheckedStages(new Set())}
        >
          {stages.map((s) => (
            <label key={s.key} className="flex items-center gap-2 py-0.5 text-sm">
              <input
                type="checkbox"
                className="size-3.5 accent-primary"
                checked={checkedStages.has(s.key)}
                onChange={() => toggleStage(s.key)}
              />
              <span className="flex-1">{s.label}</span>
              <span className="text-xs tabular-nums text-muted-foreground">{stageCount.get(s.key) ?? 0}</span>
            </label>
          ))}
        </FilterBox>
      </div>

      {/* 달력 */}
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon-sm" onClick={() => moveMonth(-1)} aria-label="이전 달">
            <ChevronLeft className="size-4" />
          </Button>
          <h2 className="min-w-28 text-center text-lg font-semibold tabular-nums">
            {month.y}년 {month.m + 1}월
          </h2>
          <Button variant="outline" size="icon-sm" onClick={() => moveMonth(1)} aria-label="다음 달">
            <ChevronRight className="size-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToday}>
            오늘
          </Button>
          <span className="ml-auto text-xs text-muted-foreground">
            이 달 일정 {monthCount}개 · <span className="font-medium text-destructive">붉은 글씨 = 마감</span>
          </span>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <div className="grid min-w-[720px] grid-cols-7">
            {WEEKDAYS.map((w, i) => (
              <div
                key={w}
                className={cn(
                  "border-b border-border bg-muted/40 px-2 py-1.5 text-center text-xs font-medium",
                  i === 0 && "text-destructive",
                  i === 6 && "text-primary"
                )}
              >
                {w}
              </div>
            ))}
            {cells.map((c, i) => {
              const list = byDate.get(c.date) ?? [];
              const isToday = c.date === today;
              const isSel = c.date === selected;
              return (
                <div
                  key={c.date}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelected(c.date)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setSelected(c.date)}
                  className={cn(
                    "min-h-28 cursor-pointer border-border p-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    i % 7 !== 6 && "border-r",
                    i < cells.length - 7 && "border-b",
                    !c.inMonth && "bg-muted/30",
                    isSel && "bg-primary/5"
                  )}
                >
                  <div className="mb-0.5 flex items-center justify-between">
                    <span
                      className={cn(
                        "inline-flex size-6 items-center justify-center rounded-full text-xs tabular-nums",
                        !c.inMonth && "text-muted-foreground/60",
                        isToday && "bg-primary font-semibold text-primary-foreground"
                      )}
                    >
                      {c.day}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {list.slice(0, MAX_IN_CELL).map((e) => (
                      <div
                        key={e.id}
                        title={`${chipText(e)}\n${deptText(e)} · ${e.termLabel}`}
                        className={cn(
                          "truncate rounded-sm border-l-[3px] bg-muted/50 px-1 py-px text-[11px] leading-tight",
                          isDeadline(e) && "font-medium text-destructive"
                        )}
                        style={{ borderLeftColor: colorOf(e.universityId) }}
                      >
                        {chipText(e)}
                      </div>
                    ))}
                    {list.length > MAX_IN_CELL ? (
                      <div className="px-1 text-[11px] text-muted-foreground">+{list.length - MAX_IN_CELL}개 더</div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 고른 날짜의 일정 */}
        <div className="rounded-lg border border-border">
          <div className="border-b border-border px-4 py-2.5 text-sm font-semibold">
            {Number(selected.slice(5, 7))}월 {Number(selected.slice(8, 10))}일 일정{" "}
            <span className="font-normal text-muted-foreground">({selectedEvents.length})</span>
          </div>
          {selectedEvents.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">이 날짜에 표시할 일정이 없습니다.</p>
          ) : (
            <ul className="divide-y divide-border">
              {selectedEvents.map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: colorOf(e.universityId) }} />
                  <div className="min-w-0 flex-1">
                    <div className={cn("text-sm font-medium", isDeadline(e) && "text-destructive")}>
                      {e.label}
                      {e.time ? ` ${e.time}` : ""}
                      {e.round ? <span className="ml-1.5 font-normal text-muted-foreground">{e.round}</span> : null}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {e.university}
                      {e.isLanguage ? " 어학당" : ""} · {deptText(e)} · {e.termLabel}
                    </div>
                  </div>
                  <Link href={`/admissions/specs/${e.specId}`} className="shrink-0 text-xs text-primary hover:underline">
                    모집요강
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterBox({
  title,
  onAll,
  onNone,
  children,
}: {
  title: string;
  onAll: () => void;
  onNone: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span className="flex-1 text-sm font-semibold">{title}</span>
        <button type="button" onClick={onAll} className="text-xs text-primary hover:underline">
          전체 선택
        </button>
        <button type="button" onClick={onNone} className="text-xs text-muted-foreground hover:underline">
          전체 해제
        </button>
      </div>
      <div className="max-h-[50vh] overflow-y-auto px-3 py-2">{children}</div>
    </div>
  );
}

/** 일부만 체크된 상태(−)를 보여주는 체크박스 */
function TriCheckbox({
  checked,
  indeterminate,
  onChange,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: (on: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      className="size-4 accent-primary"
      checked={checked}
      onChange={() => onChange(!checked)}
    />
  );
}
