"use client";

import { useActionState, useState, useTransition } from "react";
import { Check, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  saveEssayQuestionsAction,
  analyzeFormAction,
  addSuggestedDataTypeAction,
  type SaveEssayQuestionsState,
} from "./actions";
import type {
  SuggestedMissingDataType,
  EssaySubQuestion,
} from "@/lib/admission/call-analyze-form";

export type EssayQuestionDraft = {
  question_ko: string;
  question_vi?: string;
  max_chars?: number;
  basis_data_type_keys: string[];
  sub_questions: EssaySubQuestion[];
};

export type EssayBasisType = {
  key: string;
  label_ko: string;
  label_vi: string;
  hint_ko: string | null;
};

const emptyQuestion = (): EssayQuestionDraft => ({
  question_ko: "",
  basis_data_type_keys: [],
  sub_questions: [],
});

const emptySub = (): EssaySubQuestion => ({
  question_ko: "",
  question_vi: "",
});

export function EssayQuestionsEditor({
  formFileId,
  universityId,
  initialQuestions,
  essayBasisTypes,
}: {
  formFileId: string;
  universityId: number;
  initialQuestions: EssayQuestionDraft[];
  essayBasisTypes: EssayBasisType[];
}) {
  const bound = saveEssayQuestionsAction.bind(null, formFileId, universityId);
  const [state, action, pending] = useActionState<
    SaveEssayQuestionsState,
    FormData
  >(bound, undefined);

  const [questions, setQuestions] = useState<EssayQuestionDraft[]>(
    initialQuestions.length > 0
      ? initialQuestions.map((q) => ({
          ...q,
          // 이전 데이터엔 sub_questions 없을 수 있음 — 빈 배열 보장
          sub_questions: q.sub_questions ?? [],
        }))
      : []
  );
  const [analyzing, startAnalyzing] = useTransition();
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [analyzeNotes, setAnalyzeNotes] = useState<string | null>(null);
  const [suggestedDataKeys, setSuggestedDataKeys] = useState<string[]>([]);
  const [missingDataTypes, setMissingDataTypes] = useState<SuggestedMissingDataType[]>([]);
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const [addedKeys, setAddedKeys] = useState<Set<string>>(new Set());

  const onAnalyze = () => {
    setAnalyzeError(null);
    setAnalyzeNotes(null);
    setMissingDataTypes([]);
    setAddedKeys(new Set());
    startAnalyzing(async () => {
      const res = await analyzeFormAction(formFileId);
      if (!res.ok) {
        setAnalyzeError(res.error);
        return;
      }
      if (res.essay_questions.length > 0) {
        const merged = [...questions];
        for (const q of res.essay_questions) {
          if (!merged.some((m) => m.question_ko === q.question_ko)) {
            merged.push({
              question_ko: q.question_ko,
              max_chars: q.max_chars,
              basis_data_type_keys: q.basis_data_type_keys,
              sub_questions: q.sub_questions ?? [],
            });
          }
        }
        setQuestions(merged);
      }
      setSuggestedDataKeys(res.suggested_required_data_keys);
      setMissingDataTypes(res.missing_data_types ?? []);
      const missingCount = res.missing_data_types?.length ?? 0;
      setAnalyzeNotes(
        res.essay_questions.length === 0 &&
          res.suggested_required_data_keys.length === 0 &&
          missingCount === 0
          ? "AI 분석 결과: 추출된 항목 없음. 양식이 단순 동의서·체크리스트일 수 있습니다."
          : res.analysis_notes ||
              `AI 가 ${res.essay_questions.length}개 질문 + ${res.suggested_required_data_keys.length}개 필요 데이터 키를 추출. 신규 카탈로그 제안 ${missingCount}개.`
      );
    });
  };

  const onAddSuggestion = async (s: SuggestedMissingDataType) => {
    setAddingKey(s.key);
    try {
      const res = await addSuggestedDataTypeAction(s);
      if (res.ok) {
        setAddedKeys((cur) => new Set(cur).add(s.key));
      } else {
        setAnalyzeError(`"${s.key}" 추가 실패: ${res.error}`);
      }
    } finally {
      setAddingKey(null);
    }
  };

  const addQ = () => setQuestions([...questions, emptyQuestion()]);
  const removeQ = (idx: number) =>
    setQuestions(questions.filter((_, i) => i !== idx));
  const updateQ = <K extends keyof EssayQuestionDraft>(
    idx: number,
    field: K,
    value: EssayQuestionDraft[K]
  ) =>
    setQuestions(
      questions.map((q, i) => (i === idx ? { ...q, [field]: value } : q))
    );
  // sub_questions helpers
  const addSub = (qIdx: number) => {
    setQuestions(
      questions.map((q, i) =>
        i === qIdx
          ? { ...q, sub_questions: [...(q.sub_questions ?? []), emptySub()] }
          : q
      )
    );
  };
  const removeSub = (qIdx: number, sIdx: number) => {
    setQuestions(
      questions.map((q, i) =>
        i === qIdx
          ? {
              ...q,
              sub_questions: q.sub_questions.filter((_, j) => j !== sIdx),
            }
          : q
      )
    );
  };
  const updateSub = <K extends keyof EssaySubQuestion>(
    qIdx: number,
    sIdx: number,
    field: K,
    value: EssaySubQuestion[K]
  ) => {
    setQuestions(
      questions.map((q, i) =>
        i === qIdx
          ? {
              ...q,
              sub_questions: q.sub_questions.map((s, j) =>
                j === sIdx ? { ...s, [field]: value } : s
              ),
            }
          : q
      )
    );
  };

  const toggleBasis = (idx: number, key: string) => {
    setQuestions(
      questions.map((q, i) => {
        if (i !== idx) return q;
        const has = q.basis_data_type_keys.includes(key);
        return {
          ...q,
          basis_data_type_keys: has
            ? q.basis_data_type_keys.filter((k) => k !== key)
            : [...q.basis_data_type_keys, key],
        };
      })
    );
  };

  return (
    <Card className="p-6 space-y-4">
      {/* AI 분석 영역 */}
      <div className="rounded-md border border-dashed border-amber-300 bg-amber-50 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-amber-900">
              <Sparkles className="inline size-4" /> AI 자동 분석
            </div>
            <p className="mt-0.5 text-xs text-amber-800">
              양식 파일을 Claude 가 읽어 서술형 질문 + 필요 데이터 키를 자동 추출.
              결과는 아래 폼에 추가되며 운영자가 검수 후 저장.
            </p>
          </div>
          <Button
            type="button"
            onClick={onAnalyze}
            disabled={analyzing}
            variant="outline"
          >
            {analyzing ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                분석 중... (~30초)
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                AI 분석 시작
              </>
            )}
          </Button>
        </div>
        {analyzeError ? (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {analyzeError}
          </div>
        ) : null}
        {analyzeNotes ? (
          <div className="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            ✓ {analyzeNotes}
          </div>
        ) : null}
        {suggestedDataKeys.length > 0 ? (
          <div className="rounded-md border border-emerald-200 bg-white p-2">
            <div className="text-xs font-medium text-slate-700">
              AI 가 제안하는 필요 데이터 키 ({suggestedDataKeys.length}개) — 카탈로그 매칭
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {suggestedDataKeys.map((k) => (
                <code
                  key={k}
                  className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px]"
                >
                  {k}
                </code>
              ))}
            </div>
          </div>
        ) : null}

        {/* ★ AI 가 제안하는 신규 카탈로그 항목 — 1클릭 추가 */}
        {missingDataTypes.length > 0 ? (
          <div className="rounded-md border border-violet-300 bg-violet-50 p-3">
            <div className="text-sm font-semibold text-violet-900">
              🆕 AI 가 발견한 카탈로그 누락 항목 ({missingDataTypes.length}개)
            </div>
            <p className="mt-1 text-xs text-violet-800">
              양식이 요구하는데 표준 카탈로그에 없는 항목. 검토 후 "카탈로그에 추가" 누르면
              즉시 표준 데이터로 등록됩니다.
            </p>
            <div className="mt-2 space-y-2">
              {missingDataTypes.map((m) => {
                const added = addedKeys.has(m.key);
                const adding = addingKey === m.key;
                return (
                  <div
                    key={m.key}
                    className={`rounded-md border bg-white p-2 ${
                      added ? "border-emerald-300 opacity-60" : "border-violet-200"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="text-sm font-medium">
                          {m.label_ko}{" "}
                          <span className="text-xs font-normal text-slate-500">
                            · {m.label_vi}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-500">
                          <code className="rounded bg-slate-100 px-1 py-0.5">
                            {m.key}
                          </code>
                          <span className="rounded border border-slate-300 px-1 py-0.5">
                            {m.category}
                          </span>
                          <span className="rounded border border-slate-300 px-1 py-0.5">
                            {m.input_type}
                          </span>
                        </div>
                        {m.hint_ko ? (
                          <div className="mt-1 text-xs text-slate-600">
                            💡 {m.hint_ko}
                          </div>
                        ) : null}
                        {m.reason ? (
                          <div className="mt-0.5 text-[10px] text-slate-500">
                            이유: {m.reason}
                          </div>
                        ) : null}
                      </div>
                      <Button
                        type="button"
                        variant={added ? "outline" : "default"}
                        size="sm"
                        disabled={added || adding}
                        onClick={() => onAddSuggestion(m)}
                      >
                        {added
                          ? "✓ 추가됨"
                          : adding
                            ? "추가 중..."
                            : "카탈로그에 추가"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
            {addedKeys.size > 0 ? (
              <p className="mt-2 text-xs text-emerald-700">
                ✓ {addedKeys.size}개 추가됨. 다음 양식 분석부터 자동 매칭됩니다.
                필요시{" "}
                <a
                  href="/student-data-types"
                  target="_blank"
                  className="underline"
                >
                  표준 데이터 카탈로그
                </a>
                에서 세부 정보 편집 가능.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <form
        action={(fd) => {
          fd.set("questions", JSON.stringify(questions));
          action(fd);
        }}
        className="space-y-4"
      >
        {essayBasisTypes.length === 0 ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            ⚠ 등록된 서술형 기초 데이터가 없습니다.{" "}
            <a
              href="/student-data-types"
              className="font-medium underline"
            >
              표준 데이터 카탈로그
            </a>{" "}
            에서 <code className="rounded bg-amber-100 px-1">is_essay_basis = true</code>{" "}
            항목을 먼저 추가하세요.
          </div>
        ) : null}

        <div className="space-y-3">
          {questions.length === 0 ? (
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              등록된 서술형 질문이 없습니다. 양식의 각 서술형 문항을 추가하세요.
            </div>
          ) : (
            questions.map((q, idx) => (
              <Card key={idx} className="p-4 space-y-3 bg-muted/20">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">질문 #{idx + 1}</Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeQ(idx)}
                    className="text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium">
                      질문 (한국어){" "}
                      <span className="text-destructive">*</span>
                    </span>
                    <textarea
                      value={q.question_ko}
                      onChange={(e) =>
                        updateQ(idx, "question_ko", e.target.value)
                      }
                      rows={2}
                      required
                      placeholder="예: 한국 유학을 결심한 계기와 본교 ○○학과를 지원한 이유를 서술하시오."
                      className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium">
                      질문 (베트남어, 선택)
                    </span>
                    <textarea
                      value={q.question_vi ?? ""}
                      onChange={(e) =>
                        updateQ(idx, "question_vi", e.target.value || undefined)
                      }
                      rows={2}
                      placeholder="유학센터 담당자 참고용. 비워두면 한국어만 사용."
                      className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium">
                      최대 글자수 (선택)
                    </span>
                    <input
                      type="number"
                      min="50"
                      max="10000"
                      value={q.max_chars ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        updateQ(
                          idx,
                          "max_chars",
                          v === "" ? undefined : Number(v)
                        );
                      }}
                      placeholder="예: 500"
                      className="w-32 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </label>

                  {/* ★ 학생에게 친근하게 묻는 sub-question — 양식별 맞춤 */}
                  <div className="rounded-md border-2 border-amber-300 bg-amber-50/50 p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-amber-900">
                          🎯 학생에게 묻는 세부 질문 ({q.sub_questions.length}개)
                        </div>
                        <p className="mt-0.5 text-xs text-amber-800">
                          위 양식 원 질문(격식)에 답하기 위해, 학생이 친근하게
                          답할 수 있는 sub-question 들. 학생 essays 페이지에서
                          이 질문이 노출되고, 학생 답변을 AI 가 양식 원 질문의
                          격식 답변으로 조합합니다.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addSub(idx)}
                      >
                        <Plus className="size-3" />
                        세부 질문 추가
                      </Button>
                    </div>

                    {q.sub_questions.length === 0 ? (
                      <p className="mt-3 rounded-md border border-dashed bg-white p-3 text-center text-xs text-muted-foreground">
                        세부 질문이 없습니다. "AI 분석 시작" 으로 자동 생성하거나
                        수동으로 추가하세요.
                      </p>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {q.sub_questions.map((s, sIdx) => (
                          <div
                            key={sIdx}
                            className="rounded-md border bg-white p-3"
                          >
                            <div className="mb-2 flex items-center justify-between">
                              <span className="text-xs font-medium text-amber-900">
                                세부 #{sIdx + 1}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeSub(idx, sIdx)}
                                className="text-destructive hover:opacity-70"
                              >
                                <Trash2 className="size-3" />
                              </button>
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                              <label className="flex flex-col gap-1">
                                <span className="text-[10px] font-medium text-muted-foreground">
                                  질문 (한국어) — 참고용 *
                                </span>
                                <input
                                  type="text"
                                  value={s.question_ko}
                                  onChange={(e) =>
                                    updateSub(
                                      idx,
                                      sIdx,
                                      "question_ko",
                                      e.target.value
                                    )
                                  }
                                  required
                                  placeholder="예: 본인의 취미나 특기를 간단히 알려주세요"
                                  className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                                />
                              </label>
                              <label className="flex flex-col gap-1">
                                <span className="text-[10px] font-medium text-muted-foreground">
                                  질문 (베트남어) — 학생이 실제 보는 텍스트 *
                                </span>
                                <input
                                  type="text"
                                  value={s.question_vi}
                                  onChange={(e) =>
                                    updateSub(
                                      idx,
                                      sIdx,
                                      "question_vi",
                                      e.target.value
                                    )
                                  }
                                  required
                                  placeholder="예: Sở thích hoặc sở trường của bạn?"
                                  className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                                />
                              </label>
                              <label className="flex flex-col gap-1">
                                <span className="text-[10px] font-medium text-muted-foreground">
                                  답변 가이드 (베트남어, 선택)
                                </span>
                                <input
                                  type="text"
                                  value={s.hint_vi ?? ""}
                                  onChange={(e) =>
                                    updateSub(
                                      idx,
                                      sIdx,
                                      "hint_vi",
                                      e.target.value || undefined
                                    )
                                  }
                                  placeholder="예: Không cần liên quan đến đại học"
                                  className="rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                                />
                              </label>
                              <label className="flex flex-col gap-1">
                                <span className="text-[10px] font-medium text-muted-foreground">
                                  답변 저장 위치 (카탈로그 키, 선택) — 재사용성
                                </span>
                                <select
                                  value={s.data_type_key ?? ""}
                                  onChange={(e) =>
                                    updateSub(
                                      idx,
                                      sIdx,
                                      "data_type_key",
                                      e.target.value || undefined
                                    )
                                  }
                                  className="rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                                >
                                  <option value="">
                                    — 양식 전용 (재사용 X)
                                  </option>
                                  {essayBasisTypes.map((bt) => (
                                    <option key={bt.key} value={bt.key}>
                                      {bt.label_ko} ({bt.key})
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* AI 작문 참조 기초 데이터 (보조 — sub_questions 의 data_type_key 와 합쳐서 사용) */}
                  <div>
                    <div className="text-sm font-medium">
                      AI 작문 참조 기초 데이터{" "}
                      <span className="text-xs font-normal text-muted-foreground">
                        ({q.basis_data_type_keys.length}개 · 보조)
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      위 세부 질문이 직접 매핑하는 키 외에 추가로 참조할 학생
                      기초 데이터. 같은 학생이 다른 양식 답변할 때 입력한 데이터.
                    </p>
                    {essayBasisTypes.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {essayBasisTypes.map((bt) => {
                          const checked = q.basis_data_type_keys.includes(
                            bt.key
                          );
                          return (
                            <label
                              key={bt.key}
                              className={`flex cursor-pointer items-start gap-1.5 rounded-md border px-2 py-1.5 text-xs ${
                                checked
                                  ? "border-primary bg-primary/10"
                                  : "border-input hover:bg-muted/50"
                              }`}
                              title={bt.hint_ko ?? undefined}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleBasis(idx, bt.key)}
                                className="mt-0.5 size-3"
                              />
                              <span>{bt.label_ko}</span>
                            </label>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        <Button type="button" variant="outline" size="sm" onClick={addQ}>
          <Plus className="size-4" />
          질문 추가
        </Button>

        {state?.error ? (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.error}
          </div>
        ) : state?.ok ? (
          <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            ✓ 저장되었습니다.
          </div>
        ) : null}

        <div className="flex items-center gap-2 border-t pt-4">
          <Button type="submit" disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                저장 중...
              </>
            ) : (
              <>
                <Check className="size-4" />
                저장
              </>
            )}
          </Button>
          <a
            href={`/universities/${universityId}/forms`}
            className={buttonVariants({ variant: "outline" })}
          >
            양식 목록으로
          </a>
        </div>
      </form>
    </Card>
  );
}
