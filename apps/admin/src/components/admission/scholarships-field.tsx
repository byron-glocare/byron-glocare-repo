"use client";

import { useState, useTransition } from "react";
import { Languages, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { translateScholarshipsAction } from "@/app/(app)/admissions/scholarship-actions";

export type Scholarship = {
  name: string;
  applies_to?: "freshman" | "enrolled" | "both";
  condition: string;
  benefit_type:
    | "tuition_pct"
    | "tuition_amount"
    | "admission_fee_waiver"
    | "stipend"
    | "dorm"
    | "policy"
    | "other";
  benefit_value?: number | string | null;
  /** TOPIK 등급별 차등: { "3": 0.3, "4": 0.5, ... } */
  tiered_by_topik?: Record<string, number | string> | null;
  duration?: string | null;
  exclusivity_with?: string[] | null;
  notes?: string | null;
  // 베트남어 (모집요강 PDF 베트남어판). 비어 있으면 PDF 에 그 글을 넣지 않는다 (KAN-39)
  name_vi?: string | null;
  condition_vi?: string | null;
  /** 혜택 설명 — 혜택값이 글(예: "성적에 따른 차등 지급")일 때의 베트남어 */
  benefit_vi?: string | null;
  duration_vi?: string | null;
  notes_vi?: string | null;
};

const VI_FIELDS = [
  { key: "name_vi", label: "장학금명", src: (s: Scholarship) => s.name },
  { key: "condition_vi", label: "조건", src: (s: Scholarship) => s.condition },
  { key: "benefit_vi", label: "혜택 설명", src: (s: Scholarship) => (typeof s.benefit_value === "string" ? s.benefit_value : "") },
  { key: "duration_vi", label: "기간", src: (s: Scholarship) => s.duration ?? "" },
  { key: "notes_vi", label: "메모", src: (s: Scholarship) => s.notes ?? "" },
] as const;
type ViKey = (typeof VI_FIELDS)[number]["key"];
const AI_KEY: Record<ViKey, "name" | "condition" | "benefit" | "duration" | "notes"> = {
  name_vi: "name",
  condition_vi: "condition",
  benefit_vi: "benefit",
  duration_vi: "duration",
  notes_vi: "notes",
};

const APPLIES_TO_OPTIONS = [
  { value: "freshman", label: "신입생" },
  { value: "enrolled", label: "재학생" },
  { value: "both", label: "신입+재학" },
] as const;

const BENEFIT_TYPE_OPTIONS = [
  { value: "tuition_pct", label: "등록금 % 감면" },
  { value: "tuition_amount", label: "등록금 정액 감면" },
  { value: "admission_fee_waiver", label: "입학금 면제" },
  { value: "stipend", label: "생활비 지원" },
  { value: "dorm", label: "기숙사 지원" },
  { value: "policy", label: "정책 혜택" },
  { value: "other", label: "기타" },
] as const;

const TOPIK_LEVELS = ["1", "2", "3", "4", "5", "6"];

const emptyScholarship = (): Scholarship => ({
  name: "",
  applies_to: "freshman",
  condition: "",
  benefit_type: "tuition_pct",
  benefit_value: null,
  tiered_by_topik: null,
  duration: "",
  exclusivity_with: null,
  notes: "",
});

export function ScholarshipsField({
  name,
  initial,
}: {
  name: string;
  initial: Scholarship[];
}) {
  const [items, setItems] = useState<Scholarship[]>(initial);
  const [translating, startTranslate] = useTransition();

  /** 한국어가 있는데 베트남어가 빈 칸만 AI 로 채운다. 이미 적은 베트남어는 건드리지 않는다. */
  const translateEmpty = () =>
    startTranslate(async () => {
      const res = await translateScholarshipsAction(
        items.map((s) => ({
          name: s.name ?? "",
          condition: s.condition ?? "",
          benefit: typeof s.benefit_value === "string" ? s.benefit_value : "",
          duration: s.duration ?? "",
          notes: s.notes ?? "",
        }))
      );
      if (!res.ok) {
        toast.error("번역하지 못했습니다", { description: res.error });
        return;
      }
      let filled = 0;
      setItems((cur) =>
        cur.map((s, i) => {
          const t = res.items[i];
          if (!t) return s;
          const next = { ...s };
          for (const f of VI_FIELDS) {
            const v = t[AI_KEY[f.key]]?.trim();
            if (v && !String(s[f.key] ?? "").trim() && f.src(s).trim()) {
              next[f.key] = v;
              filled++;
            }
          }
          return next;
        })
      );
      toast.success(filled > 0 ? `베트남어 ${filled}칸을 채웠습니다. 확인 후 저장하세요.` : "채울 빈 칸이 없습니다.");
    });

  const add = () => setItems([...items, emptyScholarship()]);
  const remove = (idx: number) =>
    setItems(items.filter((_, i) => i !== idx));
  const update = <K extends keyof Scholarship>(
    idx: number,
    field: K,
    value: Scholarship[K]
  ) => setItems(items.map((d, i) => (i === idx ? { ...d, [field]: value } : d)));

  const serialized = JSON.stringify(
    items.map((s) => ({
      name: s.name,
      applies_to: s.applies_to ?? "freshman",
      condition: s.condition,
      benefit_type: s.benefit_type,
      benefit_value:
        s.benefit_value === null || s.benefit_value === undefined || s.benefit_value === ""
          ? null
          : s.benefit_value,
      tiered_by_topik: s.tiered_by_topik ?? null,
      duration: s.duration || null,
      exclusivity_with: s.exclusivity_with ?? null,
      notes: s.notes || null,
      name_vi: s.name_vi?.trim() || null,
      condition_vi: s.condition_vi?.trim() || null,
      benefit_vi: s.benefit_vi?.trim() || null,
      duration_vi: s.duration_vi?.trim() || null,
      notes_vi: s.notes_vi?.trim() || null,
    }))
  );

  return (
    <div className="space-y-3">
      {items.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2">
          <span className="text-xs text-muted-foreground">
            베트남어 칸은 모집요강 PDF 베트남어판에 쓰입니다. 비어 있으면 그 글은 PDF 에서 빠집니다.
          </span>
          <Button type="button" variant="outline" size="sm" onClick={translateEmpty} disabled={translating}>
            {translating ? <Loader2 className="size-4 animate-spin" /> : <Languages className="size-4" />}
            {translating ? "번역 중…" : "AI 베트남어 번역 (빈 칸만)"}
          </Button>
        </div>
      ) : null}
      {items.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          등록된 장학금이 없습니다.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((s, idx) => (
            <div key={idx} className="rounded-md border bg-background p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  #{idx + 1}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(idx)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
                <FieldText
                  label="장학금명"
                  value={s.name}
                  onChange={(v) => update(idx, "name", v)}
                  required
                  placeholder="예: 외국인 입학장학금"
                />
                <FieldSelect
                  label="대상"
                  value={s.applies_to ?? "freshman"}
                  onChange={(v) =>
                    update(idx, "applies_to", v as Scholarship["applies_to"])
                  }
                  options={[...APPLIES_TO_OPTIONS]}
                />
                <FieldText
                  label="조건"
                  value={s.condition}
                  onChange={(v) => update(idx, "condition", v)}
                  required
                  placeholder="예: TOPIK 4급 이상"
                />
                <FieldSelect
                  label="혜택 종류"
                  value={s.benefit_type}
                  onChange={(v) =>
                    update(idx, "benefit_type", v as Scholarship["benefit_type"])
                  }
                  options={[...BENEFIT_TYPE_OPTIONS]}
                />
                <FieldText
                  label="혜택값 (단일)"
                  value={s.benefit_value == null ? "" : String(s.benefit_value)}
                  onChange={(v) => {
                    // 숫자로 파싱 가능하면 number, 아니면 string
                    if (v === "") {
                      update(idx, "benefit_value", null);
                      return;
                    }
                    const n = Number(v);
                    update(
                      idx,
                      "benefit_value",
                      Number.isFinite(n) && v.trim() !== "" ? n : v
                    );
                  }}
                  placeholder="0.5 = 50% 감면 / 정액은 원 단위"
                />
                <FieldText
                  label="기간"
                  value={s.duration ?? ""}
                  onChange={(v) => update(idx, "duration", v)}
                  placeholder="예: 첫 학기 / 4학기"
                />
              </div>

              {/* TOPIK 차등 매트릭스 */}
              <div className="mt-3 rounded-md border border-dashed bg-muted/30 p-2">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    TOPIK 등급별 차등 (선택)
                  </span>
                  {s.tiered_by_topik ? (
                    <button
                      type="button"
                      onClick={() => update(idx, "tiered_by_topik", null)}
                      className="text-xs text-destructive hover:underline"
                    >
                      차등 제거
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        update(idx, "tiered_by_topik", { "3": 0, "4": 0, "5": 0, "6": 0 })
                      }
                      className="text-xs text-primary hover:underline"
                    >
                      차등 추가
                    </button>
                  )}
                </div>
                {s.tiered_by_topik ? (
                  <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
                    {TOPIK_LEVELS.map((lv) => (
                      <label key={lv} className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">
                          {lv}급
                        </span>
                        <input
                          type="text"
                          value={
                            s.tiered_by_topik?.[lv] === undefined
                              ? ""
                              : String(s.tiered_by_topik[lv])
                          }
                          onChange={(e) => {
                            const v = e.target.value;
                            const nxt = { ...(s.tiered_by_topik ?? {}) };
                            if (v === "") {
                              delete nxt[lv];
                            } else {
                              const n = Number(v);
                              nxt[lv] =
                                Number.isFinite(n) && v.trim() !== "" ? n : v;
                            }
                            update(idx, "tiered_by_topik", nxt);
                          }}
                          placeholder="0.5"
                          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                        />
                      </label>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="mt-2">
                <FieldText
                  label="메모"
                  value={s.notes ?? ""}
                  onChange={(v) => update(idx, "notes", v)}
                  placeholder="추가 안내사항 (선택)"
                />
              </div>

              {/* 베트남어 — 한국어가 있는 칸만 */}
              {VI_FIELDS.some((f) => f.src(s).trim()) ? (
                <div className="mt-3 rounded-md border border-dashed p-2">
                  <div className="mb-2 text-xs font-medium text-muted-foreground">베트남어 (모집요강 PDF)</div>
                  <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
                    {VI_FIELDS.filter((f) => f.src(s).trim()).map((f) => (
                      <FieldText
                        key={f.key}
                        label={`${f.label} (VI)`}
                        value={s[f.key] ?? ""}
                        onChange={(v) => update(idx, f.key, v)}
                        placeholder={f.src(s)}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus className="size-4" />
        장학금 추가
      </Button>

      <input type="hidden" name={name} value={serialized} />
    </div>
  );
}

function FieldText({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">
        {label}
        {required ? <span className="text-destructive">*</span> : null}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
      />
    </label>
  );
}

function FieldSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
