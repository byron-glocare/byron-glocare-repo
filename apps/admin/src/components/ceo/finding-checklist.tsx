"use client";

import type { FindingCustomer } from "@/lib/ceo/findings";

/**
 * 등록 폼 하단 — 이 등록으로 발굴필요를 해소할 고객을 수동 체크.
 * 저장 시 체크된 고객 id 가 서버 액션으로 넘어가 플래그가 해제된다.
 */
export function FindingChecklist({
  title,
  customers,
  selected,
  onToggle,
  disabled,
}: {
  title: string;
  customers: FindingCustomer[];
  selected: string[];
  onToggle: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="text-xs text-muted-foreground">
          {selected.length}명 선택
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        이 등록으로 발굴이 해소되는 고객을 체크하세요. 저장하면 목록에서 빠집니다.
      </p>

      {customers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          발굴 필요 고객이 없습니다.
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {customers.map((c) => {
            const checked = selected.includes(c.id);
            const name =
              [c.name_vi, c.name_kr].filter(Boolean).join(" / ") || "(이름 없음)";
            return (
              <li key={c.id}>
                <label className="flex items-center gap-3 px-3 py-2.5">
                  <input
                    type="checkbox"
                    className="size-4 shrink-0"
                    checked={checked}
                    onChange={() => onToggle(c.id)}
                    disabled={disabled}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {c.desired_region || "희망지역 미입력"}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
