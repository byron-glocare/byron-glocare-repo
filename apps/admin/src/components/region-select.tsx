"use client";

/**
 * 2단계 지역 선택 드롭다운.
 *
 *  - 1단계: 시·도
 *  - 2단계: 구/시/군 (특별시·광역시는 북동/북서/남동/남서 4분위)
 *
 * 저장은 단일 문자열 `"{1단계} {2단계}"` 형태 (단계2가 없으면 단계1만).
 * `value` 문자열을 parseRegion() 으로 역파싱해 두 셀렉트를 채운다.
 */

import { useMemo } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PROVINCE_CITIES,
  REGION1_OPTIONS,
  formatRegion,
  parseRegion,
  type Region1,
} from "@/lib/region-options";

const NONE_VALUE = "__none__";

type Props = {
  value: string | null | undefined;
  onChange: (next: string) => void;
  disabled?: boolean;
  /** 1단계 트리거 너비 */
  region1Width?: string;
  /** 2단계 트리거 너비 */
  region2Width?: string;
  region1Placeholder?: string;
  region2Placeholder?: string;
};

export function RegionSelect({
  value,
  onChange,
  disabled,
  region1Width = "min-w-28",
  region2Width = "flex-1",
  region1Placeholder = "시·도",
  region2Placeholder = "구·시·군",
}: Props) {
  const parsed = useMemo(() => parseRegion(value), [value]);

  const handleR1Change = (next: string | null) => {
    if (!next || next === NONE_VALUE) {
      onChange("");
      return;
    }
    // 1단계 바꾸면 2단계는 초기화
    onChange(formatRegion(next as Region1, ""));
  };

  const handleR2Change = (next: string | null) => {
    if (!parsed.r1) return;
    onChange(
      formatRegion(parsed.r1, !next || next === NONE_VALUE ? "" : next)
    );
  };

  const r2Options = parsed.r1 ? PROVINCE_CITIES[parsed.r1] : [];

  return (
    <div className="flex gap-2 items-center">
      <Select
        value={parsed.r1 || NONE_VALUE}
        onValueChange={handleR1Change}
        disabled={disabled}
      >
        <SelectTrigger className={region1Width}>
          <SelectValue placeholder={region1Placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE_VALUE}>—</SelectItem>
          {REGION1_OPTIONS.map((r1) => (
            <SelectItem key={r1} value={r1}>
              {r1}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={parsed.r2 || NONE_VALUE}
        onValueChange={handleR2Change}
        disabled={disabled || !parsed.r1}
      >
        <SelectTrigger className={region2Width}>
          <SelectValue placeholder={region2Placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE_VALUE}>—</SelectItem>
          {r2Options.map((r2) => (
            <SelectItem key={r2} value={r2}>
              {r2}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
