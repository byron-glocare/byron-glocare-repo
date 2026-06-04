"use client";

import { useState, useTransition } from "react";
import type { Json } from "@/types/database";
import { saveStudentDataValueAction } from "./actions";

export type DataTypeMeta = {
  key: string;
  label_ko: string;
  label_vi: string;
  category: string;
  input_type: string;
  options: Array<{ value: string; label_ko: string; label_vi: string }> | null;
  hint_ko: string | null;
  hint_vi: string | null;
  is_essay_basis: boolean;
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

const CATEGORY_LABEL: Record<string, string> = {
  identity: "Thông tin cá nhân",
  education: "Học vấn",
  family: "Gia đình",
  financial: "Tài chính",
  language: "Ngoại ngữ",
  contact: "Liên hệ",
  career: "Kinh nghiệm",
  essay: "Văn viết (cơ sở AI)",
  document: "Tệp đính kèm",
  other: "Khác",
};

export function StudentDataEditor({
  studentId,
  dataTypes,
  existingValues,
  requiredBySource,
}: {
  studentId: string;
  dataTypes: DataTypeMeta[];
  existingValues: Record<string, Json>;
  requiredBySource: Record<string, string[]>;
}) {
  // 로컬 state — 즉시 UI 반영 + 서버 저장
  const [values, setValues] = useState<Record<string, Json | null>>(
    existingValues as Record<string, Json | null>
  );

  // 카테고리별 그룹화
  const byCategory = new Map<string, DataTypeMeta[]>();
  for (const dt of dataTypes) {
    if (!byCategory.has(dt.category)) byCategory.set(dt.category, []);
    byCategory.get(dt.category)!.push(dt);
  }

  // 부족 항목 카운트 — 지원 의향에서 필요한데 입력 안 된 것
  const requiredKeys = Object.keys(requiredBySource);
  const missingRequired = requiredKeys.filter((k) => {
    const v = values[k];
    return v === null || v === undefined || v === "";
  });

  return (
    <div className="space-y-4">
      {/* 부족 항목 요약 */}
      {requiredKeys.length > 0 ? (
        <section
          className={`rounded-lg border p-4 ${
            missingRequired.length === 0
              ? "border-emerald-200 bg-emerald-50"
              : "border-amber-200 bg-amber-50"
          }`}
        >
          <h2 className="text-sm font-semibold">
            {missingRequired.length === 0
              ? `✓ Tất cả ${requiredKeys.length} mục cần thiết đã đầy đủ`
              : `⚠ Còn thiếu ${missingRequired.length} / ${requiredKeys.length} mục cần thiết`}
          </h2>
          {missingRequired.length > 0 ? (
            <p className="mt-1 text-xs">
              Các mục có dấu{" "}
              <span className="rounded bg-amber-200 px-1 font-semibold">cần</span>{" "}
              bên dưới là do mẫu hồ sơ của trường yêu cầu.
            </p>
          ) : null}
        </section>
      ) : (
        <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs text-slate-600">
            Chưa có đơn tuyển sinh nào — chưa thể xác định mục bắt buộc tự động.
            Vui lòng nhập đầy đủ thông tin có thể có.
          </p>
        </section>
      )}

      {/* 카테고리별 입력 */}
      {CATEGORY_ORDER.filter((c) => byCategory.has(c)).map((cat) => (
        <CategorySection
          key={cat}
          category={cat}
          dataTypes={byCategory.get(cat)!}
          values={values}
          setValues={setValues}
          studentId={studentId}
          requiredBySource={requiredBySource}
        />
      ))}
    </div>
  );
}

function CategorySection({
  category,
  dataTypes,
  values,
  setValues,
  studentId,
  requiredBySource,
}: {
  category: string;
  dataTypes: DataTypeMeta[];
  values: Record<string, Json | null>;
  setValues: React.Dispatch<React.SetStateAction<Record<string, Json | null>>>;
  studentId: string;
  requiredBySource: Record<string, string[]>;
}) {
  const filled = dataTypes.filter((dt) => {
    const v = values[dt.key];
    return v !== null && v !== undefined && v !== "";
  }).length;

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <header className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">
          {CATEGORY_LABEL[category] ?? category}{" "}
          <span className="font-normal text-slate-500">
            ({filled}/{dataTypes.length})
          </span>
        </h2>
      </header>
      <div className="divide-y divide-slate-100">
        {dataTypes.map((dt) => (
          <FieldRow
            key={dt.key}
            dataType={dt}
            value={values[dt.key] ?? null}
            onChange={(v) => setValues((cur) => ({ ...cur, [dt.key]: v }))}
            studentId={studentId}
            requiredSources={requiredBySource[dt.key] ?? []}
          />
        ))}
      </div>
    </section>
  );
}

