"use client";

import { useState, useTransition } from "react";

import { tr, type Locale } from "@/lib/i18n";

import { generateEssayAction, saveEssayEditAction } from "./actions";
import type { EssaySection } from "@/types/study";

export type FormWithQuestions = {
  form_file_id: string;
  name_ko: string;
  department_name: string | null;
  university_id: number;
  university_name_ko: string;
  essay_sections: EssaySection[];
  application_labels: string[];
};

export type DraftSnapshot = {
  id: string;
  form_file_id: string;
  question_index: number;
  generated_text: string | null;
  edited_text: string | null;
  generated_at: string | null;
  edited_at: string | null;
};

export function EssaysClient({
  locale,
  studentId,
  forms,
  drafts: initialDrafts,
}: {
  locale: Locale;
  studentId: string;
  forms: FormWithQuestions[];
  drafts: DraftSnapshot[];
}) {
  // (form_file_id + question_index) → draft
  const initialMap = new Map<string, DraftSnapshot>();
  for (const d of initialDrafts) {
    initialMap.set(`${d.form_file_id}::${d.question_index}`, d);
  }
  const [draftMap, setDraftMap] = useState<Map<string, DraftSnapshot>>(initialMap);

  return (
    <div className="space-y-6">
      {forms.map((form) => (
        <section
          key={form.form_file_id}
          className="rounded-lg border border-slate-200 bg-white"
        >
          <header className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-base font-semibold text-slate-900">
              {form.name_ko}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {form.university_name_ko}
              {form.department_name ? ` · ${form.department_name}` : ""}
              {" · "}
              {form.application_labels.join(" · ")}
            </p>
          </header>
          <div className="divide-y divide-slate-100">
            {form.essay_sections.map((s, idx) => {
              const key = `${form.form_file_id}::${idx}`;
              const draft = draftMap.get(key);
              return (
                <QuestionRow
                  key={idx}
                  locale={locale}
                  studentId={studentId}
                  formFileId={form.form_file_id}
                  questionIndex={idx}
                  section={s}
                  draft={draft}
                  onUpdate={(d) =>
                    setDraftMap((cur) => {
                      const next = new Map(cur);
                      next.set(key, d);
                      return next;
                    })
                  }
                />
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function QuestionRow({
  locale,
  studentId,
  formFileId,
  questionIndex,
  section,
  draft,
  onUpdate,
}: {
  locale: Locale;
  studentId: string;
  formFileId: string;
  questionIndex: number;
  section: EssaySection;
  draft: DraftSnapshot | undefined;
  onUpdate: (d: DraftSnapshot) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editedText, setEditedText] = useState<string>(
    draft?.edited_text ?? draft?.generated_text ?? ""
  );
  const [saved, setSaved] = useState(false);

  const onGenerate = () => {
    setError(null);
    startTransition(async () => {
      const res = await generateEssayAction({
        studentId,
        formFileId,
        questionIndex,
      });
      if (!res.ok) {
        setError(res.error);
      } else {
        setEditedText(res.generated_text);
        // 임시 draft (실제 row 는 서버에서 upsert 됨. 페이지 revalidate 후 정확한 id 반영)
        onUpdate({
          id: draft?.id ?? "",
          form_file_id: formFileId,
          question_index: questionIndex,
          generated_text: res.generated_text,
          edited_text: null,
          generated_at: new Date().toISOString(),
          edited_at: null,
        });
      }
    });
  };

  const onSaveEdit = () => {
    if (!draft?.id) {
      setError(
        tr(locale, "먼저 AI 생성을 실행해야 합니다", "Vui lòng tạo bài bằng AI trước")
      );
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await saveEssayEditAction({
        draftId: draft.id,
        studentId,
        editedText,
      });
      if (!res.ok) {
        setError(res.error);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
        onUpdate({
          ...draft,
          edited_text: editedText,
          edited_at: new Date().toISOString(),
        });
      }
    });
  };

  return (
    <div className="px-4 py-4">
      <div className="mb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="text-sm font-medium text-slate-900">
              {section.label || tr(locale, "서술형 답변", "Bài luận")}
            </div>
            {section.prompt ? (
              <div className="mt-0.5 text-xs text-slate-500">
                {section.prompt}
              </div>
            ) : null}
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
              {section.basis_keys.length > 0 ? (
                <span>
                  {tr(
                    locale,
                    `AI 참조 데이터: ${section.basis_keys.length}개 (정보 입력에서 채움)`,
                    `Dữ liệu AI tham chiếu: ${section.basis_keys.length} mục`
                  )}
                </span>
              ) : (
                <span className="text-amber-600">
                  {tr(
                    locale,
                    "⚠ 기반 데이터 미지정 — 글로케어 설정 필요",
                    "⚠ Chưa chỉ định dữ liệu cơ sở"
                  )}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onGenerate}
            disabled={pending}
            className="shrink-0 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {pending && !draft?.generated_text
              ? tr(locale, "생성 중...", "Đang tạo...")
              : draft?.generated_text
                ? tr(locale, "다시 생성", "Tạo lại")
                : tr(locale, "AI 작성", "AI tạo bài")}
          </button>
        </div>
      </div>

      {draft?.generated_text ? (
        <div className="mt-2 space-y-2">
          <details className="text-xs">
            <summary className="cursor-pointer text-slate-500 hover:text-slate-700">
              {tr(locale, "AI 원본", "Bản gốc AI")} (
              {draft.generated_at
                ? new Date(draft.generated_at).toLocaleString(
                    locale === "ko" ? "ko-KR" : "vi-VN"
                  )
                : "—"}
              )
            </summary>
            <div className="mt-1 whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm text-slate-700">
              {draft.generated_text}
            </div>
          </details>

          <div>
            <label className="text-xs font-medium text-slate-700">
              {tr(locale, "수정본 (제출에 사용)", "Bản hiệu đính (sẽ dùng để nộp)")}
            </label>
            <textarea
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              rows={8}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder={tr(locale, "내용 수정...", "Chỉnh sửa nội dung...")}
            />
            <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
              <span>{tr(locale, `${editedText.length}자`, `${editedText.length} ký tự`)}</span>
              <div className="flex items-center gap-2">
                {saved ? (
                  <span className="text-emerald-600">
                    {tr(locale, "✓ 저장됨", "✓ đã lưu")}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={onSaveEdit}
                  disabled={pending || editedText === (draft.edited_text ?? draft.generated_text)}
                  className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-50"
                >
                  {tr(locale, "수정본 저장", "Lưu hiệu đính")}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-xs text-slate-400">
          {tr(
            locale,
            '"AI 작성"을 눌러 상세 정보 기반 초안을 생성하세요.',
            'Nhấn "AI tạo bài" để sinh bản nháp dựa trên thông tin chi tiết.'
          )}
        </p>
      )}

      {error ? (
        <div className="mt-2 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </div>
      ) : null}
    </div>
  );
}
