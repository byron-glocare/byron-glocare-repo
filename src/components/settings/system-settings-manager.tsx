"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save, X, Plus } from "lucide-react";

import { updateSystemSetting } from "@/app/(app)/settings/actions";
import type { Json } from "@/types/database";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type Props = {
  settings: Record<string, Json | undefined>;
};

export function SystemSettingsManager({ settings }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">결제 · 정산 설정</CardTitle>
        <CardDescription>
          시스템 전역 금액·비율·옵션. 모든 고객/거래에 즉시 반영됩니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 숫자 설정 */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <NumberSetting
            settingKey="training_reservation_fee"
            label="교육 예약금"
            suffix="원"
            value={toNumber(settings.training_reservation_fee, 35000)}
          />
          <NumberSetting
            settingKey="welcome_pack_reservation_fee"
            label="웰컴팩 예약금"
            suffix="원"
            value={toNumber(settings.welcome_pack_reservation_fee, 100000)}
          />
          <NumberSetting
            settingKey="welcome_pack_price"
            label="웰컴팩 정가"
            suffix="원"
            value={toNumber(settings.welcome_pack_price, 1500000)}
          />
          <NumberSetting
            settingKey="welcome_pack_early_discount"
            label="웰컴팩 예약 즉시 할인"
            suffix="원"
            value={toNumber(settings.welcome_pack_early_discount, 300000)}
          />
          <NumberSetting
            settingKey="commission_rate"
            label="소개비 비율"
            suffix=""
            step={0.01}
            value={toNumber(settings.commission_rate, 0.25)}
            hint="예: 0.25 = 교육비의 25%"
          />
          <NumberSetting
            settingKey="commission_settle_days_weekday"
            label="소개비 정산일 (주간)"
            suffix="일"
            value={toNumber(settings.commission_settle_days_weekday, 45)}
          />
          <NumberSetting
            settingKey="commission_settle_days_night"
            label="소개비 정산일 (야간)"
            suffix="일"
            value={toNumber(settings.commission_settle_days_night, 75)}
          />
        </div>

        {/* 배열 설정 */}
        <div className="grid gap-4 lg:grid-cols-3">
          <ArraySetting
            settingKey="welcome_pack_interim_options"
            label="웰컴팩 잔금1 옵션"
            suffix="원"
            numeric
            values={toNumberArray(settings.welcome_pack_interim_options, [
              250000, 300000, 350000,
            ])}
          />
          <ArraySetting
            settingKey="event_types"
            label="이벤트 종류"
            values={toStringArray(settings.event_types, [
              "친구 소개",
              "등록 할인",
              "교통비 지원",
              "기타",
            ])}
          />
          <ArraySetting
            settingKey="gift_types"
            label="상품권 종류"
            values={toStringArray(settings.gift_types, [
              "쿠팡상품권",
              "현금",
              "기타",
            ])}
          />
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// 숫자 단일 값
// =============================================================================

function NumberSetting({
  settingKey,
  label,
  suffix,
  value,
  step,
  hint,
}: {
  settingKey: string;
  label: string;
  suffix: string;
  value: number;
  step?: number;
  hint?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = useState(value);
  const dirty = current !== value;

  function onSave() {
    startTransition(async () => {
      const result = await updateSystemSetting(settingKey, current);
      if (result.ok) {
        toast.success(`${label} 저장됨`);
        router.refresh();
      } else {
        toast.error("저장 실패", { description: result.error });
      }
    });
  }

  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            type="number"
            step={step ?? 1}
            value={current}
            onChange={(e) => setCurrent(Number(e.target.value) || 0)}
          />
          {suffix && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
              {suffix}
            </span>
          )}
        </div>
        <Button
          type="button"
          size="sm"
          onClick={onSave}
          disabled={!dirty || pending}
        >
          {pending ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Save className="size-3" />
          )}
        </Button>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// =============================================================================
// 배열 (숫자 or 문자열)
// =============================================================================

function ArraySetting({
  settingKey,
  label,
  suffix,
  numeric,
  values,
}: {
  settingKey: string;
  label: string;
  suffix?: string;
  numeric?: boolean;
  values: (string | number)[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [items, setItems] = useState<(string | number)[]>(values);
  const [draft, setDraft] = useState("");

  const dirty = JSON.stringify(items) !== JSON.stringify(values);

  function addItem() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    const parsed = numeric ? Number(trimmed) : trimmed;
    if (numeric && (!Number.isFinite(parsed as number) || parsed === 0)) return;
    setItems((prev) => [...prev, parsed as string | number]);
    setDraft("");
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function onSave() {
    startTransition(async () => {
      const result = await updateSystemSetting(
        settingKey,
        items as unknown as Json
      );
      if (result.ok) {
        toast.success(`${label} 저장됨`);
        router.refresh();
      } else {
        toast.error("저장 실패", { description: result.error });
      }
    });
  }

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        <Button
          type="button"
          size="sm"
          onClick={onSave}
          disabled={!dirty || pending}
        >
          {pending ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Save className="size-3" />
          )}
          저장
        </Button>
      </div>

      <div className="flex flex-wrap gap-1 min-h-8">
        {items.map((v, i) => (
          <Badge
            key={`${v}-${i}`}
            variant="outline"
            className="text-xs gap-1 pl-2 pr-1"
          >
            <span>
              {numeric
                ? (v as number).toLocaleString()
                : v}
              {suffix && numeric ? suffix : ""}
            </span>
            <button
              type="button"
              onClick={() => removeItem(i)}
              className="size-4 rounded-sm hover:bg-destructive/10 text-muted-foreground hover:text-destructive inline-flex items-center justify-center"
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}
      </div>

      <div className="flex gap-1">
        <Input
          type={numeric ? "number" : "text"}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={numeric ? "금액" : "항목 입력"}
          className="h-8"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addItem();
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addItem}
          disabled={!draft.trim()}
        >
          <Plus className="size-3" />
        </Button>
      </div>
    </div>
  );
}

// =============================================================================
// 유틸
// =============================================================================

function toNumber(v: Json | undefined, fallback: number): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function toNumberArray(v: Json | undefined, fallback: number[]): number[] {
  if (Array.isArray(v) && v.every((x) => typeof x === "number")) {
    return v as number[];
  }
  return fallback;
}

function toStringArray(v: Json | undefined, fallback: string[]): string[] {
  if (Array.isArray(v) && v.every((x) => typeof x === "string")) {
    return v as string[];
  }
  return fallback;
}
