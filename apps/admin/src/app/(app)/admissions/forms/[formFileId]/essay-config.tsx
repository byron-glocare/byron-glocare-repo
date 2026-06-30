"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Save, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { saveEssayConfigAction, type EssaySection } from "./docx-actions";

type BasisChoice = { key: string; label: string };

const newSection = (): EssaySection => ({
  id: crypto.randomUUID(),
  label: "",
  prompt: "",
  basis_keys: [],
});

export function EssayConfig({
  formFileId,
  initialIsEssay,
  initialSections,
  basisChoices,
}: {
  formFileId: string;
  initialIsEssay: boolean;
  initialSections: EssaySection[];
  basisChoices: BasisChoice[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [isEssay, setIsEssay] = useState(initialIsEssay);
  const [sections, setSections] = useState<EssaySection[]>(
    initialSections.length > 0 ? initialSections : [newSection()]
  );

  const labelOf = (k: string) =>
    basisChoices.find((c) => c.key === k)?.label ?? k;

  function patch(id: string, p: Partial<EssaySection>) {
    setSections((arr) => arr.map((s) => (s.id === id ? { ...s, ...p } : s)));
  }
  function addBasis(id: string, key: string) {
    if (!key) return;
    setSections((arr) =>
      arr.map((s) =>
        s.id === id && !s.basis_keys.includes(key)
          ? { ...s, basis_keys: [...s.basis_keys, key] }
          : s
      )
    );
  }
  function removeBasis(id: string, key: string) {
    setSections((arr) =>
      arr.map((s) =>
        s.id === id
          ? { ...s, basis_keys: s.basis_keys.filter((k) => k !== key) }
          : s
      )
    );
  }

  function onSave() {
    const clean = sections
      .map((s) => ({ ...s, label: s.label.trim(), prompt: s.prompt.trim() }))
      .filter((s) => s.label || s.prompt || s.basis_keys.length > 0);
    startTransition(async () => {
      const r = await saveEssayConfigAction(formFileId, {
        is_essay: isEssay,
        sections: clean,
      });
      if (r.ok) {
        toast.success("서술형 설정을 저장했습니다.");
        router.refresh();
      } else toast.error("저장 실패", { description: r.error });
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">서술형 문서 설정</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            자기소개서·학업계획서처럼 AI가 글을 써야 하는 문서. 기반 표준데이터를
            고르면 학생이 입력 → 그 값으로 AI가 초안을 작성합니다.
          </p>
        </div>
        <Button type="button" size="sm" onClick={onSave} disabled={pending}>
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Save className="size-3.5" />
          )}
          저장
        </Button>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isEssay}
          onChange={(e) => setIsEssay(e.target.checked)}
          className="size-4"
        />
        <span className="font-medium">
          이 문서는 <strong>서술형</strong> (자기소개서·학업계획서 등)
        </span>
      </label>

      {isEssay ? (
        <div className="space-y-3">
          {sections.map((s, i) => {
            const available = basisChoices.filter(
              (c) => !s.basis_keys.includes(c.key)
            );
            return (
              <div
                key={s.id}
                className="space-y-2 rounded-md border border-border p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    서술형 문항 #{i + 1}
                  </span>
                  {sections.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setSections((arr) => arr.filter((x) => x.id !== s.id))
                      }
                    >
                      <X className="size-3.5" />
                      삭제
                    </Button>
                  ) : null}
                </div>

                <input
                  value={s.label}
                  onChange={(e) => patch(s.id, { label: e.target.value })}
                  placeholder="문항명 (예: 지원동기, 학업계획)"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                />
                <textarea
                  value={s.prompt}
                  onChange={(e) => patch(s.id, { prompt: e.target.value })}
                  placeholder="작성 지침 (예: 본교 간호학과 지원동기와 학업계획을 600자 내외로 작성)"
                  rows={2}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />

                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    AI 작성 기반 데이터{" "}
                    <span className="text-[10px]">
                      (학생이 입력 → AI가 참고)
                    </span>
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {s.basis_keys.map((k) => (
                      <Badge
                        key={k}
                        variant="secondary"
                        className="gap-1 pr-1"
                      >
                        {labelOf(k)}
                        <button
                          type="button"
                          onClick={() => removeBasis(s.id, k)}
                          className="rounded hover:bg-black/10"
                        >
                          <X className="size-3" />
                        </button>
                      </Badge>
                    ))}
                    <select
                      value=""
                      onChange={(e) => {
                        addBasis(s.id, e.target.value);
                        e.currentTarget.selectedIndex = 0;
                      }}
                      className="h-7 rounded-md border border-input bg-background px-2 text-xs"
                    >
                      <option value="">+ 데이터 추가</option>
                      {available.map((c) => (
                        <option key={c.key} value={c.key}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            );
          })}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSections((arr) => [...arr, newSection()])}
          >
            <Plus className="size-3.5" />
            서술형 문항 추가
          </Button>

          <p className="flex items-start gap-1.5 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <Sparkles className="mt-0.5 size-3.5 shrink-0" />
            저장하면 기반 데이터가 학생 ‘정보 입력’에 필수로 표시됩니다. 답변이
            들어갈 칸은 아래 ‘빈칸 클릭 배치’에서 <strong>[서술형] 문항</strong>에
            연결하세요.
          </p>
        </div>
      ) : null}
    </div>
  );
}
