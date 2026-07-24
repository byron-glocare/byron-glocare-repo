"use client";

import { useActionState, useState } from "react";

import { tr, type Locale } from "@/lib/i18n";

import { createSelfApplicationAction, type ApplyState } from "./apply-actions";

export type OfferingItem = {
  id: string;
  sourceSpecId: string;
  departmentId: number;
  departmentName: string;
  departmentLabelKo: string;
  term: string;
  programType: string | null;
  languages: string[];
  alreadyApplied: boolean;
};

function programTypeLabel(locale: Locale, t: string | null): string | null {
  switch (t) {
    case "language_program":
      return tr(locale, "어학연수 (D-4)", "Khóa tiếng (D-4)");
    case "associate_2yr":
      return tr(locale, "전문학사 2년", "Cao đẳng 2 năm");
    case "bachelor_3yr_extension":
      return tr(locale, "학사 편입 2+2", "Liên thông 2+2");
    case "bachelor_4yr":
      return tr(locale, "학사 4년", "Cử nhân 4 năm");
    default:
      return null;
  }
}

function languageLabel(locale: Locale, lang: string): string {
  switch (lang) {
    case "korean":
      return tr(locale, "한국어", "Tiếng Hàn");
    case "english":
      return tr(locale, "영어", "Tiếng Anh");
    default:
      return tr(locale, "기타", "Khác");
  }
}

export function OfferingList({
  locale,
  universityId,
  items,
}: {
  locale: Locale;
  universityId: number;
  items: OfferingItem[];
}) {
  return (
    <div className="space-y-3">
      {items.map((it) => (
        <OfferingRow
          key={it.id}
          locale={locale}
          universityId={universityId}
          item={it}
        />
      ))}
    </div>
  );
}

function OfferingRow({
  locale,
  universityId,
  item,
}: {
  locale: Locale;
  universityId: number;
  item: OfferingItem;
}) {
  const [state, formAction, pending] = useActionState<ApplyState, FormData>(
    createSelfApplicationAction,
    undefined
  );
  const multiLang = item.languages.length > 1;
  const [lang, setLang] = useState(item.languages[0] ?? "korean");

  const pt = programTypeLabel(locale, item.programType);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">
            {item.departmentName}
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Badge>{item.term}</Badge>
            {pt && <Badge>{pt}</Badge>}
            {item.languages.map((l) => (
              <Badge key={l} tone="slate">
                {languageLabel(locale, l)}
              </Badge>
            ))}
          </div>
        </div>

        {item.alreadyApplied ? (
          <span className="shrink-0 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
            {tr(locale, "지원함", "Đã đăng ký")}
          </span>
        ) : null}
      </div>

      {!item.alreadyApplied && (
        <form action={formAction} className="mt-3">
          <input type="hidden" name="university_id" value={universityId} />
          <input type="hidden" name="offering_id" value={item.id} />
          <input
            type="hidden"
            name="admission_spec_id"
            value={item.sourceSpecId}
          />
          <input
            type="hidden"
            name="target_department_id"
            value={item.departmentId}
          />
          <input
            type="hidden"
            name="target_department_label"
            value={item.departmentLabelKo}
          />

          {multiLang && (
            <div className="mb-2 flex items-center gap-3">
              <span className="text-xs text-slate-500">
                {tr(locale, "지원 언어", "Ngôn ngữ")}
              </span>
              {item.languages.map((l) => (
                <label
                  key={l}
                  className="flex items-center gap-1 text-xs text-slate-700"
                >
                  <input
                    type="radio"
                    name="selected_language"
                    value={l}
                    checked={lang === l}
                    onChange={() => setLang(l)}
                  />
                  {languageLabel(locale, l)}
                </label>
              ))}
            </div>
          )}
          {!multiLang && (
            <input
              type="hidden"
              name="selected_language"
              value={item.languages[0] ?? ""}
            />
          )}

          {state?.error && (
            <p className="mb-2 text-xs text-rose-600">{state.error}</p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {pending
              ? tr(locale, "등록 중…", "Đang đăng ký…")
              : tr(locale, "이 과정으로 지원 시작", "Bắt đầu đăng ký")}
          </button>
        </form>
      )}
    </div>
  );
}

function Badge({
  children,
  tone = "indigo",
}: {
  children: React.ReactNode;
  tone?: "indigo" | "slate";
}) {
  const cls =
    tone === "slate"
      ? "bg-slate-100 text-slate-600"
      : "bg-indigo-50 text-indigo-700";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] ${cls}`}>
      {children}
    </span>
  );
}
