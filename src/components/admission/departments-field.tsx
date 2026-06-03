"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

export type Department = {
  faculty?: string | null;
  name?: string;
  track?: string | null;
  years?: number | null;
  capacity?: number | string | null;
  korean_min_topik?: number | null;
  english_alt_allowed?: boolean | null;
  tuition_per_semester_krw?: number | null;
  notes?: string | null;
};

const emptyDept = (): Department => ({
  faculty: "",
  name: "",
  track: "",
  years: null,
  capacity: null,
  korean_min_topik: null,
  tuition_per_semester_krw: null,
  notes: "",
});

/** name = form submit 시 hidden input 의 name (예: "spec_departments") */
export function DepartmentsField({
  name,
  initial,
}: {
  name: string;
  initial: Department[];
}) {
  const [items, setItems] = useState<Department[]>(
    initial.length > 0 ? initial : []
  );

  const add = () => setItems([...items, emptyDept()]);
  const remove = (idx: number) =>
    setItems(items.filter((_, i) => i !== idx));
  const update = <K extends keyof Department>(
    idx: number,
    field: K,
    value: Department[K]
  ) =>
    setItems(
      items.map((d, i) => (i === idx ? { ...d, [field]: value } : d))
    );

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          등록된 학과가 없습니다.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((d, idx) => (
            <div
              key={idx}
              className="rounded-md border bg-background p-3"
            >
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

              <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
                <FieldText
                  label="학부"
                  value={d.faculty ?? ""}
                  onChange={(v) => update(idx, "faculty", v || null)}
                  placeholder="예: 인문사회"
                />
                <FieldText
                  label="학과명"
                  value={d.name ?? ""}
                  onChange={(v) => update(idx, "name", v)}
                  placeholder="예: 글로벌요양복지과"
                  required
                />
                <FieldText
                  label="트랙"
                  value={d.track ?? ""}
                  onChange={(v) => update(idx, "track", v || null)}
                  placeholder="예: 영어트랙"
                />
                <FieldNumber
                  label="년수"
                  value={d.years}
                  onChange={(v) => update(idx, "years", v)}
                  min={1}
                  max={6}
                />
                <FieldNumber
                  label="정원"
                  value={typeof d.capacity === "number" ? d.capacity : null}
                  onChange={(v) => update(idx, "capacity", v)}
                  min={1}
                />
                <FieldSelect<number | null>
                  label="TOPIK"
                  value={d.korean_min_topik ?? null}
                  onChange={(v) => update(idx, "korean_min_topik", v)}
                  options={[
                    { value: null, label: "—" },
                    { value: 1, label: "1급" },
                    { value: 2, label: "2급" },
                    { value: 3, label: "3급" },
                    { value: 4, label: "4급" },
                    { value: 5, label: "5급" },
                    { value: 6, label: "6급" },
                  ]}
                />
                <FieldNumber
                  label="등록금(학기)"
                  value={d.tuition_per_semester_krw}
                  onChange={(v) =>
                    update(idx, "tuition_per_semester_krw", v)
                  }
                  placeholder="원"
                />
                <div className="flex items-end">
                  <label className="flex items-center gap-1.5 text-xs">
                    <input
                      type="checkbox"
                      checked={d.english_alt_allowed ?? false}
                      onChange={(e) =>
                        update(
                          idx,
                          "english_alt_allowed",
                          e.target.checked || null
                        )
                      }
                    />
                    영어 대체 가능
                  </label>
                </div>
              </div>

              {/* 메모는 한 줄 전체 */}
              <div className="mt-2">
                <FieldText
                  label="메모"
                  value={d.notes ?? ""}
                  onChange={(v) => update(idx, "notes", v || null)}
                  placeholder="추가 안내사항"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus className="size-4" />
        학과 추가
      </Button>

      {/* form submit 시 JSON 전송 */}
      <input type="hidden" name={name} value={JSON.stringify(items)} />
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

function FieldNumber({
  label,
  value,
  onChange,
  placeholder,
  min,
  max,
}: {
  label: string;
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  placeholder?: string;
  min?: number;
  max?: number;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? null : Number(v));
        }}
        placeholder={placeholder}
        min={min}
        max={max}
        className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
      />
    </label>
  );
}

function FieldSelect<T extends number | string | null>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  // null 을 string 으로 직렬화 (HTML select 요구)
  const serialize = (v: T): string => (v === null ? "__null__" : String(v));
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <select
        value={serialize(value)}
        onChange={(e) => {
          const raw = e.target.value;
          const opt = options.find((o) => serialize(o.value) === raw);
          if (opt) onChange(opt.value);
        }}
        className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
      >
        {options.map((o) => (
          <option key={serialize(o.value)} value={serialize(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
