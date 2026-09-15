"use client";

/**
 * 제출서류 관리 화면.
 *
 *   왼쪽: 항목 ▸ 서류 2단 트리(접었다 펼 수 있다). 항목 아래에는 베트남 기준 구성의 서류가
 *         "서류명 - 대상자" 로 나온다(같은 서류가 본인·아버지·어머니로 세 번 들어가는 식).
 *         항목을 누르면 항목 편집, 서류를 누르면 서류 편집이 오른쪽에 열린다.
 *   항목 편집: 이름, 나라별 서류 표(서류 · 대상자 · 필수). 베트남이 기준이고 지울 수 없다.
 *         나라는 드롭다운에서 골라 추가하고, 다른 나라 설정을 복사할 수 있다.
 *         재정보증인 축은 쓰지 않는다(운영자 결정 2026-09-15 — 보증인이 바뀌어도 서류 종류는 같다).
 *   서류 편집: 서류 상세(조건 입력칸·안내문·다른 표기)와 이 서류가 든 항목.
 *   삭제: 항목·서류 모두 "쓰는 곳"을 먼저 보여주고, 쓰는 곳이 있으면 대신할 것을 골라야 지워진다.
 *   작성서류는 여기 없다 — 작성서류 탭이 관리한다.
 */

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Plus, Search, Trash2, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  deleteDocItemAction,
  deleteDocStandardAction,
  getDocImpactAction,
  saveDocItemAction,
  saveDocStandardAction,
  setDocItemActiveAction,
  type DocImpact,
  type DocVariant,
  type DocSlot,
  type DocOption,
} from "./actions";
import { BASE_NATIONALITY } from "./constants";

// ── 데이터 타입 (page.tsx 가 넘긴다) ─────────────────────────────────

export type DocStandard = {
  key: string;
  name_ko: string;
  name_vi: string | null;
  is_form_doc: boolean;
  issuing_country: string | null;
  issuer_ko: string | null;
  issuer_vi: string | null;
  validity_days: number | null;
  notarization: string | null;
  original_required: boolean | null;
  issued_within_days: number | null;
  guide_ko: string | null;
  guide_vi: string | null;
  aliases: string[];
  is_active: boolean;
};

export type DocItem = {
  key: string;
  name_ko: string;
  name_vi: string | null;
  guide_ko: string | null;
  guide_vi: string | null;
  variants: DocVariant[];
  is_active: boolean;
};

export type DocsManagerProps = {
  standards: DocStandard[];
  items: DocItem[];
  /** 항목 키 → 이 항목을 쓰는 모집요강 수 */
  usage: Record<string, number>;
  /** 항목 키 → 그중 안내문·조건을 따로 설정한 요강 수 */
  overridden: Record<string, number>;
};

// ── 라벨 ─────────────────────────────────────────────────────────────

const TARGET_LABEL: Record<string, string> = {
  self: "본인",
  father: "아버지",
  mother: "어머니",
  sponsor: "재정보증인",
  other: "기타",
};
const NATIONALITIES: Array<[string, string]> = [
  ["vn", "베트남"],
  ["cn", "중국"],
  ["mn", "몽골"],
  ["uz", "우즈베키스탄"],
  ["la", "라오스"],
  ["other", "기타 국가"],
];
const NATIONALITY_LABEL: Record<string, string> = Object.fromEntries(NATIONALITIES);
const NOTA_LABEL: Record<string, string> = {
  none: "인증 없음",
  translation_notarization: "번역 공증",
  consul: "영사확인",
  consul_for_vietnam: "베트남 영사확인",
  apostille: "아포스티유",
  apostille_or_consul: "아포스티유 또는 영사확인",
};

/** 옛 데이터(when=null)는 베트남으로 읽는다. 재정보증인 축은 버린다. */
function normalize(variants: DocVariant[]): DocVariant[] {
  return variants.map((v) => ({
    when: { nationality: (v.when?.nationality ?? "").trim() || BASE_NATIONALITY },
    slots: (v.slots ?? []).map((s) => ({
      target: s.target ?? null,
      required: s.required !== false,
      options: s.options ?? [],
    })),
  }));
}
const nationalityOf = (v: DocVariant) => v.when?.nationality ?? BASE_NATIONALITY;
const isBaseVariant = (v: DocVariant) => nationalityOf(v) === BASE_NATIONALITY;

/** 서류 1개짜리 항목인가 — 이름이 서류를 따라가는 것 */
function singleStandardOf(item: DocItem): string | null {
  const vs = normalize(item.variants);
  if (vs.length !== 1) return null;
  const v = vs[0];
  if (!isBaseVariant(v) || v.slots.length !== 1) return null;
  const opts = v.slots[0].options;
  return opts.length === 1 && opts[0].standard ? opts[0].standard : null;
}

