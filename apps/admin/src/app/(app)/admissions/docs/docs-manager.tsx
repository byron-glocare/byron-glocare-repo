"use client";

/**
 * 제출서류 관리 화면 — 서류 항목 목록(왼쪽) + 항목 상세·구성 편집(오른쪽).
 *
 *   설계(https://claude.ai/artifact/Xqr35jUhQ2JEMHyaSoH17P) 의 "관리 화면" 그대로:
 *   · 왼쪽 목록은 항목만. 서류/묶음/작성/조건 유무는 작은 표시로.
 *   · 구성 하나가 카드 하나, 줄 하나가 칸. 왼쪽 대상자, 오른쪽 선택지. "또는"이 보이면 택1.
 *   · 서류 칩을 누르면 서류 편집 창. 서류 편집 페이지를 따로 두지 않는다.
 *   · "새 서류 등록"은 한 번 — 서류와 서류 1개짜리 항목이 같이 생긴다.
 */

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Search, X } from "lucide-react";

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
  saveDocItemAction,
  saveDocStandardAction,
  setDocItemActiveAction,
  type DocVariant,
  type DocSlot,
  type DocOption,
} from "./actions";

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
};
const NATIONALITY_LABEL: Record<string, string> = {
  vn: "베트남",
  cn: "중국",
  mn: "몽골",
  uz: "우즈베키스탄",
  la: "라오스",
  other: "기타 국가",
};
const SPONSOR_LABEL: Record<string, string> = {
  parent: "부모",
  relative: "친인척",
  company: "회사",
};
const NOTA_LABEL: Record<string, string> = {
  none: "인증 없음",
  translation_notarization: "번역 공증",
  consul: "영사확인",
  consul_for_vietnam: "베트남 영사확인",
  apostille: "아포스티유",
  apostille_or_consul: "아포스티유 또는 영사확인",
};

function whenLabel(when: DocVariant["when"]): string {
  if (!when || (!when.nationality && !when.sponsor)) return "기본 구성";
  const parts: string[] = [];
  if (when.nationality) parts.push(`국적 · ${NATIONALITY_LABEL[when.nationality] ?? when.nationality}`);
  if (when.sponsor) parts.push(`재정보증인 · ${SPONSOR_LABEL[when.sponsor] ?? when.sponsor}`);
  return parts.join(" + ");
}

/** 서류 1개짜리 항목인가 — 목록에서 "서류"로 읽히는 것 */
function singleStandardOf(item: DocItem): string | null {
  if (item.variants.length !== 1) return null;
  const v = item.variants[0];
  if (v.when || v.slots.length !== 1) return null;
  const opts = v.slots[0].options;
  return opts.length === 1 && opts[0].standard ? opts[0].standard : null;
}

const cloneVariants = (v: DocVariant[]): DocVariant[] =>
  JSON.parse(JSON.stringify(v)) as DocVariant[];

const selectClass =
  "h-8 rounded-md border border-input bg-background px-2 text-sm";

// ── 화면 ─────────────────────────────────────────────────────────────

