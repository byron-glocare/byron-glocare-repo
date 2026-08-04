"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  saveIssuancePricingAction,
  deleteIssuancePricingAction,
} from "./actions";

export type PricingRow = {
  id: string;
  std_key: string | null;
  label_ko: string;
  notarization: string;
  unit_price: number;
  proxy_unavailable_surcharge: number;
  sort_order: number;
  is_active: boolean;
};

const NOTA_OPTIONS: { value: string; label: string }[] = [
  { value: "none", label: "인증 없음" },
  { value: "translation_notarization", label: "번역 공증" },
  { value: "consul", label: "영사확인" },
  { value: "consul_for_vietnam", label: "베트남 영사확인" },
  { value: "apostille", label: "아포스티유" },
  { value: "apostille_or_consul", label: "아포스티유/영사확인" },
];

type Draft = Omit<PricingRow, "id"> & { id?: string };

const EMPTY: Draft = {
  std_key: "",
  label_ko: "",
  notarization: "none",
  unit_price: 0,
  proxy_unavailable_surcharge: 0,
  sort_order: 0,
  is_active: true,
};

export function PricingManager({ rows }: { rows: PricingRow[] }) {
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <PricingRowForm key={r.id} initial={r} />
      ))}
      <div className="rounded-lg border border-dashed border-border p-3">
        <p className="mb-2 text-sm font-medium text-muted-foreground">
          + 새 서류 단가 추가
        </p>
        <PricingRowForm initial={{ ...EMPTY }} isNew />
      </div>
    </div>
  );
}

function PricingRowForm({
  initial,
  isNew = false,
}: {
  initial: Draft;
  isNew?: boolean;
}) {
  const router = useRouter();
  const [d, setD] = useState<Draft>(initial);
  const [pending, start] = useTransition();

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setD((cur) => ({ ...cur, [k]: v }));

  const save = () =>
    start(async () => {
      const res = await saveIssuancePricingAction({
        id: isNew ? null : d.id,
        std_key: d.std_key ?? "",
        label_ko: d.label_ko,
        notarization: d.notarization,
        unit_price: Number(d.unit_price),
        proxy_unavailable_surcharge: Number(d.proxy_unavailable_surcharge),
        sort_order: Number(d.sort_order),
        is_active: d.is_active,
      });
      if (res.ok) {
        toast.success(isNew ? "추가되었습니다." : "저장되었습니다.");
        if (isNew) setD({ ...EMPTY });
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });

  const remove = () =>
    start(async () => {
      if (!d.id) return;
      if (!confirm(`'${d.label_ko}' 단가를 삭제할까요?`)) return;
      const res = await deleteIssuancePricingAction(d.id);
      if (res.ok) {
        toast.success("삭제되었습니다.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });

  return (
    <div
      className={`grid grid-cols-1 items-end gap-2 rounded-lg border p-3 sm:grid-cols-12 ${
        isNew ? "border-transparent" : "border-border bg-card"
      }`}
    >
      <label className="sm:col-span-3">
        <span className="mb-1 block text-xs text-muted-foreground">서류명</span>
        <Input
          value={d.label_ko}
          onChange={(e) => set("label_ko", e.target.value)}
          placeholder="졸업증명서"
        />
      </label>
      <label className="sm:col-span-2">
        <span className="mb-1 block text-xs text-muted-foreground">인증</span>
        <select
          value={d.notarization}
          onChange={(e) => set("notarization", e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
        >
          {NOTA_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="sm:col-span-2">
        <span className="mb-1 block text-xs text-muted-foreground">단가(원)</span>
        <Input
          type="number"
          value={d.unit_price}
          onChange={(e) => set("unit_price", Number(e.target.value))}
        />
      </label>
      <label className="sm:col-span-2">
        <span className="mb-1 block text-xs text-muted-foreground">
          대리불가 가산
        </span>
        <Input
          type="number"
          value={d.proxy_unavailable_surcharge}
          onChange={(e) =>
            set("proxy_unavailable_surcharge", Number(e.target.value))
          }
        />
      </label>
      <label className="sm:col-span-1">
        <span className="mb-1 block text-xs text-muted-foreground">순서</span>
        <Input
          type="number"
          value={d.sort_order}
          onChange={(e) => set("sort_order", Number(e.target.value))}
        />
      </label>
      <div className="flex items-center gap-2 sm:col-span-2">
        <label className="flex items-center gap-1 text-xs">
          <input
            type="checkbox"
            checked={d.is_active}
            onChange={(e) => set("is_active", e.target.checked)}
          />
          노출
        </label>
        <Button size="sm" onClick={save} disabled={pending}>
          {isNew ? "추가" : "저장"}
        </Button>
        {!isNew && (
          <Button
            size="sm"
            variant="outline"
            onClick={remove}
            disabled={pending}
          >
            삭제
          </Button>
        )}
      </div>
    </div>
  );
}
