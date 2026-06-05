"use client";

import { useRef, useState, useTransition } from "react";
import type { Json } from "@/types/database";
import { tr, type Locale } from "@/lib/i18n";
import {
  saveStudentDataValueAction,
  uploadStudentFileAction,
  getStudentFileSignedUrlAction,
  removeStudentFileAction,
} from "./actions";

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

function categoryLabel(locale: Locale, category: string): string {
  switch (category) {
    case "identity":
      return tr(locale, "개인 정보", "Thông tin cá nhân");
    case "education":
      return tr(locale, "학력", "Học vấn");
    case "family":
      return tr(locale, "가족", "Gia đình");
    case "financial":
      return tr(locale, "재정", "Tài chính");
    case "language":
      return tr(locale, "어학", "Ngoại ngữ");
    case "contact":
      return tr(locale, "연락처", "Liên hệ");
    case "career":
      return tr(locale, "경력", "Kinh nghiệm");
    case "essay":
      return tr(locale, "작문 (AI 기초자료)", "Văn viết (cơ sở AI)");
    case "document":
      return tr(locale, "첨부 파일", "Tệp đính kèm");
    case "other":
      return tr(locale, "기타", "Khác");
    default:
      return category;
  }
}

export function StudentDataEditor({
  locale,
  studentId,
  dataTypes,
  existingValues,
  requiredBySource,
}: {
  locale: Locale;
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
              ? tr(
                  locale,
                  `✓ 필수 항목 ${requiredKeys.length}개를 모두 입력했습니다`,
                  `✓ Tất cả ${requiredKeys.length} mục cần thiết đã đầy đủ`
                )
              : tr(
                  locale,
                  `⚠ 필수 항목 ${missingRequired.length} / ${requiredKeys.length}개가 미입력 상태입니다`,
                  `⚠ Còn thiếu ${missingRequired.length} / ${requiredKeys.length} mục cần thiết`
                )}
          </h2>
          {missingRequired.length > 0 ? (
            <p className="mt-1 text-xs">
              {tr(locale, "아래에서 ", "Các mục có dấu ")}
              <span className="rounded bg-amber-200 px-1 font-semibold">
                {tr(locale, "필수", "cần")}
              </span>{" "}
              {tr(
                locale,
                "표시가 된 항목은 대학 지원 양식에서 요구하는 항목입니다.",
                "bên dưới là do mẫu hồ sơ của trường yêu cầu."
              )}
            </p>
          ) : null}
        </section>
      ) : (
        <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs text-slate-600">
            {tr(
              locale,
              "등록된 지원 내역이 없어 필수 항목을 자동으로 판별할 수 없습니다. 입력 가능한 정보를 최대한 채워주세요.",
              "Chưa có đơn tuyển sinh nào — chưa thể xác định mục bắt buộc tự động. Vui lòng nhập đầy đủ thông tin có thể có."
            )}
          </p>
        </section>
      )}

      {/* 카테고리별 입력 */}
      {CATEGORY_ORDER.filter((c) => byCategory.has(c)).map((cat) => (
        <CategorySection
          key={cat}
          locale={locale}
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
  locale,
  category,
  dataTypes,
  values,
  setValues,
  studentId,
  requiredBySource,
}: {
  locale: Locale;
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
          {categoryLabel(locale, category)}{" "}
          <span className="font-normal text-slate-500">
            ({filled}/{dataTypes.length})
          </span>
        </h2>
      </header>
      <div className="divide-y divide-slate-100">
        {dataTypes.map((dt) => (
          <FieldRow
            key={dt.key}
            locale={locale}
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
  locale,
  dataType,
  value,
  onChange,
  studentId,
  requiredSources,
}: {
  locale: Locale;
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
            {locale === "ko" ? dataType.label_ko : dataType.label_vi}
            {isRequired ? (
              <span
                className="ml-2 rounded bg-amber-200 px-1 text-[10px] font-semibold text-amber-900"
                title={requiredSources.join(", ")}
              >
                {tr(locale, "필수", "cần")}
              </span>
            ) : null}
            {dataType.is_essay_basis ? (
              <span className="ml-2 rounded bg-purple-100 px-1 text-[10px] text-purple-700">
                {tr(locale, "AI 기초자료", "AI cơ sở")}
              </span>
            ) : null}
          </label>
          <div className="mt-0.5 text-xs text-slate-500">
            {locale === "ko" ? dataType.label_vi : dataType.label_ko}{" "}
            <span className="text-slate-400">· {dataType.key}</span>
          </div>
          {(locale === "ko" ? dataType.hint_ko : dataType.hint_vi) ? (
            <div className="mt-1 text-xs text-slate-600">
              💡 {locale === "ko" ? dataType.hint_ko : dataType.hint_vi}
            </div>
          ) : null}
        </div>
        <div className="shrink-0">
          {pending ? (
            <span className="text-xs text-slate-400">
              {tr(locale, "저장 중...", "đang lưu...")}
            </span>
          ) : saved ? (
            <span className="text-xs text-emerald-600">
              {tr(locale, "✓ 저장됨", "✓ đã lưu")}
            </span>
          ) : isFilled ? (
            <span className="text-xs text-emerald-600">✓</span>
          ) : (
            <span className="text-xs text-slate-300">—</span>
          )}
        </div>
      </div>

      <div className="mt-2">
        <ValueInput
          locale={locale}
          dataType={dataType}
          value={value}
          studentId={studentId}
          onCommit={(v) => {
            onChange(v);
            save(v);
          }}
        />
      </div>

      {error ? (
        <div className="mt-1 text-xs text-rose-700">
          {tr(locale, "오류", "Lỗi")}: {error}
        </div>
      ) : null}
    </div>
  );
}

function ValueInput({
  locale,
  dataType,
  value,
  studentId,
  onCommit,
}: {
  locale: Locale;
  dataType: DataTypeMeta;
  value: Json | null;
  studentId: string;
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
          <option value="">{tr(locale, "— 선택 안 함 —", "— chưa chọn —")}</option>
          {(dataType.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {locale === "ko"
                ? `${o.label_ko} · ${o.label_vi}`
                : `${o.label_vi} · ${o.label_ko}`}
            </option>
          ))}
        </select>
      );

    case "multi_select":
      return (
        <MultiSelectInput
          locale={locale}
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
          <span>{tr(locale, "예", "Có")}</span>
        </label>
      );

    case "file":
      return (
        <FileInput
          locale={locale}
          studentId={studentId}
          dataTypeKey={dataType.key}
          value={value}
          onCommit={onCommit}
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

function FileInput({
  locale,
  studentId,
  dataTypeKey,
  value,
  onCommit,
}: {
  locale: Locale;
  studentId: string;
  dataTypeKey: string;
  value: Json | null;
  onCommit: (v: Json | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileObj =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as { path?: string; url?: string; file_name?: string })
      : null;
  const fileName = fileObj?.file_name ?? null;
  const hasUpload = !!fileObj?.path;
  const legacyUrl = fileObj?.url ?? null; // 예전 'URL 직접 입력' 데이터 호환

  async function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = ""; // 같은 파일 재선택 허용
    if (!file) return;

    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.set("studentId", studentId);
    fd.set("dataTypeKey", dataTypeKey);
    fd.set("file", file);
    const res = await uploadStudentFileAction(fd);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onCommit(res.value); // { path, file_name } → 기존 save 흐름으로 저장
  }

  async function handleOpen() {
    if (!fileObj?.path) return;
    setOpening(true);
    setError(null);
    const res = await getStudentFileSignedUrlAction(fileObj.path);
    setOpening(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    window.open(res.url, "_blank", "noopener,noreferrer");
  }

  async function handleRemove() {
    if (busy) return;
    setBusy(true);
    setError(null);
    if (fileObj?.path) {
      const res = await removeStudentFileAction({
        studentId,
        dataTypeKey,
        path: fileObj.path,
      });
      if (!res.ok) {
        setBusy(false);
        setError(res.error);
        return;
      }
    }
    setBusy(false);
    onCommit(null); // UI 갱신 (+ 값 삭제 재확인, 멱등)
  }

  if (hasUpload || legacyUrl) {
    return (
      <div>
        <div className="flex items-center gap-3 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm">
          <span className="flex-1 truncate" title={fileName ?? legacyUrl ?? ""}>
            📎 {fileName ?? legacyUrl}
          </span>
          {hasUpload ? (
            <button
              type="button"
              onClick={handleOpen}
              disabled={opening}
              className="shrink-0 font-medium text-emerald-700 hover:underline disabled:opacity-50"
            >
              {opening ? "..." : tr(locale, "열기", "Mở")}
            </button>
          ) : legacyUrl ? (
            <a
              href={legacyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 font-medium text-emerald-700 hover:underline"
            >
              {tr(locale, "열기", "Mở")}
            </a>
          ) : null}
          <button
            type="button"
            onClick={handleRemove}
            disabled={busy}
            className="shrink-0 text-rose-600 hover:underline disabled:opacity-50"
          >
            {busy ? "..." : tr(locale, "삭제", "Xóa")}
          </button>
        </div>
        {error ? (
          <p className="mt-1 text-xs text-rose-700">
            {tr(locale, "오류", "Lỗi")}: {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        onChange={handlePick}
        disabled={busy}
        className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-emerald-600 file:px-3 file:py-1.5 file:font-medium file:text-white hover:file:bg-emerald-700 disabled:opacity-50"
      />
      {busy ? (
        <p className="mt-1 text-xs text-slate-400">
          {tr(locale, "업로드 중...", "Đang tải lên...")}
        </p>
      ) : null}
      {error ? (
        <p className="mt-1 text-xs text-rose-700">
          {tr(locale, "오류", "Lỗi")}: {error}
        </p>
      ) : null}
    </div>
  );
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
  locale,
  value,
  options,
  onCommit,
}: {
  locale: Locale;
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
            {locale === "ko" ? o.label_ko : o.label_vi}
          </button>
        );
      })}
    </div>
  );
}