export function DocsManager({ standards, items, usage, overridden }: DocsManagerProps) {
  const [query, setQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(items[0]?.key ?? null);
  const [newStdOpen, setNewStdOpen] = useState(false);
  const [newBundleOpen, setNewBundleOpen] = useState(false);
  // 옛 데이터 탭에서 비활성이던 것도 키 보존을 위해 같이 옮겨졌다(0060). 기본은 숨긴다.
  const [showInactive, setShowInactive] = useState(false);

  const stdByKey = useMemo(() => new Map(standards.map((s) => [s.key, s])), [standards]);
  const itemByKey = useMemo(() => new Map(items.map((i) => [i.key, i])), [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = showInactive ? items : items.filter((i) => i.is_active);
    if (!q) return base;
    return base.filter((i) => {
      const inName = `${i.name_ko} ${i.name_vi ?? ""}`.toLowerCase().includes(q);
      if (inName) return true;
      // 서류 이름으로 찾아도 그 서류가 든 항목이 뜬다
      for (const v of i.variants)
        for (const s of v.slots)
          for (const o of s.options) {
            const std = o.standard ? stdByKey.get(o.standard) : null;
            if (std && `${std.name_ko} ${std.name_vi ?? ""} ${std.aliases.join(" ")}`.toLowerCase().includes(q))
              return true;
          }
      return false;
    });
  }, [items, query, stdByKey, showInactive]);

  const selected = selectedKey ? itemByKey.get(selectedKey) ?? null : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
      {/* 왼쪽 — 항목 목록 */}
      <Card className="flex flex-col p-0">
        <div className="space-y-2 border-b p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="docs-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="항목 또는 서류 이름"
              className="pl-8"
            />
          </div>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input type="checkbox" id="docs-show-inactive" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            비활성 항목도 보기 ({items.filter((i) => !i.is_active).length})
          </label>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" onClick={() => setNewStdOpen(true)}>
              <Plus className="size-4" /> 새 서류
            </Button>
            <Button size="sm" variant="outline" className="flex-1" onClick={() => setNewBundleOpen(true)}>
              <Plus className="size-4" /> 새 묶음
            </Button>
          </div>
        </div>
        <ul className="max-h-[70vh] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <li className="p-4 text-center text-sm text-muted-foreground">해당하는 항목이 없습니다.</li>
          ) : (
            filtered.map((i) => {
              const single = singleStandardOf(i);
              const std = single ? stdByKey.get(single) : null;
              const hasCond = i.variants.some((v) => !!v.when);
              const on = i.key === selectedKey;
              return (
                <li key={i.key}>
                  <button
                    type="button"
                    onClick={() => setSelectedKey(i.key)}
                    className={`flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm ${
                      on ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted"
                    } ${i.is_active ? "" : "opacity-50"}`}
                  >
                    <span className="truncate">{i.name_ko}</span>
                    <span className="flex shrink-0 gap-1 text-[10px]">
                      {single ? (
                        std?.is_form_doc ? (
                          <Badge variant="secondary" className="px-1.5 text-[10px]">작성</Badge>
                        ) : (
                          <Badge variant="outline" className="px-1.5 text-[10px]">서류</Badge>
                        )
                      ) : (
                        <Badge variant="outline" className="px-1.5 text-[10px]">묶음</Badge>
                      )}
                      {hasCond ? <Badge variant="outline" className="px-1.5 text-[10px]">조건</Badge> : null}
                      {!i.is_active ? <Badge variant="outline" className="px-1.5 text-[10px]">비활성</Badge> : null}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </Card>

      {/* 오른쪽 — 항목 상세 */}
      <Card className="p-4">
        {selected ? (
          <ItemEditor
            key={selected.key}
            item={selected}
            standards={standards}
            items={items}
            usage={usage[selected.key] ?? 0}
            overridden={overridden[selected.key] ?? 0}
            onSelectItem={setSelectedKey}
          />
        ) : (
          <div className="p-8 text-center text-sm text-muted-foreground">
            왼쪽에서 항목을 고르거나 새 서류를 등록하세요.
          </div>
        )}
      </Card>

      <NewStandardDialog
        open={newStdOpen}
        onClose={() => setNewStdOpen(false)}
        onCreated={(itemKey) => itemKey && setSelectedKey(itemKey)}
      />
      <NewBundleDialog
        open={newBundleOpen}
        standards={standards}
        onClose={() => setNewBundleOpen(false)}
        onCreated={(key) => setSelectedKey(key)}
      />
    </div>
  );
}

// ── 항목 편집 ────────────────────────────────────────────────────────

function ItemEditor({
  item,
  standards,
  items,
  usage,
  overridden,
  onSelectItem,
}: {
  item: DocItem;
  standards: DocStandard[];
  items: DocItem[];
  usage: number;
  overridden: number;
  onSelectItem: (key: string) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [nameKo, setNameKo] = useState(item.name_ko);
  const [nameVi, setNameVi] = useState(item.name_vi ?? "");
  const [guideKo, setGuideKo] = useState(item.guide_ko ?? "");
  const [guideVi, setGuideVi] = useState(item.guide_vi ?? "");
  const [variants, setVariants] = useState<DocVariant[]>(() => cloneVariants(item.variants));
  const [dirty, setDirty] = useState(false);
  const [stdPanel, setStdPanel] = useState<string | null>(null);
  const [picker, setPicker] = useState<{ vi: number; si: number } | null>(null);

  const stdByKey = useMemo(() => new Map(standards.map((s) => [s.key, s])), [standards]);
  const itemByKey = useMemo(() => new Map(items.map((i) => [i.key, i])), [items]);
  const single = singleStandardOf(item);

  const mutate = (fn: (v: DocVariant[]) => void) => {
    setVariants((cur) => {
      const next = cloneVariants(cur);
      fn(next);
      return next;
    });
    setDirty(true);
  };

  const save = () =>
    start(async () => {
      const r = await saveDocItemAction({
        key: item.key,
        name_ko: nameKo,
        name_vi: nameVi,
        guide_ko: guideKo,
        guide_vi: guideVi,
        variants,
        is_active: item.is_active,
      });
      if (!r.ok) return void toast.error(r.error);
      toast.success("저장했습니다.");
      setDirty(false);
      router.refresh();
    });

  const toggleActive = () =>
    start(async () => {
      const r = await setDocItemActiveAction(item.key, !item.is_active);
      if (!r.ok) return void toast.error(r.error);
      toast.success(item.is_active ? "비활성화했습니다." : "다시 활성화했습니다.");
      router.refresh();
    });

  return (
    <div className="space-y-5">
      {/* 머리 */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="항목 이름 (한국어)">
              <Input id={`item-name-ko-${item.key}`} value={nameKo} onChange={(e) => { setNameKo(e.target.value); setDirty(true); }} />
            </Field>
            <Field label="항목 이름 (베트남어)">
              <Input id={`item-name-vi-${item.key}`} value={nameVi} onChange={(e) => { setNameVi(e.target.value); setDirty(true); }} />
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">
            이 항목을 쓰는 모집요강 <b>{usage}건</b>
            {overridden > 0 ? <> · 그중 안내문·조건을 따로 설정한 곳 <b>{overridden}건</b></> : null}
            {single ? <> · 서류 1개짜리 항목 — 이름은 서류를 따라갑니다</> : null}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={toggleActive} disabled={pending}>
            {item.is_active ? "비활성화" : "활성화"}
          </Button>
          <Button size="sm" onClick={save} disabled={pending || !dirty}>
            저장
          </Button>
        </div>
      </div>

      {/* 안내문 — 서류 1개짜리는 서류 쪽 안내문을 쓰므로 여기선 숨긴다 */}
      {!single ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="기본 안내문 (한국어)">
            <Textarea id={`item-guide-ko-${item.key}`} rows={3} value={guideKo} onChange={(e) => { setGuideKo(e.target.value); setDirty(true); }} placeholder="숫자 조건(유효기간·금액)은 적지 마세요 — 서류의 입력칸에 둡니다." />
          </Field>
          <Field label="기본 안내문 (베트남어)">
            <Textarea id={`item-guide-vi-${item.key}`} rows={3} value={guideVi} onChange={(e) => { setGuideVi(e.target.value); setDirty(true); }} />
          </Field>
        </div>
      ) : null}

      {/* 구성 */}
      <div className="space-y-3">
        {variants.map((v, vi) => {
          const isDefault = !v.when || (!v.when.nationality && !v.when.sponsor);
          return (
            <div key={vi} className="rounded-lg border">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-t-lg bg-muted/40 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {isDefault ? (
                    <span>기본 구성 <span className="font-normal text-muted-foreground">— 조건에 맞는 구성이 없을 때</span></span>
                  ) : (
                    <>
                      <span>조건</span>
                      <select
                        className={selectClass}
                        value={v.when?.nationality ?? ""}
                        onChange={(e) => mutate((n) => { n[vi].when = { ...(n[vi].when ?? {}), nationality: e.target.value || undefined }; })}
                      >
                        <option value="">국적 무관</option>
                        {Object.entries(NATIONALITY_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                      </select>
                      <select
                        className={selectClass}
                        value={v.when?.sponsor ?? ""}
                        onChange={(e) => mutate((n) => { n[vi].when = { ...(n[vi].when ?? {}), sponsor: e.target.value || undefined }; })}
                      >
                        <option value="">재정보증인 무관</option>
                        {Object.entries(SPONSOR_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                      </select>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">{whenLabel(v.when)}</span>
                  {!isDefault ? (
                    <button type="button" className="text-muted-foreground hover:text-destructive" onClick={() => mutate((n) => { n.splice(vi, 1); })}>
                      구성 삭제
                    </button>
                  ) : null}
                </div>
              </div>

              {v.slots.map((s, si) => (
                <SlotRow
                  key={si}
                  slot={s}
                  stdByKey={stdByKey}
                  itemByKey={itemByKey}
                  removable={v.slots.length > 1}
                  onTarget={(t) => mutate((n) => { n[vi].slots[si].target = t; })}
                  onRemoveOption={(oi) => mutate((n) => { n[vi].slots[si].options.splice(oi, 1); })}
                  onRemoveSlot={() => mutate((n) => { n[vi].slots.splice(si, 1); })}
                  onAddOption={() => setPicker({ vi, si })}
                  onOpenStandard={(k) => setStdPanel(k)}
                  onOpenItem={(k) => onSelectItem(k)}
                />
              ))}
              <div className="px-3 py-2">
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => mutate((n) => { n[vi].slots.push({ target: null, options: [] }); setPicker({ vi, si: n[vi].slots.length - 1 }); })}
                >
                  + 칸 추가 <span className="text-muted-foreground/70">(모두 내야 하는 서류가 하나 더 있을 때)</span>
                </button>
              </div>
            </div>
          );
        })}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => mutate((n) => { n.push({ when: { nationality: "vn" }, slots: cloneVariants([n[0]])[0].slots }); })}
        >
          <Plus className="size-4" /> 조건별 구성 추가
        </Button>
        <p className="text-xs text-muted-foreground">
          칸은 모두 내야 하고, 한 칸 안의 선택지 중에서는 하나만 냅니다. 선택지에 다른 항목을 넣으면 점선으로 보입니다.
        </p>
      </div>

      {picker ? (
        <OptionPicker
          standards={standards}
          items={items}
          excludeItem={item.key}
          already={variants[picker.vi]?.slots[picker.si]?.options ?? []}
          onPick={(o) => { mutate((n) => { n[picker.vi].slots[picker.si].options.push(o); }); setPicker(null); }}
          onClose={() => {
            // 빈 칸으로 남기지 않는다
            mutate((n) => { const sl = n[picker.vi].slots; if (sl[picker.si] && sl[picker.si].options.length === 0 && sl.length > 1) sl.splice(picker.si, 1); });
            setPicker(null);
          }}
        />
      ) : null}

      {stdPanel ? (
        <StandardDialog
          standard={stdByKey.get(stdPanel) ?? null}
          onClose={() => setStdPanel(null)}
        />
      ) : null}
    </div>
  );
}

function SlotRow({
  slot,
  stdByKey,
  itemByKey,
  removable,
  onTarget,
  onRemoveOption,
  onRemoveSlot,
  onAddOption,
  onOpenStandard,
  onOpenItem,
}: {
  slot: DocSlot;
  stdByKey: Map<string, DocStandard>;
  itemByKey: Map<string, DocItem>;
  removable: boolean;
  onTarget: (t: string | null) => void;
  onRemoveOption: (oi: number) => void;
  onRemoveSlot: () => void;
  onAddOption: () => void;
  onOpenStandard: (key: string) => void;
  onOpenItem: (key: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 items-center gap-2 border-t px-3 py-2 sm:grid-cols-[120px_1fr_auto]">
      <select className={selectClass} value={slot.target ?? ""} onChange={(e) => onTarget(e.target.value || null)}>
        <option value="">대상자 —</option>
        {Object.entries(TARGET_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
      <div className="flex flex-wrap items-center gap-1.5">
        {slot.options.map((o, oi) => {
          const label = o.standard ? stdByKey.get(o.standard)?.name_ko ?? o.standard : itemByKey.get(o.item ?? "")?.name_ko ?? o.item;
          const isItem = !!o.item;
          return (
            <span key={`${o.standard ?? o.item}-${oi}`} className="flex items-center">
              {oi > 0 ? <span className="mx-1 text-[11px] text-muted-foreground">또는</span> : null}
              <span className={`inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-1 text-xs ${isItem ? "border-dashed" : ""}`}>
                <button type="button" className="hover:underline" onClick={() => (isItem ? onOpenItem(o.item!) : onOpenStandard(o.standard!))} title={isItem ? "이 항목으로 이동" : "서류 편집"}>
                  {label}
                </button>
                <button type="button" aria-label="선택지 제거" className="text-muted-foreground hover:text-destructive" onClick={() => onRemoveOption(oi)}>
                  <X className="size-3" />
                </button>
              </span>
            </span>
          );
        })}
        <button type="button" className="rounded-full border border-dashed px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground" onClick={onAddOption}>
          + 선택지
        </button>
      </div>
      <div className="text-right">
        {removable ? (
          <button type="button" className="text-xs text-muted-foreground hover:text-destructive" onClick={onRemoveSlot}>칸 삭제</button>
        ) : null}
      </div>
    </div>
  );
}

// ── 선택지 고르기 ────────────────────────────────────────────────────

function OptionPicker({
  standards,
  items,
  excludeItem,
  already,
  onPick,
  onClose,
}: {
  standards: DocStandard[];
  items: DocItem[];
  excludeItem: string;
  already: DocOption[];
  onPick: (o: DocOption) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const has = (o: DocOption) => already.some((a) => (o.standard && a.standard === o.standard) || (o.item && a.item === o.item));
  const ql = q.trim().toLowerCase();
  const stds = standards.filter((s) => s.is_active && !has({ standard: s.key }) && (!ql || `${s.name_ko} ${s.name_vi ?? ""} ${s.aliases.join(" ")}`.toLowerCase().includes(ql)));
  const its = items.filter((i) => i.is_active && i.key !== excludeItem && !singleStandardOf(i) && !has({ item: i.key }) && (!ql || `${i.name_ko} ${i.name_vi ?? ""}`.toLowerCase().includes(ql)));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>선택지 추가</DialogTitle>
          <DialogDescription>이 칸에서 학생이 낼 수 있는 서류. 여러 개면 그중 하나만 내면 됩니다.</DialogDescription>
        </DialogHeader>
        <Input id="option-picker-search" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="서류 또는 묶음 이름" />
        <div className="max-h-80 space-y-3 overflow-y-auto">
          <PickGroup title="서류" empty="맞는 서류가 없습니다. 먼저 새 서류로 등록하세요.">
            {stds.map((s) => (
              <PickRow key={s.key} onClick={() => onPick({ standard: s.key })}>
                <span>{s.name_ko}</span>
                <span className="text-xs text-muted-foreground">{s.is_form_doc ? "작성" : "발급"}{s.issuing_country ? ` · ${NATIONALITY_LABEL[s.issuing_country] ?? s.issuing_country}` : ""}</span>
              </PickRow>
            ))}
          </PickGroup>
          <PickGroup title="묶음 (다른 항목을 통째로)" empty="">
            {its.map((i) => (
              <PickRow key={i.key} onClick={() => onPick({ item: i.key })}>
                <span>{i.name_ko}</span>
                <span className="text-xs text-muted-foreground">묶음</span>
              </PickRow>
            ))}
          </PickGroup>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PickGroup({ title, empty, children }: { title: string; empty: string; children: ReactNode[] }) {
  if (children.length === 0 && !empty) return null;
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-muted-foreground">{title}</div>
      {children.length === 0 ? <p className="px-2 py-1 text-xs text-muted-foreground">{empty}</p> : <div className="space-y-0.5">{children}</div>}
    </div>
  );
}

function PickRow({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted">
      {children}
    </button>
  );
}

// ── 서류 편집 / 등록 ─────────────────────────────────────────────────

type StdDraft = {
  name_ko: string; name_vi: string; is_form_doc: boolean; issuing_country: string;
  issuer_ko: string; validity_days: string; notarization: string; original_required: string;
  issued_within_days: string; guide_ko: string; guide_vi: string; aliases: string;
};

function draftFrom(s: DocStandard | null): StdDraft {
  return {
    name_ko: s?.name_ko ?? "",
    name_vi: s?.name_vi ?? "",
    is_form_doc: s?.is_form_doc ?? false,
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

function StandardFields({ d, set, idPrefix }: { d: StdDraft; set: <K extends keyof StdDraft>(k: K, v: StdDraft[K]) => void; idPrefix: string }) {
  const num = (v: string) => v.replace(/[^\d]/g, "");
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="서류 이름 (한국어)"><Input id={`${idPrefix}-name-ko`} value={d.name_ko} onChange={(e) => set("name_ko", e.target.value)} /></Field>
        <Field label="서류 이름 (베트남어)"><Input id={`${idPrefix}-name-vi`} value={d.name_vi} onChange={(e) => set("name_vi", e.target.value)} /></Field>
      </div>
      <fieldset className="flex flex-wrap items-center gap-4 text-sm">
        <legend className="mb-1 text-xs text-muted-foreground">서류 종류</legend>
        <label className="flex items-center gap-1.5"><input type="radio" name={`${idPrefix}-kind`} checked={!d.is_form_doc} onChange={() => set("is_form_doc", false)} /> 발급서류 <span className="text-muted-foreground">(기관에서 발급받아 제출)</span></label>
        <label className="flex items-center gap-1.5"><input type="radio" name={`${idPrefix}-kind`} checked={d.is_form_doc} onChange={() => set("is_form_doc", true)} /> 작성서류 <span className="text-muted-foreground">(학교 양식에 채워 제출)</span></label>
      </fieldset>
      <div className="grid gap-2 sm:grid-cols-3">
        <Field label="발급국">
          <select id={`${idPrefix}-country`} className={`${selectClass} w-full`} value={d.issuing_country} onChange={(e) => set("issuing_country", e.target.value)}>
            <option value="">범용</option>
            {Object.entries(NATIONALITY_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
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

function toInput(d: StdDraft) {
  return {
    name_ko: d.name_ko,
    name_vi: d.name_vi,
    is_form_doc: d.is_form_doc,
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

function StandardDialog({ standard, onClose }: { standard: DocStandard | null; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [d, setD] = useState<StdDraft>(() => draftFrom(standard));
  const set = <K extends keyof StdDraft>(k: K, v: StdDraft[K]) => setD((c) => ({ ...c, [k]: v }));
  if (!standard) return null;
  const save = () =>
    start(async () => {
      const r = await saveDocStandardAction({ key: standard.key, ...toInput(d), is_active: standard.is_active });
      if (!r.ok) return void toast.error(r.error);
      toast.success("서류를 저장했습니다. 이 서류를 쓰는 모든 대학에 반영됩니다.");
      router.refresh();
      onClose();
    });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>서류 편집 — {standard.name_ko}</DialogTitle>
          <DialogDescription>여기서 고치면 이 서류를 쓰는 모든 항목·대학에 바로 반영됩니다. 대학이 따로 설정한 값만 그대로 남습니다.</DialogDescription>
        </DialogHeader>
        <StandardFields d={d} set={set} idPrefix={`std-${standard.key}`} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>닫기</Button>
          <Button onClick={save} disabled={pending}>저장</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewStandardDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (itemKey: string | null) => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [d, setD] = useState<StdDraft>(() => draftFrom(null));
  const set = <K extends keyof StdDraft>(k: K, v: StdDraft[K]) => setD((c) => ({ ...c, [k]: v }));
  const save = () =>
    start(async () => {
      const r = await saveDocStandardAction(toInput(d));
      if (!r.ok) return void toast.error(r.error);
      toast.success("서류를 등록했습니다. 모집요강에서 바로 고를 수 있습니다.");
      setD(draftFrom(null));
      router.refresh();
      onCreated(r.data.itemKey);
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

function NewBundleDialog({ open, standards, onClose, onCreated }: { open: boolean; standards: DocStandard[]; onClose: () => void; onCreated: (key: string) => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [nameKo, setNameKo] = useState("");
  const [nameVi, setNameVi] = useState("");
  const [firstStd, setFirstStd] = useState("");
  // 빈 묶음은 저장할 수 없다(칸마다 선택지가 있어야 함). 첫 서류를 여기서 받아
  // 기본 구성 한 칸으로 만들고, 나머지 칸·조건은 편집 화면에서 이어간다.
  const save = () =>
    start(async () => {
      const r = await saveDocItemAction({
        name_ko: nameKo,
        name_vi: nameVi,
        variants: [{ when: null, slots: [{ target: null, options: [{ standard: firstStd }] }] }],
      });
      if (!r.ok) return void toast.error(r.error);
      toast.success("묶음을 만들었습니다. 이어서 칸과 조건을 채우세요.");
      setNameKo(""); setNameVi(""); setFirstStd("");
      router.refresh();
      onCreated(r.data.key);
      onClose();
    });
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>새 묶음</DialogTitle>
          <DialogDescription>여러 서류 중 하나를 내거나, 나라마다 다른 서류를 내는 항목. 예: 가족관계 입증, 재산 입증.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Field label="항목 이름 (한국어)"><Input id="new-bundle-name-ko" value={nameKo} onChange={(e) => setNameKo(e.target.value)} placeholder="예: 가족관계 입증" /></Field>
          <Field label="항목 이름 (베트남어)"><Input id="new-bundle-name-vi" value={nameVi} onChange={(e) => setNameVi(e.target.value)} /></Field>
          <Field label="첫 서류 (기본 구성의 첫 칸)">
            <select id="new-bundle-first-std" className={`${selectClass} w-full`} value={firstStd} onChange={(e) => setFirstStd(e.target.value)}>
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
