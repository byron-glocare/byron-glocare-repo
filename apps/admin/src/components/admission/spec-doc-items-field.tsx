"use client";

/**
 * 모집요강 편집 — 제출서류(발급) 를 **항목**으로 고르는 필드.
 *
 *   대학은 서류를 직접 적지 않고 제출서류 탭의 항목을 고른다(D1 결정). 항목 안의 서류는
 *   베트남 기준 구성이 미리보기로 나온다. 요강별로 바꿀 수 있는 건 필수 여부, 안내문(통째
 *   덮어쓰기), 서류별 조건(인증·유효기간·발급 후 일수·원본)뿐이다. 나머지는 표준을 따라간다.
 *
 *   저장 형식: hidden input `<name>` 에 SpecDocItemRow[] JSON.
 */

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  expandItem,
  TARGET_LABEL_KO,
  type CatalogItem,
  type CatalogStandard,
  type DocCatalog,
  type SpecDocItemRow,
  type StandardOverride,
} from "@/lib/admission/spec-doc-items";

const NOTA_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "표준대로" },
  { value: "none", label: "인증 없음" },
  { value: "translation_notarization", label: "번역 공증" },
  { value: "consul", label: "영사확인" },
  { value: "consul_for_vietnam", label: "베트남 영사확인" },
  { value: "apostille", label: "아포스티유" },
  { value: "apostille_or_consul", label: "아포스티유 또는 영사확인" },
];
const NOTA_LABEL: Record<string, string> = Object.fromEntries(NOTA_OPTIONS.filter((o) => o.value).map((o) => [o.value, o.label]));

const inputClass = "rounded-md border border-input bg-background px-2 py-1 text-sm";

