"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  reanalyzeFormAction,
  mergeRequiredKeysAction,
  replaceRequiredKeysAction,
  addSuggestedDataTypeFromUploadAction,
  type ReanalyzeFormResult,
} from "@/app/(app)/universities/[id]/forms/actions";

type Ok = Extract<ReanalyzeFormResult, { ok: true }>;
/** new = 신규만 추가(합집합) / scratch = 처음부터 다시(교체) */
type Mode = "new" | "scratch";

/**
 * [작성서류 상세] 이미 등록된 양식에 AI 표준데이터 맵핑을 다시 돌리는 카드.
 *   업로드 시 auto_analyze 와 같은 분석을, 파일 교체 없이 원본에 재실행.
 *   결과(필요 표준데이터 후보 + 누락 카탈로그)를 검토 후 '필수'에 반영.
 */
export function ReanalyzeData({ formFileId }: { formFileId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<Ok | null>(null);
  const [mode, setMode] = useState<Mode>("new");
  // 후보 키별 체크 상태 (이미 반영된 키는 기본 해제)
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [applying, startApply] = useTransition();

  // 모드별 기본 체크: 신규만=새 항목만 / 처음부터=전부 체크
  function defaultChecks(r: Ok, m: Mode): Record<string, boolean> {
    const init: Record<string, boolean> = {};
    for (const s of r.suggestedKeys) init[s.key] = m === "scratch" ? true : !s.already;
    return init;
  }

  function run() {
    setResult(null);
    startTransition(async () => {
      const r = await reanalyzeFormAction(formFileId);
      if (!r.ok) {
        toast.error("AI 분석 실패", { description: r.error });
        return;
      }
      setResult(r);
      setChecks(defaultChecks(r, mode));
      if (r.suggestedKeys.length === 0 && r.missingDataTypes.length === 0) {
        toast.info("추가로 제안된 표준데이터가 없습니다.");
      }
    });
  }

  function changeMode(m: Mode) {
    setMode(m);
    if (result) setChecks(defaultChecks(result, m));
  }

  // 신규만 모드에서는 이미 반영된 항목은 목록에서 숨김(+ 상태만 검증).
  const visibleKeys = result
    ? mode === "new"
      ? result.suggestedKeys.filter((s) => !s.already)
      : result.suggestedKeys
    : [];
  const selected = visibleKeys.filter((s) => checks[s.key]).map((s) => s.key);

  function apply() {
    if (mode === "new" && selected.length === 0) return;
    startApply(async () => {
      const r =
        mode === "scratch"
          ? await replaceRequiredKeysAction(formFileId, selected)
          : await mergeRequiredKeysAction(formFileId, selected);
      if (!r.ok) {
        toast.error("반영 실패", { description: r.error });
        return;
      }
      toast.success(
        mode === "scratch"
          ? `필수 목록을 ${selected.length}개로 새로 설정했습니다.`
          : `${selected.length}개 항목을 '필수'로 추가했습니다.`
      );
      setResult(null);
      router.refresh();
    });
  }

  function addMissing(idx: number) {
    if (!result) return;
    const m = result.missingDataTypes[idx];
    startApply(async () => {
      const r = await addSuggestedDataTypeFromUploadAction(m);
      if (!r.ok) {
        toast.error("카탈로그 추가 실패", { description: r.error });
        return;
      }
      toast.success(`카탈로그에 추가: ${m.label_ko}`);
      setAdded((s) => new Set(s).add(m.key));
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">AI 표준데이터 재분석</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            이미 등록된 이 양식을 AI가 다시 읽어, 필요한 표준데이터 항목을
            제안합니다. 파일은 교체되지 않습니다. (약 30~60초)
          </p>
        </div>
        <Button type="button" onClick={run} disabled={pending} className="shrink-0">
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          {pending ? "분석 중…" : "AI 재분석"}
        </Button>
      </div>

      {result ? (
        <div className="space-y-4 rounded-md border border-input p-4">
          {result.notes ? (
            <p className="text-xs text-muted-foreground">{result.notes}</p>
          ) : null}

          {/* 반영 방식 선택 */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              반영 방식
            </span>
            <div className="inline-flex overflow-hidden rounded-md border border-input">
              <button
                type="button"
                onClick={() => changeMode("new")}
                className={`px-3 py-1.5 text-xs font-medium ${
                  mode === "new"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background hover:bg-muted"
                }`}
              >
                신규만 추가
              </button>
              <button
                type="button"
                onClick={() => changeMode("scratch")}
                className={`border-l border-input px-3 py-1.5 text-xs font-medium ${
                  mode === "scratch"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background hover:bg-muted"
                }`}
              >
                처음부터 다시
              </button>
            </div>
            <span className="text-[11px] text-muted-foreground">
              {mode === "new"
                ? "기존 필수는 그대로 두고, 아직 없는 항목만 추가합니다."
                : "선택한 항목으로 필수 목록을 새로 만듭니다(기존 필수 중 체크 안 한 항목은 제외 — 사람이 넣은 것도 지워질 수 있음)."}
            </span>
          </div>

          {/* 필요 표준데이터 후보 */}
          {visibleKeys.length > 0 ? (
            <div>
              <div className="mb-2 text-xs font-medium text-muted-foreground">
                {mode === "new"
                  ? "신규 후보 — 체크한 항목을 정보입력 '필수'에 추가"
                  : "필요 표준데이터 — 체크한 항목만 '필수'로 남깁니다"}
              </div>
              <ul className="space-y-1.5">
                {visibleKeys.map((s) => (
                  <li
                    key={s.key}
                    className="flex items-center gap-3 rounded-md border border-border px-3 py-2"
                  >
                    <Checkbox
                      checked={checks[s.key] ?? false}
                      onCheckedChange={(v) =>
                        setChecks((c) => ({ ...c, [s.key]: v === true }))
                      }
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium">{s.label_ko}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {s.key}
                      </span>
                    </div>
                    {s.already ? (
                      <Badge variant="outline" className="text-[10px]">
                        이미 반영됨
                      </Badge>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {mode === "new"
                ? "새로 추가할 후보가 없습니다. (AI 제안 항목이 모두 이미 반영돼 있음)"
                : "카탈로그에서 매칭된 필요 표준데이터가 없습니다."}
            </p>
          )}

          {/* 카탈로그 누락 항목 */}
          {result.missingDataTypes.length > 0 ? (
            <div className="rounded-md border border-warning/30 bg-warning/5 p-3">
              <div className="mb-2 text-xs font-medium">
                🆕 AI가 발견한 카탈로그 누락 항목 ({result.missingDataTypes.length}
                개)
              </div>
              <p className="mb-2 text-[11px] text-muted-foreground">
                양식이 요구하는데 표준 카탈로그에 없는 항목. &quot;카탈로그에
                추가&quot; 후 다시 재분석하면 위 후보에 잡힙니다.
              </p>
              <ul className="space-y-1.5">
                {result.missingDataTypes.map((m, i) => {
                  const done = added.has(m.key);
                  return (
                    <li
                      key={m.key}
                      className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2"
                    >
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium">{m.label_ko}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {m.key} · {m.category}
                        </span>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant={done ? "outline" : "default"}
                        disabled={applying || done}
                        onClick={() => addMissing(i)}
                      >
                        {done ? (
                          <>
                            <Check className="size-4" />
                            추가됨
                          </>
                        ) : (
                          <>
                            <Plus className="size-4" />
                            카탈로그에 추가
                          </>
                        )}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          {result.essayQuestionCount > 0 ? (
            <p className="text-xs text-muted-foreground">
              ✍️ 서술형 문항 {result.essayQuestionCount}개 감지 — 아래 “서술형 문서
              설정”의 AI 분석에서 문항을 반영하세요.
            </p>
          ) : null}

          <div className="flex justify-end gap-2 border-t pt-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setResult(null)}
              disabled={applying}
            >
              닫기
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={apply}
              disabled={applying || selected.length === 0}
            >
              {applying ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              {mode === "scratch"
                ? `필수 ${selected.length}개로 설정`
                : `${selected.length}개 추가`}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
