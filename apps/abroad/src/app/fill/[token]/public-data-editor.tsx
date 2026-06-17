"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import type { Json } from "@/types/database";
import { tr, type Locale } from "@/lib/i18n";
import { MultiSelectWithOther } from "@/components/multi-select-other";
import { savePublicValueAction, savePublicAllAction } from "./actions";

export type PublicFieldMeta = {
  key: string;
  label_ko: string;
  label_vi: string;
  category: string;
  input_type: string;
  options: Array<{ value: string; label_ko: string; label_vi: string }> | null;
  hint_ko: string | null;
  hint_vi: string | null;
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
  "other",
];

function categoryLabel(locale: Locale, c: string): string {
  switch (c) {
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
      return tr(locale, "작문", "Văn viết");
    default:
      return tr(locale, "기타", "Khác");
  }
}

type SaveState = "idle" | "saving" | "saved" | "error";

export function PublicDataEditor({
  token,
  locale,
  studentName,
  expiresAt,
  fields,
  existingValues,
}: {
  token: string;
  locale: Locale;
  studentName: string;
  expiresAt: string;
  fields: PublicFieldMeta[];
  existingValues: Record<string, Json>;
}) {
  const [values, setValues] = useState<Record<string, Json | null>>(
    existingValues as Record<string, Json | null>
  );
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [online, setOnline] = useState(true);
  const [, startTransition] = useTransition();
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const flashSaved = () => {
    setSaveState("saved");
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaveState("idle"), 1500);
  };

  // blur 시 단일 항목 자동저장
  const commit = (key: string, value: Json | null) => {
    setValues((cur) => ({ ...cur, [key]: value }));
    setSaveState("saving");
    startTransition(async () => {
      const res = await savePublicValueAction({
        token,
        dataTypeKey: key,
        value,
      });
      if (!res.ok) setSaveState("error");
      else flashSaved();
    });
  };

  // 임시저장 버튼 — 전체 일괄 저장
  const saveAll = () => {
    setSaveState("saving");
    startTransition(async () => {
      const res = await savePublicAllAction({ token, values });
      if (!res.ok) setSaveState("error");
      else flashSaved();
    });
  };

  const byCategory = new Map<string, PublicFieldMeta[]>();
  for (const f of fields) {
    if (!byCategory.has(f.category)) byCategory.set(f.category, []);
    byCategory.get(f.category)!.push(f);
  }
  const cats = [
    ...CATEGORY_ORDER.filter((c) => byCategory.has(c)),
    ...Array.from(byCategory.keys()).filter((c) => !CATEGORY_ORDER.includes(c)),
  ];

  const expDate = new Date(expiresAt);
  const showOffline = !online || saveState === "error";

  return (
    <main className="mx-auto max-w-2xl px-4 pb-28 pt-6">
      <header className="mb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-900">
            {tr(locale, "정보 입력", "Nhập thông tin")}
          </h1>
          <a
            href={`?lang=${locale === "ko" ? "vi" : "ko"}`}
            className="text-xs text-slate-500 underline"
          >
            {locale === "ko" ? "Tiếng Việt" : "한국어"}
          </a>
        </div>
        <p className="mt-1 text-sm text-slate-600">
          {studentName ? `${studentName} · ` : ""}
          {tr(
            locale,
            "입력하면 자동 저장됩니다. 칸을 벗어날 때마다 저장돼요.",
            "Tự động lưu khi bạn nhập. Mỗi khi rời khỏi ô là đã lưu."
          )}
        </p>
        <p className="mt-0.5 text-xs text-slate-400">
          {tr(locale, "링크 만료", "Hết hạn")}:{" "}
          {expDate.toLocaleDateString(locale === "ko" ? "ko-KR" : "vi-VN")}
        </p>
      </header>

      {/* 오프라인/저장실패 경고 — 사용자 요청 문구 */}
      {showOffline ? (
        <div className="sticky top-2 z-10 mb-4 rounded-md border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800 shadow">
          ⚠{" "}
          {tr(
            locale,
            "자동 저장이 되지 않았습니다. 인터넷 연결을 다시 확인해 주세요.",
            "Chưa lưu được tự động. Vui lòng kiểm tra lại kết nối Internet."
          )}
        </div>
      ) : null}

      <div className="space-y-4">
        {cats.map((cat) => (
          <section
            key={cat}
            className="rounded-lg border border-slate-200 bg-white"
          >
            <header className="border-b border-slate-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">
                {categoryLabel(locale, cat)}
              </h2>
            </header>
            <div className="divide-y divide-slate-100">
              {byCategory.get(cat)!.map((f) => (
                <PublicFieldRow
                  key={f.key}
                  locale={locale}
                  field={f}
                  value={values[f.key] ?? null}
                  onCommit={(v) => commit(f.key, v)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* 하단 고정 저장 바 */}
      <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <span className="text-xs text-slate-500">
            {saveState === "saving"
              ? tr(locale, "저장 중…", "Đang lưu…")
              : saveState === "saved"
                ? tr(locale, "✓ 저장됨", "✓ Đã lưu")
                : saveState === "error"
                  ? tr(locale, "저장 실패", "Lưu thất bại")
                  : tr(locale, "자동 저장 켜짐", "Tự động lưu bật")}
          </span>
          <button
            type="button"
            onClick={saveAll}
            disabled={saveState === "saving"}
            className="rounded-md bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {tr(locale, "임시저장", "Lưu tạm")}
          </button>
        </div>
      </div>
    </main>
  );
}

function PublicFieldRow({
  locale,
  field,
  value,
  onCommit,
}: {
  locale: Locale;
  field: PublicFieldMeta;
  value: Json | null;
  onCommit: (v: Json | null) => void;
}) {
  const label = locale === "ko" ? field.label_ko : field.label_vi;
  const sub = locale === "ko" ? field.label_vi : field.label_ko;
  const hint = locale === "ko" ? field.hint_ko : field.hint_vi;

  return (
    <div className="px-4 py-3">
      <label className="text-sm font-medium text-slate-900">{label}</label>
      <div className="mt-0.5 text-xs text-slate-500">{sub}</div>
      {hint ? <div className="mt-1 text-xs text-slate-600">💡 {hint}</div> : null}
      <div className="mt-2">
        <PublicInput locale={locale} field={field} value={value} onCommit={onCommit} />
      </div>
    </div>
  );
}

function PublicInput({
  locale,
  field,
  value,
  onCommit,
}: {
  locale: Locale;
  field: PublicFieldMeta;
  value: Json | null;
  onCommit: (v: Json | null) => void;
}) {
  const base =
    "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";

  switch (field.input_type) {
    case "long_text":
      return <PublicTextArea value={typeof value === "string" ? value : ""} onCommit={(v) => onCommit(v || null)} base={base} />;
    case "date":
      return (
        <input
          type="date"
          defaultValue={typeof value === "string" ? value : ""}
          onBlur={(e) => onCommit(e.target.value || null)}
          className={base}
        />
      );
    case "number":
      return (
        <input
          type="number"
          step="any"
          defaultValue={typeof value === "number" ? value : ""}
          onBlur={(e) => onCommit(e.target.value === "" ? null : Number(e.target.value))}
          className={base}
        />
      );
    case "select":
      return (
        <select
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onCommit(e.target.value || null)}
          className={base}
        >
          <option value="">{tr(locale, "— 선택 안 함 —", "— chưa chọn —")}</option>
          {(field.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {locale === "ko" ? `${o.label_ko} · ${o.label_vi}` : `${o.label_vi} · ${o.label_ko}`}
            </option>
          ))}
        </select>
      );
    case "multi_select":
      return (
        <MultiSelectWithOther
          locale={locale}
          value={Array.isArray(value) ? (value as string[]) : []}
          options={field.options ?? []}
          onCommit={(arr) => onCommit(arr.length > 0 ? arr : null)}
        />
      );
    case "boolean":
      return (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={value === true} onChange={(e) => onCommit(e.target.checked)} />
          <span>{tr(locale, "예", "Có")}</span>
        </label>
      );
    case "text":
    default:
      return (
        <input
          type="text"
          defaultValue={typeof value === "string" ? value : ""}
          onBlur={(e) => onCommit(e.target.value || null)}
          className={base}
        />
      );
  }
}

function PublicTextArea({
  value,
  onCommit,
  base,
}: {
  value: string;
  onCommit: (v: string) => void;
  base: string;
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
      className={base}
    />
  );
}
