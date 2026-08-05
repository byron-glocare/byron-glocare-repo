"use client";

import { useActionState, useState } from "react";

import { tr, type Locale } from "@/lib/i18n";

import { createSelfApplicationAction, type ApplyState } from "./apply-actions";

export type OfferingItem = {
  /** react key (offering=offering.id, spec경로=spec::학과) */
  id: string;
  /** 협약(offering) 경로만. 자유 지원(spec 직접)이면 null. */
  offeringId: string | null;
  sourceSpecId: string;
  /** offering 경로만 실제 학과 FK. spec 경로는 null(라벨만). */
  departmentId: number | null;
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
    <div className="gc-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-ink">
            {item.departmentName}
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Badge>{item.term}</Badge>
            {pt && <Badge>{pt}</Badge>}
            {item.languages.map((l) => (
              <Badge key={l}>
                {languageLabel(locale, l)}
              </Badge>
            ))}
          </div>
        </div>

        {item.alreadyApplied ? (
          <span className="shrink-0 gc-badge gc-badge-tonal">
            {tr(locale, "지원함", "Đã đăng ký")}
          </span>
        ) : null}
      </div>

      {!item.alreadyApplied && (
        <form action={formAction} className="mt-3">
          <input type="hidden" name="university_id" value={universityId} />
          {item.offeringId ? (
            <input type="hidden" name="offering_id" value={item.offeringId} />
          ) : null}
          <input
            type="hidden"
            name="admission_spec_id"
            value={item.sourceSpecId}
          />
          {item.departmentId != null ? (
            <input
              type="hidden"
              name="target_department_id"
              value={item.departmentId}
            />
          ) : null}
          <input
            type="hidden"
            name="target_department_label"
            value={item.departmentLabelKo}
          />

          {multiLang && (
            <div className="mb-2 flex items-center gap-3">
              <span className="text-xs text-ink-light">
                {tr(locale, "지원 언어", "Ngôn ngữ")}
              </span>
              {item.languages.map((l) => (
                <label
                  key={l}
                  className="flex items-center gap-1 text-xs text-ink-mid"
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
            <p className="mb-2 text-xs text-destructive">{state.error}</p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="gc-btn gc-btn-primary gc-btn-md"
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

/** 속성 나열 배지 — 모든 카드에 공통으로 붙는 정보라 회색 하나로 통일. */
function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="gc-badge gc-badge-neutral">
      {children}
    </span>
  );
}
