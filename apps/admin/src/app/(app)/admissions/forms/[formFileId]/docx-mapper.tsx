"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, Loader2, Save, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { saveDocxMappingAction, previewDocxAction } from "./docx-actions";

export type MapChoice = { key: string; label: string; aliases?: string[] };

const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();

export function DocxMapper({
  formFileId,
  fields,
  choices,
  saved,
}: {
  formFileId: string;
  fields: string[];
  choices: MapChoice[];
  saved: Record<string, string>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // 정규화 별칭 → key (자동 추천용)
  const aliasIndex = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of choices) {
      m.set(norm(c.label), c.key);
      for (const a of c.aliases ?? []) m.set(norm(a), c.key);
    }
    return m;
  }, [choices]);

  // 초기 선택: 저장값 우선 → 자동추천 → ""
  const [sel, setSel] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const label of fields) {
      const nl = norm(label);
      if (nl in saved) init[label] = saved[nl];
      else init[label] = aliasIndex.get(nl) ?? "";
    }
    return init;
  });

  const matchedCount = Object.values(sel).filter((v) => v).length;

  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  function buildMapping(): Record<string, string> {
    const mapping: Record<string, string> = {};
    for (const label of fields) mapping[norm(label)] = sel[label] ?? "";
    return mapping;
  }

  async function onPreview() {
    setPreviewBusy(true);
    try {
      const r = await previewDocxAction(formFileId, buildMapping());
      if (r.ok) setPreviewHtml(r.html);
      else toast.error("미리보기 실패", { description: r.error });
    } finally {
      setPreviewBusy(false);
    }
  }

  function onSave() {
    const mapping = buildMapping();
    startTransition(async () => {
      const r = await saveDocxMappingAction(formFileId, mapping);
      if (r.ok) {
        toast.success("매핑을 저장했습니다.");
        router.refresh();
      } else {
        toast.error("저장 실패", { description: r.error });
      }
    });
  }

  function autoFillAll() {
    setSel((prev) => {
      const next = { ...prev };
      for (const label of fields) {
        const nl = norm(label);
        if (!next[label]) next[label] = aliasIndex.get(nl) ?? "";
      }
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">DOCX 채움 매핑</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            감지된 칸 {fields.length}개 · 매핑됨{" "}
            <Badge variant="secondary">{matchedCount}</Badge> · 좌표 지정
            불필요(표가 위치를 정함)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={autoFillAll}>
            <Sparkles className="size-3.5" />
            자동 추천 채우기
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onPreview}
            disabled={previewBusy || fields.length === 0}
          >
            {previewBusy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Eye className="size-3.5" />
            )}
            미리보기
          </Button>
          <Button type="button" size="sm" onClick={onSave} disabled={pending}>
            {pending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Save className="size-3.5" />
            )}
            저장
          </Button>
        </div>
      </div>

      {fields.length === 0 ? (
        <p className="rounded-md border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          감지된 입력 칸이 없습니다. (표 라벨 옆/아래 빈칸이 있어야 감지됨)
        </p>
      ) : (
        <div className="overflow-hidden rounded-md border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <th className="px-3 py-2 font-medium">양식 라벨 (감지)</th>
                <th className="px-3 py-2 font-medium">표준데이터 연결</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((label) => {
                const nl = norm(label);
                const isAuto = !(nl in saved) && !!aliasIndex.get(nl);
                return (
                  <tr key={label} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">
                      <span className="font-medium">{label}</span>
                      {isAuto && sel[label] ? (
                        <Badge
                          variant="outline"
                          className="ml-1.5 border-info/30 text-[10px] text-info"
                        >
                          자동추천
                        </Badge>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={sel[label] ?? ""}
                        onChange={(e) =>
                          setSel((v) => ({ ...v, [label]: e.target.value }))
                        }
                        className="h-8 w-full max-w-md rounded-md border border-input bg-background px-2 text-sm"
                      >
                        <option value="">— 채우지 않음 —</option>
                        {choices.map((c) => (
                          <option key={c.key} value={c.key}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {previewHtml !== null ? (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/50 p-3 sm:p-6"
          onClick={() => setPreviewHtml(null)}
        >
          <div
            className="mx-auto flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <span className="text-sm font-semibold">
                미리보기 (더미 학생값 · 레이아웃 근사)
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPreviewHtml(null)}
              >
                <X className="size-3.5" />
                닫기
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-6">
              <div
                className="docx-preview text-sm"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>
          </div>
        </div>
      ) : null}

      <style>{`
        .docx-preview table { border-collapse: collapse; width: 100%; margin: 0.5rem 0; }
        .docx-preview td, .docx-preview th { border: 1px solid #cbd5e1; padding: 4px 8px; vertical-align: middle; }
        .docx-preview p { margin: 0.25rem 0; }
        .docx-preview img { max-width: 120px; height: auto; }
      `}</style>
    </div>
  );
}
