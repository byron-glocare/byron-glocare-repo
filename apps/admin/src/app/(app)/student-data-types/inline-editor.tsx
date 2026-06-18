"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Pencil, Plus } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DataTypeForm,
  type EditableDataType,
  type DataTypeRef,
} from "./type-form";

const CATEGORY_LABEL: Record<string, string> = {
  identity: "신원",
  education: "학력",
  family: "가족",
  financial: "재정",
  language: "어학",
  contact: "연락처",
  career: "경력·자격",
  essay: "서술형 (작문 기초)",
  document: "발급 서류",
  other: "기타",
};

const CATEGORY_ORDER = [
  "identity",
  "education",
  "family",
  "financial",
  "language",
  "contact",
  "career",
  "essay",
  "document",
  "other",
];

type Editing =
  | { mode: "edit"; dt: EditableDataType }
  | { mode: "new" }
  | null;

/**
 * 표준데이터 인라인 편집기 — 목록 최상단에 닫힘 상태로 배치.
 *   카테고리 → 식별자 key 드롭다운 선택 후 [편집] → 폼 활성화.
 *   저장하면 화면 이동 없이(router.refresh) 아래 목록에 반영.
 */
export function InlineDataTypeEditor({
  types,
  allTypes,
}: {
  types: EditableDataType[];
  allTypes: DataTypeRef[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("");
  const [key, setKey] = useState("");
  const [editing, setEditing] = useState<Editing>(null);

  const cats = CATEGORY_ORDER.filter((c) => types.some((t) => t.category === c));
  const keysInCat = useMemo(
    () =>
      types
        .filter((t) => t.category === category)
        .sort((a, b) => a.sort_order - b.sort_order),
    [types, category]
  );

  function startEdit() {
    const dt = types.find((t) => t.key === key);
    if (dt) setEditing({ mode: "edit", dt });
  }

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          {open ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
          표준데이터 편집
          <span className="font-normal text-muted-foreground">
            — 카테고리·key 를 골라 바로 편집 (화면 이동 없음)
          </span>
        </span>
      </button>

      {open ? (
        <div className="space-y-4 border-t p-4">
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                카테고리
              </span>
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setKey("");
                  setEditing(null);
                }}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">— 선택 —</option>
                {cats.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABEL[c] ?? c}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                식별자 key
              </span>
              <select
                value={key}
                onChange={(e) => {
                  setKey(e.target.value);
                  setEditing(null);
                }}
                disabled={!category}
                className="h-9 min-w-[260px] rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
              >
                <option value="">— 선택 —</option>
                {keysInCat.map((t) => (
                  <option key={t.id} value={t.key}>
                    {t.label_ko} ({t.key})
                    {t.aliases && t.aliases.length > 0
                      ? ` — ${t.aliases.join(", ")}`
                      : ""}
                  </option>
                ))}
              </select>
            </label>

            <Button type="button" onClick={startEdit} disabled={!key}>
              <Pencil className="size-4" />
              편집
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditing({ mode: "new" });
              }}
            >
              <Plus className="size-4" />새 항목
            </Button>
          </div>

          {editing ? (
            <DataTypeForm
              key={editing.mode === "edit" ? editing.dt.id : "new"}
              dataType={editing.mode === "edit" ? editing.dt : undefined}
              allTypes={allTypes}
              inline
              onSaved={() => router.refresh()}
              onCancel={() => setEditing(null)}
            />
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