/** 항목에 든 서류 키 — 등장 순, 중복 없이 */
function standardsIn(item: DocItem): string[] {
  const out: string[] = [];
  for (const v of item.variants)
    for (const s of v.slots ?? [])
      for (const o of s.options ?? [])
        if (o.standard && !out.includes(o.standard)) out.push(o.standard);
  return out;
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const selectClass = "h-8 rounded-md border border-input bg-background px-2 text-sm";

type Selection = { type: "item"; key: string } | { type: "standard"; key: string };

/** 왼쪽 트리의 항목 아래 줄 — 베트남 기준 구성의 서류를 "서류명 - 대상자" 로 */
type TreeLeaf = { id: string; label: string; sel: Selection; alt: boolean; isItem: boolean; inactive: boolean };
function leavesOf(item: DocItem, stdByKey: Map<string, DocStandard>, itemByKey: Map<string, DocItem>): TreeLeaf[] {
  const vs = normalize(item.variants);
  const base = vs.find(isBaseVariant) ?? vs[0];
  if (!base) return [];
  const multi = base.slots.length > 1;
  const out: TreeLeaf[] = [];
  base.slots.forEach((slot, si) => {
    const target = slot.target && slot.target !== "self" ? slot.target : null;
    const suffix = target ? ` - ${TARGET_LABEL[target] ?? target}` : multi ? " - 본인" : "";
    slot.options.forEach((o, oi) => {
      if (o.standard) {
        const s = stdByKey.get(o.standard);
        out.push({ id: `${si}-${oi}`, label: `${s?.name_ko ?? o.standard}${suffix}`, sel: { type: "standard", key: o.standard }, alt: oi > 0, isItem: false, inactive: !!s && !s.is_active });
      } else if (o.item) {
        const i = itemByKey.get(o.item);
        out.push({ id: `${si}-${oi}`, label: `${i?.name_ko ?? o.item}${suffix}`, sel: { type: "item", key: o.item }, alt: oi > 0, isItem: true, inactive: !!i && !i.is_active });
      }
    });
  });
  return out;
}

// ── 화면 ─────────────────────────────────────────────────────────────

export function DocsManager({ standards, items, usage, overridden }: DocsManagerProps) {
  const [query, setQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [sel, setSel] = useState<Selection | null>(items[0] ? { type: "item", key: items[0].key } : null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(items[0] ? [items[0].key] : []));
  const [newStdOpen, setNewStdOpen] = useState(false);
  const [newItemOpen, setNewItemOpen] = useState(false);

  const stdByKey = useMemo(() => new Map(standards.map((s) => [s.key, s])), [standards]);
  const itemByKey = useMemo(() => new Map(items.map((i) => [i.key, i])), [items]);

  const filtered = useMemo(() => {
    const base = showInactive ? items : items.filter((i) => i.is_active);
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter((i) => {
      if (`${i.name_ko} ${i.name_vi ?? ""}`.toLowerCase().includes(q)) return true;
      return standardsIn(i).some((k) => {
        const s = stdByKey.get(k);
        return !!s && `${s.name_ko} ${s.name_vi ?? ""} ${s.aliases.join(" ")}`.toLowerCase().includes(q);
      });
    });
  }, [items, query, showInactive, stdByKey]);

  const searching = query.trim() !== "";
  const selectedItem = sel?.type === "item" ? itemByKey.get(sel.key) ?? null : null;
  const selectedStd = sel?.type === "standard" ? stdByKey.get(sel.key) ?? null : null;

  const select = (s: Selection | null) => {
    setSel(s);
    if (s?.type === "item") setExpanded((cur) => new Set(cur).add(s.key));
  };
  const toggle = (key: string) =>
    setExpanded((cur) => {
      const n = new Set(cur);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      {/* 왼쪽 — 항목 ▸ 서류 트리 */}
      <Card className="flex flex-col p-0">
        <div className="space-y-2 border-b p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="docs-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="항목 또는 서류 이름" className="pl-8" />
          </div>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input type="checkbox" id="docs-show-inactive" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            비활성 항목도 보기 ({items.filter((i) => !i.is_active).length})
          </label>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" onClick={() => setNewStdOpen(true)}><Plus className="size-4" /> 새 서류</Button>
            <Button size="sm" variant="outline" className="flex-1" onClick={() => setNewItemOpen(true)}><Plus className="size-4" /> 새 항목</Button>
          </div>
        </div>
        <ul className="max-h-[72vh] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <li className="p-4 text-center text-sm text-muted-foreground">해당하는 항목이 없습니다.</li>
          ) : (
            filtered.map((i) => {
              const leaves = leavesOf(i, stdByKey, itemByKey);
              const nations = normalize(i.variants).length;
              const onItem = sel?.type === "item" && sel.key === i.key;
              const open = searching || expanded.has(i.key);
              return (
                <li key={i.key} className="mb-0.5">
                  <div
                    className={`flex items-center rounded-md ${onItem ? "bg-primary/10 text-primary" : "hover:bg-muted"} ${i.is_active ? "" : "opacity-50"}`}
                  >
                    <button type="button" aria-label={open ? "접기" : "펼치기"} className="shrink-0 p-1.5 text-muted-foreground hover:text-foreground" onClick={() => toggle(i.key)}>
                      {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => select({ type: "item", key: i.key })}
                      className="flex min-w-0 flex-1 items-center justify-between gap-2 py-1.5 pr-2 text-left text-sm font-medium"
                    >
                      <span className="truncate">{i.name_ko}</span>
                      <span className="flex shrink-0 gap-1">
                        {leaves.length > 1 ? <Badge variant="outline" className="px-1.5 text-[10px]">서류 {leaves.length}</Badge> : null}
                        {nations > 1 ? <Badge variant="outline" className="px-1.5 text-[10px]">나라 {nations}</Badge> : null}
                        {!i.is_active ? <Badge variant="outline" className="px-1.5 text-[10px]">비활성</Badge> : null}
                      </span>
                    </button>
                  </div>
                  {open ? (
                    <ul className="ml-4 border-l pl-2">
                      {leaves.map((leaf) => {
                        const on = sel?.type === leaf.sel.type && sel.key === leaf.sel.key;
                        return (
                          <li key={leaf.id}>
                            <button
                              type="button"
                              onClick={() => select(leaf.sel)}
                              className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-[13px] ${
                                on ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                              }`}
                              title={leaf.isItem ? "다른 항목을 통째로 넣은 것" : undefined}
                            >
                              {leaf.alt ? <span className="shrink-0 text-[10px]">또는</span> : null}
                              <span className={`truncate ${leaf.isItem ? "underline decoration-dotted" : ""}`}>{leaf.label}</span>
                              {leaf.inactive ? <span className="shrink-0 text-[10px]">비활성</span> : null}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </li>
              );
            })
          )}
        </ul>
      </Card>

      {/* 오른쪽 — 항목 편집 또는 서류 편집 */}
      <Card className="p-4">
        {selectedItem ? (
          <ItemEditor
            key={selectedItem.key}
            item={selectedItem}
            standards={standards}
            items={items}
            usage={usage[selectedItem.key] ?? 0}
            overridden={overridden[selectedItem.key] ?? 0}
            onSelect={select}
          />
        ) : selectedStd ? (
          <StandardEditor key={selectedStd.key} standard={selectedStd} standards={standards} items={items} onSelect={select} />
        ) : (
          <div className="p-8 text-center text-sm text-muted-foreground">왼쪽에서 항목이나 서류를 고르세요.</div>
        )}
      </Card>

      <NewStandardDialog open={newStdOpen} onClose={() => setNewStdOpen(false)} onCreated={(itemKey) => itemKey && select({ type: "item", key: itemKey })} />
      <NewItemDialog open={newItemOpen} standards={standards} onClose={() => setNewItemOpen(false)} onCreated={(key) => select({ type: "item", key })} />
    </div>
  );
}

// ── 서류 고르는 드롭다운 (서류 / 항목 2단) ────────────────────────────

const encodeOption = (o: DocOption) => (o.standard ? `s:${o.standard}` : o.item ? `i:${o.item}` : "");
const decodeOption = (v: string): DocOption => (v.startsWith("s:") ? { standard: v.slice(2) } : v.startsWith("i:") ? { item: v.slice(2) } : {});

function OptionSelect({
  value, standards, items, excludeItem, id, className, onChange, allowItems = true,
}: {
  value: DocOption; standards: DocStandard[]; items: DocItem[]; excludeItem?: string; id?: string; className?: string;
  onChange: (o: DocOption) => void; allowItems?: boolean;
}) {
  const cur = encodeOption(value);
  const stds = standards.filter((s) => s.is_active || s.key === value.standard);
  const its = allowItems ? items.filter((i) => i.key !== excludeItem && !singleStandardOf(i) && (i.is_active || i.key === value.item)) : [];
  return (
    <select id={id} className={`${selectClass} max-w-full ${className ?? ""}`} value={cur} onChange={(e) => onChange(decodeOption(e.target.value))}>
      <option value="">서류 선택</option>
      <optgroup label="서류">
        {stds.map((s) => <option key={s.key} value={`s:${s.key}`}>{s.name_ko}{s.is_active ? "" : " (비활성)"}</option>)}
      </optgroup>
      {its.length > 0 ? (
        <optgroup label="항목 (여러 서류를 통째로)">
          {its.map((i) => <option key={i.key} value={`i:${i.key}`}>{i.name_ko}{i.is_active ? "" : " (비활성)"}</option>)}
        </optgroup>
      ) : null}
    </select>
  );
}

// ── 항목 편집 ────────────────────────────────────────────────────────

function ItemEditor({
  item, standards, items, usage, overridden, onSelect,
}: {
  item: DocItem; standards: DocStandard[]; items: DocItem[]; usage: number; overridden: number;
  onSelect: (s: Selection | null) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [nameKo, setNameKo] = useState(item.name_ko);
  const [nameVi, setNameVi] = useState(item.name_vi ?? "");
  const [guideKo, setGuideKo] = useState(item.guide_ko ?? "");
  const [guideVi, setGuideVi] = useState(item.guide_vi ?? "");
  const [variants, setVariants] = useState<DocVariant[]>(() => normalize(clone(item.variants)));
  const [dirty, setDirty] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // 나라 추가
  const usedNations = new Set(variants.map(nationalityOf));
  const unusedNations = NATIONALITIES.filter(([k]) => !usedNations.has(k));
  const [newNation, setNewNation] = useState(unusedNations[0]?.[0] ?? "");
  const [copyFrom, setCopyFrom] = useState(true);
  const [copySource, setCopySource] = useState(BASE_NATIONALITY);

  const single = singleStandardOf(item);
  const nationToAdd = unusedNations.some(([k]) => k === newNation) ? newNation : unusedNations[0]?.[0] ?? "";

  const mutate = (fn: (v: DocVariant[]) => void) => {
    setVariants((cur) => { const n = clone(cur); fn(n); return n; });
    setDirty(true);
  };

  const save = () => {
    // 비어 있는 선택지는 버리고, 서류가 하나도 없는 줄이 있으면 막는다
    const cleaned = variants.map((v) => ({ ...v, slots: v.slots.map((s) => ({ ...s, options: s.options.filter((o) => o.standard || o.item) })) }));
    if (cleaned.some((v) => v.slots.some((s) => s.options.length === 0))) return void toast.error("서류를 고르지 않은 줄이 있습니다.");
    start(async () => {
      const r = await saveDocItemAction({ key: item.key, name_ko: nameKo, name_vi: nameVi, guide_ko: guideKo, guide_vi: guideVi, variants: cleaned, is_active: item.is_active });
      if (!r.ok) return void toast.error(r.error);
      toast.success("저장했습니다.");
      setDirty(false);
      router.refresh();
    });
  };

  const toggleActive = () =>
    start(async () => {
      const r = await setDocItemActiveAction(item.key, !item.is_active);
      if (!r.ok) return void toast.error(r.error);
      toast.success(item.is_active ? "비활성화했습니다." : "다시 활성화했습니다.");
      router.refresh();
    });

  const addNation = () => {
    if (!nationToAdd) return;
    mutate((n) => {
      const src = copyFrom ? n.find((v) => nationalityOf(v) === copySource) : undefined;
      n.push({ when: { nationality: nationToAdd }, slots: src ? clone(src.slots) : [{ target: null, required: true, options: [{}] }] });
    });
    setNewNation("");
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="항목 이름 (한국어)">
              <Input id={`item-name-ko-${item.key}`} disabled={!!single} title={single ? "서류 1개짜리 항목 — 이름은 서류를 따라갑니다. 왼쪽에서 서류를 눌러 고치세요." : undefined} value={nameKo} onChange={(e) => { setNameKo(e.target.value); setDirty(true); }} />
            </Field>
            <Field label="항목 이름 (베트남어)">
              <Input id={`item-name-vi-${item.key}`} disabled={!!single} value={nameVi} onChange={(e) => { setNameVi(e.target.value); setDirty(true); }} />
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">
            이 항목을 쓰는 모집요강 <b>{usage}건</b>
            {overridden > 0 ? <> · 그중 안내문·조건을 따로 설정한 곳 <b>{overridden}건</b></> : null}
            {single ? <> · 서류 1개짜리 항목 — 이름은 서류를 따라갑니다</> : null}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleting(true)} disabled={pending}><Trash2 className="size-4" /> 삭제</Button>
          <Button variant="outline" size="sm" onClick={toggleActive} disabled={pending}>{item.is_active ? "비활성화" : "활성화"}</Button>
          <Button size="sm" onClick={save} disabled={pending || !dirty}>저장</Button>
        </div>
      </div>

      {!single ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="항목 안내문 (한국어)">
            <Textarea id={`item-guide-ko-${item.key}`} rows={2} value={guideKo} onChange={(e) => { setGuideKo(e.target.value); setDirty(true); }} placeholder="이 항목 전체에 대한 안내. 서류별 안내는 각 서류에." />
          </Field>
          <Field label="항목 안내문 (베트남어)">
            <Textarea id={`item-guide-vi-${item.key}`} rows={2} value={guideVi} onChange={(e) => { setGuideVi(e.target.value); setDirty(true); }} />
          </Field>
        </div>
      ) : null}

      {/* 나라별 서류 표 */}
      <div className="space-y-3">
        {variants.map((v, vi) => {
          const base = isBaseVariant(v);
          const nation = nationalityOf(v);
          return (
            <div key={nation} className="rounded-lg border">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-t-lg bg-muted/40 px-3 py-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span>{NATIONALITY_LABEL[nation] ?? nation} 학생</span>
                  {base ? <Badge variant="outline" className="px-1.5 text-[10px] font-normal">기준</Badge> : null}
                </div>
                {!base ? (
                  <button type="button" className="text-xs text-muted-foreground hover:text-destructive" onClick={() => mutate((n) => { n.splice(vi, 1); })}>이 나라 삭제</button>
                ) : null}
              </div>

              <table className="w-full text-sm">
                <thead>
                  <tr className="border-t text-left text-xs text-muted-foreground">
                    <th className="px-3 py-1.5 font-medium">서류</th>
                    <th className="w-32 px-2 py-1.5 font-medium">대상자</th>
                    <th className="w-16 px-2 py-1.5 font-medium">필수</th>
                    <th className="w-10 px-2 py-1.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {v.slots.map((s, si) => (
                    <SlotRow
                      key={si}
                      slot={s}
                      standards={standards}
                      items={items}
                      excludeItem={item.key}
                      idPrefix={`slot-${item.key}-${nation}-${si}`}
                      removable={v.slots.length > 1}
                      onOption={(oi, o) => mutate((n) => { n[vi].slots[si].options[oi] = o; })}
                      onAddOption={() => mutate((n) => { n[vi].slots[si].options.push({}); })}
                      onRemoveOption={(oi) => mutate((n) => { n[vi].slots[si].options.splice(oi, 1); })}
                      onTarget={(t) => mutate((n) => { n[vi].slots[si].target = t; })}
                      onRequired={(r) => mutate((n) => { n[vi].slots[si].required = r; })}
                      onRemoveSlot={() => mutate((n) => { n[vi].slots.splice(si, 1); })}
                    />
                  ))}
                </tbody>
              </table>
              <div className="border-t px-3 py-2">
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => mutate((n) => { n[vi].slots.push({ target: null, required: true, options: [{}] }); })}
                >
                  + 서류 추가
                </button>
              </div>
            </div>
          );
        })}

        {unusedNations.length > 0 ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <select id={`new-nation-${item.key}`} className={selectClass} value={nationToAdd} onChange={(e) => setNewNation(e.target.value)}>
              {unusedNations.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <Button type="button" variant="outline" size="sm" onClick={addNation} disabled={!nationToAdd}>
              <Plus className="size-4" /> 나라 추가
            </Button>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input type="checkbox" id={`copy-from-${item.key}`} checked={copyFrom} onChange={(e) => setCopyFrom(e.target.checked)} />
              다음 나라의 설정을 그대로 복사해서 생성
            </label>
            <select id={`copy-src-${item.key}`} className={selectClass} value={usedNations.has(copySource) ? copySource : BASE_NATIONALITY} onChange={(e) => setCopySource(e.target.value)} disabled={!copyFrom}>
              {NATIONALITIES.filter(([k]) => usedNations.has(k)).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
        ) : null}
      </div>

      {deleting ? (
        <DeleteDialog
          kind="item"
          target={{ key: item.key, name: item.name_ko }}
          standards={standards}
          items={items}
          onClose={() => setDeleting(false)}
          onDeleted={() => { setDeleting(false); onSelect(null); }}
        />
      ) : null}
    </div>
  );
}

function SlotRow({
  slot, standards, items, excludeItem, idPrefix, removable, onOption, onAddOption, onRemoveOption, onTarget, onRequired, onRemoveSlot,
}: {
  slot: DocSlot; standards: DocStandard[]; items: DocItem[]; excludeItem: string; idPrefix: string; removable: boolean;
  onOption: (oi: number, o: DocOption) => void; onAddOption: () => void; onRemoveOption: (oi: number) => void;
  onTarget: (t: string | null) => void; onRequired: (r: boolean) => void; onRemoveSlot: () => void;
}) {
  const options = slot.options.length > 0 ? slot.options : [{}];
  return (
    <tr className="border-t align-top">
      <td className="px-3 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {options.map((o, oi) => (
            <span key={oi} className="flex items-center gap-1">
              {oi > 0 ? <span className="text-[11px] text-muted-foreground">또는</span> : null}
              <OptionSelect id={`${idPrefix}-${oi}`} value={o} standards={standards} items={items} excludeItem={excludeItem} onChange={(n) => onOption(oi, n)} />
              {options.length > 1 ? (
                <button type="button" aria-label="이 선택지 빼기" className="text-muted-foreground hover:text-destructive" onClick={() => onRemoveOption(oi)}><X className="size-3.5" /></button>
              ) : null}
            </span>
          ))}
          <button type="button" className="text-xs text-muted-foreground hover:text-foreground" title="이 줄에서 학생이 둘 중 하나만 내면 될 때" onClick={onAddOption}>+ 대체 가능 서류</button>
        </div>
      </td>
      <td className="px-2 py-2">
        <select id={`${idPrefix}-target`} className={`${selectClass} w-full`} value={slot.target ?? ""} onChange={(e) => onTarget(e.target.value || null)}>
          <option value="">본인</option>
          {Object.entries(TARGET_LABEL).filter(([k]) => k !== "self").map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </td>
      <td className="px-2 py-2">
        <input type="checkbox" id={`${idPrefix}-required`} className="mt-2" checked={slot.required !== false} onChange={(e) => onRequired(e.target.checked)} />
      </td>
      <td className="px-2 py-2 text-right">
        {removable ? (
          <button type="button" aria-label="이 줄 삭제" title="이 줄 삭제" className="mt-1 text-muted-foreground hover:text-destructive" onClick={onRemoveSlot}><Trash2 className="size-4" /></button>
        ) : null}
      </td>
    </tr>
  );
}

// ── 삭제 (영향 확인 → 대신할 것 고르기) ─────────────────────────────

function DeleteDialog({
  kind, target, standards, items, onClose, onDeleted,
}: {
  kind: "item" | "standard"; target: { key: string; name: string }; standards: DocStandard[]; items: DocItem[];
  onClose: () => void; onDeleted: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [impact, setImpact] = useState<DocImpact | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [replaceWith, setReplaceWith] = useState("");
  const noun = kind === "item" ? "항목" : "서류";

  useEffect(() => {
    let alive = true;
    getDocImpactAction(kind, target.key).then((r) => {
      if (!alive) return;
      if (r.ok) setImpact(r.data); else setLoadError(r.error);
    });
    return () => { alive = false; };
  }, [kind, target.key]);

  const used = !!impact && (impact.specs.length > 0 || impact.items.length > 0 || impact.files > 0);
  const canDelete = !!impact && (!used || replaceWith !== "");

  const run = () =>
    start(async () => {
      const r = kind === "item"
        ? await deleteDocItemAction({ key: target.key, replaceWith: replaceWith || null })
        : await deleteDocStandardAction({ key: target.key, replaceWith: replaceWith || null });
      if (!r.ok) return void toast.error(r.error);
      toast.success(replaceWith ? `${noun}를 지우고 쓰던 곳은 대신할 ${noun}로 옮겼습니다.` : `${noun}를 지웠습니다.`);
      router.refresh();
      onDeleted();
    });

  const candidates = kind === "item"
    ? items.filter((i) => i.key !== target.key && i.is_active).map((i) => ({ key: i.key, label: i.name_ko }))
    : standards.filter((s) => s.key !== target.key && s.is_active).map((s) => ({ key: s.key, label: s.name_ko }));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{noun} 삭제 — {target.name}</DialogTitle>
          <DialogDescription>
            {kind === "item"
              ? "이 항목을 쓰는 모집요강과 다른 항목의 선택지는 대신할 항목으로 옮겨집니다."
              : "이 서류를 쓰는 항목·모집요강·학생이 올린 파일은 대신할 서류로 옮겨집니다. 이 서류로 자동 생성된 항목도 같이 정리됩니다."}
          </DialogDescription>
        </DialogHeader>

        {loadError ? (
          <p className="text-sm text-destructive">{loadError}</p>
        ) : !impact ? (
          <p className="text-sm text-muted-foreground">쓰는 곳을 확인하는 중…</p>
        ) : !used ? (
          <p className="text-sm text-muted-foreground">쓰는 곳이 없습니다. 바로 지울 수 있습니다.</p>
        ) : (
          <div className="space-y-2 text-sm">
            <div className="text-xs font-medium text-muted-foreground">쓰는 곳</div>
            <ul className="space-y-1 rounded-md border p-2 text-[13px]">
              {impact.specs.length > 0 ? (
                <li>
                  모집요강 <b>{impact.specs.length}건</b>
                  <span className="text-muted-foreground"> — {impact.specs.slice(0, 6).map((s) => s.label).join(", ")}{impact.specs.length > 6 ? " 외" : ""}</span>
                </li>
              ) : null}
              {impact.items.length > 0 ? (
                <li>
                  {kind === "item" ? "선택지로 가진 항목" : "이 서류가 든 항목"} <b>{impact.items.length}개</b>
                  <span className="text-muted-foreground"> — {impact.items.map((i) => i.name_ko).join(", ")}</span>
                </li>
              ) : null}
              {impact.files > 0 ? <li>학생이 올린 파일 <b>{impact.files}건</b></li> : null}
            </ul>
            <Field label={`대신할 ${noun} (필수)`}>
              <select id={`replace-${kind}-${target.key}`} className={`${selectClass} w-full`} value={replaceWith} onChange={(e) => setReplaceWith(e.target.value)}>
                <option value="">— 고르세요 —</option>
                {candidates.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </Field>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>취소</Button>
          <Button variant="destructive" onClick={run} disabled={pending || !canDelete}>{used ? "옮기고 삭제" : "삭제"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── 서류 편집 (오른쪽 패널) / 등록 ────────────────────────────────────

type StdDraft = {
  name_ko: string; name_vi: string; issuing_country: string; issuer_ko: string;
  validity_days: string; notarization: string; original_required: string;
  issued_within_days: string; guide_ko: string; guide_vi: string; aliases: string;
};

function draftFrom(s: DocStandard | null): StdDraft {
  return {
    name_ko: s?.name_ko ?? "",
    name_vi: s?.name_vi ?? "",
    issuing_country: s?.issuing_country ?? "",
    issuer_ko: s?.issuer_ko ?? "",
    validity_days: s?.validity_days != null ? String(s.validity_days) : "",
    notarization: s?.notarization ?? "",
    original_required: s?.original_required == null ? "" : s.original_required ? "yes" : "no",
    issued_within_days: s?.issued_within_days != null ? String(s.issued_within_days) : "",
    guide_ko: s?.guide_ko ?? "",
    guide_vi: s?.guide_vi ?? "",
    aliases: (s?.aliases ?? []).join(", "),
  };
}

function toInput(d: StdDraft) {
  return {
    name_ko: d.name_ko,
    name_vi: d.name_vi,
    issuing_country: d.issuing_country,
    issuer_ko: d.issuer_ko,
    validity_days: d.validity_days ? Number(d.validity_days) : null,
    notarization: d.notarization,
    original_required: d.original_required === "" ? null : d.original_required === "yes",
    issued_within_days: d.issued_within_days ? Number(d.issued_within_days) : null,
    guide_ko: d.guide_ko,
    guide_vi: d.guide_vi,
    aliases: d.aliases.split(",").map((a) => a.trim()).filter(Boolean),
  };
}

function StandardFields({ d, set, idPrefix }: { d: StdDraft; set: <K extends keyof StdDraft>(k: K, v: StdDraft[K]) => void; idPrefix: string }) {
  const num = (v: string) => v.replace(/[^\d]/g, "");
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="서류 이름 (한국어)"><Input id={`${idPrefix}-name-ko`} value={d.name_ko} onChange={(e) => set("name_ko", e.target.value)} /></Field>
        <Field label="서류 이름 (베트남어)"><Input id={`${idPrefix}-name-vi`} value={d.name_vi} onChange={(e) => set("name_vi", e.target.value)} /></Field>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <Field label="발급국">
          <select id={`${idPrefix}-country`} className={`${selectClass} w-full`} value={d.issuing_country} onChange={(e) => set("issuing_country", e.target.value)}>
            <option value="">범용</option>
            {NATIONALITIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Field>
        <Field label="발급기관"><Input id={`${idPrefix}-issuer`} value={d.issuer_ko} onChange={(e) => set("issuer_ko", e.target.value)} placeholder="예: 인민위원회" /></Field>
        <Field label="인증 방식">
          <select id={`${idPrefix}-nota`} className={`${selectClass} w-full`} value={d.notarization} onChange={(e) => set("notarization", e.target.value)}>
            <option value="">—</option>
            {Object.entries(NOTA_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <Field label="유효기간 (일)"><Input id={`${idPrefix}-validity`} inputMode="numeric" value={d.validity_days} onChange={(e) => set("validity_days", num(e.target.value))} placeholder="예: 365" /></Field>
        <Field label="발급 후 (일) 이내"><Input id={`${idPrefix}-within`} inputMode="numeric" value={d.issued_within_days} onChange={(e) => set("issued_within_days", num(e.target.value))} placeholder="예: 90" /></Field>
        <Field label="원본 필수">
          <select id={`${idPrefix}-original`} className={`${selectClass} w-full`} value={d.original_required} onChange={(e) => set("original_required", e.target.value)}>
            <option value="">상관없음</option>
            <option value="yes">원본</option>
            <option value="no">사본 가능</option>
          </select>
        </Field>
      </div>
      <p className="-mt-1 text-xs text-muted-foreground">대학마다 자주 달라지는 조건은 여기 입력칸에 둡니다. 모집요강에서 이 값만 덮어쓸 수 있습니다.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="기본 안내문 (한국어)"><Textarea id={`${idPrefix}-guide-ko`} rows={3} value={d.guide_ko} onChange={(e) => set("guide_ko", e.target.value)} placeholder="발급 방법·주의사항. 숫자 조건은 위 입력칸에." /></Field>
        <Field label="기본 안내문 (베트남어)"><Textarea id={`${idPrefix}-guide-vi`} rows={3} value={d.guide_vi} onChange={(e) => set("guide_vi", e.target.value)} /></Field>
      </div>
      <Field label="다른 표기 (쉼표로 구분)"><Input id={`${idPrefix}-aliases`} value={d.aliases} onChange={(e) => set("aliases", e.target.value)} placeholder="모집요강에 다른 이름으로 적혀 있을 때 자동으로 맞추는 데 씁니다" /></Field>
    </div>
  );
}

function StandardEditor({ standard, standards, items, onSelect }: { standard: DocStandard; standards: DocStandard[]; items: DocItem[]; onSelect: (s: Selection | null) => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [d, setD] = useState<StdDraft>(() => draftFrom(standard));
  const [dirty, setDirty] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const set = <K extends keyof StdDraft>(k: K, v: StdDraft[K]) => { setD((c) => ({ ...c, [k]: v })); setDirty(true); };
  const usedBy = items.filter((i) => standardsIn(i).includes(standard.key));
  const save = () =>
    start(async () => {
      const r = await saveDocStandardAction({ key: standard.key, ...toInput(d), is_active: standard.is_active });
      if (!r.ok) return void toast.error(r.error);
      toast.success("서류를 저장했습니다. 이 서류를 쓰는 모든 항목·대학에 반영됩니다.");
      setDirty(false);
      router.refresh();
    });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs text-muted-foreground">서류 편집</div>
          <h3 className="text-base font-semibold">{standard.name_ko}{standard.is_active ? "" : <Badge variant="outline" className="ml-2 px-1.5 text-[10px] font-normal">비활성</Badge>}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            이 서류가 든 항목 {usedBy.length}개:{" "}
            {usedBy.map((i, idx) => (
              <span key={i.key}>
                {idx > 0 ? ", " : ""}
                <button type="button" className="underline hover:text-foreground" onClick={() => onSelect({ type: "item", key: i.key })}>{i.name_ko}</button>
              </span>
            ))}
            {usedBy.length === 0 ? "없음" : null}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleting(true)} disabled={pending}><Trash2 className="size-4" /> 삭제</Button>
          <Button size="sm" onClick={save} disabled={pending || !dirty}>저장</Button>
        </div>
      </div>
      <StandardFields d={d} set={set} idPrefix={`std-${standard.key}`} />
      <p className="text-xs text-muted-foreground">여기서 고치면 이 서류를 쓰는 모든 대학에 바로 반영됩니다. 대학이 따로 설정한 값만 그대로 남습니다.</p>

      {deleting ? (
        <DeleteDialog
          kind="standard"
          target={{ key: standard.key, name: standard.name_ko }}
          standards={standards}
          items={items}
          onClose={() => setDeleting(false)}
          onDeleted={() => { setDeleting(false); onSelect(null); }}
        />
      ) : null}
    </div>
  );
}

export function NewStandardDialog({ open, initialName, onClose, onCreated }: { open: boolean; initialName?: string; onClose: () => void; onCreated: (itemKey: string | null, stdKey: string) => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [d, setD] = useState<StdDraft>(() => ({ ...draftFrom(null), name_ko: initialName ?? "" }));
  const set = <K extends keyof StdDraft>(k: K, v: StdDraft[K]) => setD((c) => ({ ...c, [k]: v }));
  const save = () =>
    start(async () => {
      const r = await saveDocStandardAction(toInput(d));
      if (!r.ok) return void toast.error(r.error);
      toast.success("서류를 등록했습니다. 모집요강에서 바로 고를 수 있습니다.");
      setD(draftFrom(null));
      router.refresh();
      onCreated(r.data.itemKey, r.data.key);
      onClose();
    });
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>새 서류 등록</DialogTitle>
          <DialogDescription>서류를 등록하면 대학이 고를 수 있는 항목도 같이 생깁니다. 따로 만들 것은 없습니다.</DialogDescription>
        </DialogHeader>
        <StandardFields d={d} set={set} idPrefix="new-std" />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>취소</Button>
          <Button onClick={save} disabled={pending || !d.name_ko.trim()}>등록</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewItemDialog({ open, standards, onClose, onCreated }: { open: boolean; standards: DocStandard[]; onClose: () => void; onCreated: (key: string) => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [nameKo, setNameKo] = useState("");
  const [nameVi, setNameVi] = useState("");
  const [firstStd, setFirstStd] = useState("");
  // 빈 항목은 저장할 수 없다(줄마다 서류가 있어야 함). 첫 서류를 여기서 받아
  // 베트남 구성 한 줄로 만들고, 나머지 줄·나라는 편집 화면에서 이어간다.
  const save = () =>
    start(async () => {
      const r = await saveDocItemAction({
        name_ko: nameKo, name_vi: nameVi,
        variants: [{ when: { nationality: BASE_NATIONALITY }, slots: [{ target: null, required: true, options: [{ standard: firstStd }] }] }],
      });
      if (!r.ok) return void toast.error(r.error);
      toast.success("항목을 만들었습니다. 이어서 서류와 나라를 채우세요.");
      setNameKo(""); setNameVi(""); setFirstStd("");
      router.refresh();
      onCreated(r.data.key);
      onClose();
    });
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>새 항목</DialogTitle>
          <DialogDescription>여러 서류를 같이 내거나 그중 하나를 내는 묶음. 예: 가족관계 입증, 재산 입증.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Field label="항목 이름 (한국어)"><Input id="new-item-name-ko" value={nameKo} onChange={(e) => setNameKo(e.target.value)} placeholder="예: 가족관계 입증" /></Field>
          <Field label="항목 이름 (베트남어)"><Input id="new-item-name-vi" value={nameVi} onChange={(e) => setNameVi(e.target.value)} /></Field>
          <Field label="첫 서류 (베트남 학생의 첫 줄)">
            <select id="new-item-first-std" className={`${selectClass} w-full`} value={firstStd} onChange={(e) => setFirstStd(e.target.value)}>
              <option value="">서류 선택</option>
              {standards.filter((s) => s.is_active).map((s) => <option key={s.key} value={s.key}>{s.name_ko}</option>)}
            </select>
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>취소</Button>
          <Button onClick={save} disabled={pending || !nameKo.trim() || !firstStd}>만들기</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