export function SpecDocItemsField({ name, initial, catalog }: { name: string; initial: SpecDocItemRow[]; catalog: DocCatalog }) {
  const [rows, setRows] = useState<SpecDocItemRow[]>(() => initial.map((r) => ({ ...r, overrides: r.overrides ?? {} })));
  const [adding, setAdding] = useState("");
  const [open, setOpen] = useState<Set<string>>(() => new Set());

  const itemByKey = useMemo(() => new Map(catalog.items.map((i) => [i.key, i])), [catalog.items]);
  const chosen = new Set(rows.map((r) => r.item_key));
  const choices = catalog.items.filter((i) => i.is_active && !chosen.has(i.key));

  const update = (idx: number, patch: Partial<SpecDocItemRow>) => setRows((cur) => cur.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const move = (idx: number, dir: -1 | 1) =>
    setRows((cur) => {
      const n = [...cur];
      const j = idx + dir;
      if (j < 0 || j >= n.length) return cur;
      [n[idx], n[j]] = [n[j], n[idx]];
      return n;
    });
  const remove = (idx: number) => setRows((cur) => cur.filter((_, i) => i !== idx));
  const add = () => {
    if (!adding) return;
    setRows((cur) => [...cur, { item_key: adding, required: true, sort_order: cur.length + 1, guide_override_ko: null, guide_override_vi: null, overrides: {} }]);
    setAdding("");
  };
  const toggleOpen = (key: string) =>
    setOpen((cur) => { const n = new Set(cur); if (n.has(key)) n.delete(key); else n.add(key); return n; });

  const setStdOverride = (idx: number, stdKey: string, patch: StandardOverride) =>
    setRows((cur) =>
      cur.map((r, i) => {
        if (i !== idx) return r;
        const stds = { ...(r.overrides?.standards ?? {}) };
        const merged: StandardOverride = { ...(stds[stdKey] ?? {}), ...patch };
        // 비운 값은 빼서 "표준대로"로 돌린다
        for (const k of Object.keys(merged) as (keyof StandardOverride)[]) if (merged[k] == null || (merged[k] as unknown) === "") delete merged[k];
        if (Object.keys(merged).length === 0) delete stds[stdKey]; else stds[stdKey] = merged;
        return { ...r, overrides: { ...r.overrides, standards: stds } };
      })
    );

  const serialized = JSON.stringify(rows.map((r, i) => ({ ...r, sort_order: i + 1 })));

  return (
    <div className="space-y-3">
      {rows.length === 0 ? (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          고른 항목이 없습니다. 아래에서 항목을 골라 추가하세요.
        </div>
      ) : (
        <ol className="space-y-2">
          {rows.map((r, idx) => {
            const item = itemByKey.get(r.item_key);
            const slots = item ? expandItem(item, catalog) : [];
            const isOpen = open.has(r.item_key);
            const customized = !!r.guide_override_ko?.trim() || !!r.guide_override_vi?.trim() || Object.keys(r.overrides?.standards ?? {}).length > 0;
            return (
              <li key={r.item_key} className="rounded-md border bg-background p-3">
                <div className="flex flex-wrap items-start gap-2">
                  <div className="flex shrink-0 flex-col">
                    <button type="button" aria-label="위로" className="text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={idx === 0} onClick={() => move(idx, -1)}><ArrowUp className="size-3.5" /></button>
                    <button type="button" aria-label="아래로" className="text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={idx === rows.length - 1} onClick={() => move(idx, 1)}><ArrowDown className="size-3.5" /></button>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{item?.name_ko ?? r.item_key}</span>
                      {!item ? <Badge variant="outline" className="text-[10px] text-destructive">없는 항목</Badge> : null}
                      {item && !item.is_active ? <Badge variant="outline" className="text-[10px]">비활성</Badge> : null}
                      {customized ? <Badge variant="outline" className="text-[10px] text-primary">따로 설정</Badge> : null}
                    </div>
                    <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                      {slots.map((s, si) => (
                        <li key={si}>
                          {s.standard.name_ko}{s.target ? ` - ${TARGET_LABEL_KO[s.target] ?? s.target}` : ""}
                          {s.alternatives.length ? <span> (또는 {s.alternatives.map((a) => a.name_ko).join(", ")})</span> : null}
                          {!s.required ? <span> · 선택</span> : null}
                          <StdSummary s={s.standard} o={r.overrides?.standards?.[s.standard.key]} />
                        </li>
                      ))}
                      {item && slots.length === 0 ? <li>서류가 없는 항목입니다.</li> : null}
                    </ul>
                  </div>
                  <label className="flex shrink-0 items-center gap-1.5 text-xs">
                    <input type="checkbox" checked={r.required !== false} onChange={(e) => update(idx, { required: e.target.checked })} /> 필수
                  </label>
                  <button type="button" className="shrink-0 text-xs text-muted-foreground hover:text-foreground" onClick={() => toggleOpen(r.item_key)}>
                    {isOpen ? "닫기" : "따로 설정"}
                  </button>
                  <Button type="button" variant="ghost" size="sm" className="shrink-0 text-destructive hover:text-destructive" aria-label="항목 빼기" onClick={() => remove(idx)}><Trash2 className="size-4" /></Button>
                </div>

                {isOpen ? (
                  <div className="mt-3 space-y-3 border-t pt-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">이 대학 안내문 (한국어) — 있으면 표준 안내문 대신 이것만 보여줍니다</span>
                        <textarea rows={2} className={inputClass} value={r.guide_override_ko ?? ""} onChange={(e) => update(idx, { guide_override_ko: e.target.value })} placeholder={item?.guide_ko ?? "표준 안내문을 그대로 씁니다"} />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">이 대학 안내문 (베트남어)</span>
                        <textarea rows={2} className={inputClass} value={r.guide_override_vi ?? ""} onChange={(e) => update(idx, { guide_override_vi: e.target.value })} placeholder={item?.guide_vi ?? ""} />
                      </label>
                    </div>
                    {slots.length > 0 ? (
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground">서류별 조건 — 비우면 표준대로</div>
                        {Array.from(new Map(slots.map((s) => [s.standard.key, s.standard])).values()).map((s) => (
                          <StdOverrideRow key={s.key} s={s} o={r.overrides?.standards?.[s.key] ?? {}} onChange={(p) => setStdOverride(idx, s.key, p)} />
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <select className={`${inputClass} min-w-56`} value={adding} onChange={(e) => setAdding(e.target.value)}>
          <option value="">항목 선택</option>
          {choices.map((i) => <option key={i.key} value={i.key}>{i.name_ko}{previewOf(i, catalog)}</option>)}
        </select>
        <Button type="button" variant="outline" size="sm" onClick={add} disabled={!adding}><Plus className="size-4" /> 항목 추가</Button>
        <span className="text-xs text-muted-foreground">없는 서류는 입학서류 › 제출서류 탭에서 먼저 등록하세요.</span>
      </div>

      <input type="hidden" name={name} value={serialized} />
    </div>
  );
}

/** 드롭다운 라벨 — 항목 이름과 서류가 다를 때만 서류를 덧붙인다 */
function previewOf(i: CatalogItem, catalog: DocCatalog): string {
  const slots = expandItem(i, catalog);
  if (slots.length === 1 && slots[0].standard.name_ko === i.name_ko && !slots[0].target) return "";
  const names = slots.map((s) => `${s.standard.name_ko}${s.target ? `(${TARGET_LABEL_KO[s.target] ?? s.target})` : ""}`);
  return names.length ? ` — ${names.slice(0, 3).join(", ")}${names.length > 3 ? " 외" : ""}` : "";
}

function StdSummary({ s, o }: { s: CatalogStandard; o?: StandardOverride }) {
  const nota = o?.notarization ?? s.notarization;
  const validity = o?.validity_days ?? s.validity_days;
  const within = o?.issued_within_days ?? s.issued_within_days;
  const original = o?.original_required ?? s.original_required;
  const parts: string[] = [];
  if (nota && nota !== "none") parts.push(NOTA_LABEL[nota] ?? nota);
  if (validity != null) parts.push(`유효 ${validity}일`);
  if (within != null) parts.push(`발급 후 ${within}일`);
  if (original === true) parts.push("원본");
  return parts.length ? <span className="text-muted-foreground/80"> · {parts.join(" · ")}</span> : null;
}

function StdOverrideRow({ s, o, onChange }: { s: CatalogStandard; o: StandardOverride; onChange: (p: StandardOverride) => void }) {
  const num = (v: string) => (v.replace(/[^\d]/g, "") === "" ? null : Number(v.replace(/[^\d]/g, "")));
  return (
    <div className="grid items-end gap-2 rounded-md border p-2 sm:grid-cols-[1fr_auto_auto_auto_auto]">
      <div className="text-sm">{s.name_ko}</div>
      <label className="flex flex-col gap-0.5 text-xs text-muted-foreground">
        인증
        <select className={inputClass} value={o.notarization ?? ""} onChange={(e) => onChange({ notarization: e.target.value || null })}>
          {NOTA_OPTIONS.map((x) => <option key={x.value} value={x.value}>{x.value === "" ? `표준대로${s.notarization ? ` (${NOTA_LABEL[s.notarization] ?? s.notarization})` : ""}` : x.label}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-0.5 text-xs text-muted-foreground">
        유효기간(일)
        <input className={`${inputClass} w-24`} inputMode="numeric" value={o.validity_days ?? ""} placeholder={s.validity_days != null ? String(s.validity_days) : "표준대로"} onChange={(e) => onChange({ validity_days: num(e.target.value) })} />
      </label>
      <label className="flex flex-col gap-0.5 text-xs text-muted-foreground">
        발급 후(일)
        <input className={`${inputClass} w-24`} inputMode="numeric" value={o.issued_within_days ?? ""} placeholder={s.issued_within_days != null ? String(s.issued_within_days) : "표준대로"} onChange={(e) => onChange({ issued_within_days: num(e.target.value) })} />
      </label>
      <label className="flex flex-col gap-0.5 text-xs text-muted-foreground">
        원본
        <select className={inputClass} value={o.original_required == null ? "" : o.original_required ? "yes" : "no"} onChange={(e) => onChange({ original_required: e.target.value === "" ? null : e.target.value === "yes" })}>
          <option value="">표준대로</option>
          <option value="yes">원본</option>
          <option value="no">사본 가능</option>
        </select>
      </label>
    </div>
  );
}