function FieldRow({
  dataType,
  value,
  onChange,
  studentId,
  requiredSources,
}: {
  dataType: DataTypeMeta;
  value: Json | null;
  onChange: (v: Json | null) => void;
  studentId: string;
  requiredSources: string[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<boolean>(false);

  const isRequired = requiredSources.length > 0;
  const isFilled =
    value !== null && value !== undefined && value !== "" && value !== false;

  const save = (newValue: Json | null) => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await saveStudentDataValueAction({
        studentId,
        dataTypeKey: dataType.key,
        value: newValue,
      });
      if (!res.ok) {
        setError(res.error);
      } else {
        setSaved(true);
        // 2초 후 사라짐
        setTimeout(() => setSaved(false), 1500);
      }
    });
  };

  return (
    <div className="px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <label className="text-sm font-medium text-slate-900">
            {dataType.label_vi}
            {isRequired ? (
              <span
                className="ml-2 rounded bg-amber-200 px-1 text-[10px] font-semibold text-amber-900"
                title={requiredSources.join(", ")}
              >
                cần
              </span>
            ) : null}
            {dataType.is_essay_basis ? (
              <span className="ml-2 rounded bg-purple-100 px-1 text-[10px] text-purple-700">
                AI cơ sở
              </span>
            ) : null}
          </label>
          <div className="mt-0.5 text-xs text-slate-500">
            {dataType.label_ko}{" "}
            <span className="text-slate-400">· {dataType.key}</span>
          </div>
          {dataType.hint_vi ? (
            <div className="mt-1 text-xs text-slate-600">
              💡 {dataType.hint_vi}
            </div>
          ) : null}
        </div>
        <div className="shrink-0">
          {pending ? (
            <span className="text-xs text-slate-400">đang lưu...</span>
          ) : saved ? (
            <span className="text-xs text-emerald-600">✓ đã lưu</span>
          ) : isFilled ? (
            <span className="text-xs text-emerald-600">✓</span>
          ) : (
            <span className="text-xs text-slate-300">—</span>
          )}
        </div>
      </div>

      <div className="mt-2">
        <ValueInput
          dataType={dataType}
          value={value}
          onCommit={(v) => {
            onChange(v);
            save(v);
          }}
        />
      </div>

      {error ? (
        <div className="mt-1 text-xs text-rose-700">Lỗi: {error}</div>
      ) : null}
    </div>
  );
}

function ValueInput({
  dataType,
  value,
  onCommit,
}: {
  dataType: DataTypeMeta;
  value: Json | null;
  onCommit: (v: Json | null) => void;
}) {
  const baseClass =
    "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";

  switch (dataType.input_type) {
    case "long_text":
      return (
        <TextAreaInput
          value={typeof value === "string" ? value : ""}
          onCommit={(v) => onCommit(v || null)}
          baseClass={baseClass}
        />
      );

    case "date":
      return (
        <input
          type="date"
          defaultValue={typeof value === "string" ? value : ""}
          onBlur={(e) => onCommit(e.target.value || null)}
          className={baseClass}
        />
      );

    case "number":
      return (
        <input
          type="number"
          step="any"
          defaultValue={typeof value === "number" ? value : ""}
          onBlur={(e) => {
            const v = e.target.value;
            onCommit(v === "" ? null : Number(v));
          }}
          className={baseClass}
        />
      );

    case "select":
      return (
        <select
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onCommit(e.target.value || null)}
          className={baseClass}
        >
          <option value="">— chưa chọn —</option>
          {(dataType.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label_vi} · {o.label_ko}
            </option>
          ))}
        </select>
      );

    case "multi_select":
      return (
        <MultiSelectInput
          value={Array.isArray(value) ? (value as string[]) : []}
          options={dataType.options ?? []}
          onCommit={(arr) => onCommit(arr.length > 0 ? arr : null)}
        />
      );

    case "boolean":
      return (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={value === true}
            onChange={(e) => onCommit(e.target.checked)}
          />
          <span>Có</span>
        </label>
      );

    case "file":
      // 파일 업로드는 후속 라운드. 지금은 URL 만 받기.
      return (
        <input
          type="url"
          placeholder="URL tệp (sẽ thêm tải lên sau)"
          defaultValue={
            value && typeof value === "object" && !Array.isArray(value)
              ? ((value as { url?: string }).url ?? "")
              : ""
          }
          onBlur={(e) => {
            const url = e.target.value.trim();
            onCommit(url ? { url, file_name: url.split("/").pop() ?? "" } : null);
          }}
          className={baseClass}
        />
      );

    case "text":
    default:
      return (
        <input
          type="text"
          defaultValue={typeof value === "string" ? value : ""}
          onBlur={(e) => onCommit(e.target.value || null)}
          className={baseClass}
        />
      );
  }
}

function TextAreaInput({
  value,
  onCommit,
  baseClass,
}: {
  value: string;
  onCommit: (v: string) => void;
  baseClass: string;
}) {
  const [draft, setDraft] = useState(value);
  return (
    <textarea
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== value) onCommit(draft);
      }}
      rows={4}
      className={baseClass}
    />
  );
}

function MultiSelectInput({
  value,
  options,
  onCommit,
}: {
  value: string[];
  options: Array<{ value: string; label_ko: string; label_vi: string }>;
  onCommit: (v: string[]) => void;
}) {
  const toggle = (v: string) => {
    const next = value.includes(v)
      ? value.filter((x) => x !== v)
      : [...value, v];
    onCommit(next);
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const checked = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => toggle(o.value)}
            className={`rounded-md border px-2 py-1 text-xs ${
              checked
                ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                : "border-slate-300 hover:bg-slate-50"
            }`}
          >
            {o.label_vi}
          </button>
        );
      })}
    </div>
  );
}
