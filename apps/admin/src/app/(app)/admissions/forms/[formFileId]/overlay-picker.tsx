"use client";

/**
 * [작성서류] PDF 좌표 오버레이 지정기.
 *   원본 양식 PDF 를 pdfjs 로 캔버스에 렌더 → 운영자가 항목을 고르고 클릭해 위치를 찍는다.
 *   화면 좌표(px) → PDF 좌표(pt, 좌하단 원점) 변환해 저장.
 *   채움 엔진(abroad /final/pdf)이 이 좌표에 학생 데이터를 그려 넣는다.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Save, Trash2, Crosshair } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { saveFieldOverlaysAction } from "@/app/(app)/universities/[id]/forms/actions";

export type FieldChoice = { key: string; label: string };
export type Overlay = {
  key: string;
  page: number; // 0-based
  x: number; // PDF pt
  y: number; // PDF pt (baseline, 좌하단 원점)
  size?: number;
  maxWidth?: number;
};

const DEFAULT_SIZE = 11;

export function OverlayPicker({
  formFileId,
  fileUrl,
  choices,
  initialOverlays,
}: {
  formFileId: string;
  fileUrl: string;
  choices: FieldChoice[];
  initialOverlays: Overlay[];
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfRef = useRef<any>(null);

  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(1);
  const [pageNum, setPageNum] = useState(1); // 1-based (pdfjs)
  const [scale, setScale] = useState(1);
  const [canvasH, setCanvasH] = useState(0);

  const [overlays, setOverlays] = useState<Overlay[]>(initialOverlays);
  const [activeKey, setActiveKey] = useState<string>(
    choices.find((c) => !initialOverlays.some((o) => o.key === c.key))?.key ??
      choices[0]?.key ??
      ""
  );
  const [defaultSize, setDefaultSize] = useState(DEFAULT_SIZE);
  const [saving, setSaving] = useState(false);

  const labelOf = useCallback(
    (k: string) => choices.find((c) => c.key === k)?.label ?? k,
    [choices]
  );

  // pdfjs 로드 + 문서 열기 (클라이언트 전용)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf/pdf.worker.min.mjs";
        const task = pdfjs.getDocument({ url: fileUrl });
        const pdf = await task.promise;
        if (cancelled) return;
        pdfRef.current = pdf;
        setNumPages(pdf.numPages);
        setReady(true);
      } catch (e) {
        if (!cancelled)
          setLoadError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fileUrl]);

  // 페이지 렌더
  useEffect(() => {
    if (!ready || !pdfRef.current) return;
    let cancelled = false;
    (async () => {
      const pdf = pdfRef.current;
      const page = await pdf.getPage(pageNum);
      const base = page.getViewport({ scale: 1 });
      const containerW = containerRef.current?.clientWidth ?? 700;
      const s = Math.min(1.6, Math.max(0.4, containerW / base.width));
      const viewport = page.getViewport({ scale: s });
      const canvas = canvasRef.current;
      if (!canvas || cancelled) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      await page.render({ canvasContext: ctx, viewport }).promise;
      if (cancelled) return;
      setScale(s);
      setCanvasH(viewport.height);
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, pageNum]);

  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!activeKey) {
      toast.error("먼저 배치할 항목을 선택하세요");
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    // px → PDF pt (좌하단 원점)
    const x = px / scale;
    const y = (canvas.height - py) / scale;
    const page0 = pageNum - 1;
    setOverlays((cur) => {
      const without = cur.filter(
        (o) => !(o.key === activeKey) // 같은 항목은 한 곳만 (재클릭 시 이동)
      );
      return [
        ...without,
        { key: activeKey, page: page0, x, y, size: defaultSize },
      ];
    });
    // 다음 미배치 항목으로 자동 이동
    const remaining = choices.find(
      (c) =>
        c.key !== activeKey &&
        !overlays.some((o) => o.key === c.key && o.key !== activeKey)
    );
    if (remaining) setActiveKey(remaining.key);
  }

  const pageOverlays = overlays.filter((o) => o.page === pageNum - 1);

  async function handleSave() {
    setSaving(true);
    const res = await saveFieldOverlaysAction(formFileId, overlays);
    setSaving(false);
    if (res.ok) toast.success("좌표를 저장했습니다.");
    else toast.error("저장 실패", { description: res.error });
  }

  const placedCount = overlays.length;
  const totalCount = choices.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">좌표 채움 위치 지정</h2>
          <p className="text-xs text-muted-foreground">
            항목을 고르고 양식 위 위치를 클릭하세요. ({placedCount}/{totalCount}{" "}
            배치됨)
          </p>
        </div>
        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          좌표 저장
        </Button>
      </div>

      {loadError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          PDF 를 불러오지 못했습니다: {loadError}
        </div>
      ) : null}

      {/* 항목 선택 + 기본 글자크기 */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium">배치할 항목:</span>
        {choices.length === 0 ? (
          <span className="text-xs text-muted-foreground">
            먼저 위 “작성에 필요한 표준데이터”에서 항목을 선택하세요.
          </span>
        ) : (
          choices.map((c) => {
            const placed = overlays.some((o) => o.key === c.key);
            const on = activeKey === c.key;
            return (
              <button
                type="button"
                key={c.key}
                onClick={() => setActiveKey(c.key)}
                className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs ${
                  on
                    ? "border-primary bg-primary text-primary-foreground"
                    : placed
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                      : "border-input hover:bg-muted"
                }`}
              >
                {on ? <Crosshair className="size-3" /> : null}
                {c.label}
                {placed ? " ✓" : ""}
              </button>
            );
          })
        )}
      </div>

      <label className="flex items-center gap-2 text-xs">
        기본 글자 크기(pt):
        <input
          type="number"
          min={6}
          max={40}
          value={defaultSize}
          onChange={(e) => setDefaultSize(Number(e.target.value) || DEFAULT_SIZE)}
          className="h-7 w-16 rounded-md border border-input bg-background px-2"
        />
      </label>

      {/* 페이지 네비 */}
      {numPages > 1 ? (
        <div className="flex items-center gap-2 text-sm">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pageNum <= 1}
            onClick={() => setPageNum((p) => Math.max(1, p - 1))}
          >
            이전
          </Button>
          <span>
            {pageNum} / {numPages} 페이지
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pageNum >= numPages}
            onClick={() => setPageNum((p) => Math.min(numPages, p + 1))}
          >
            다음
          </Button>
        </div>
      ) : null}

      {/* 캔버스 + 마커 오버레이 */}
      <div
        ref={containerRef}
        className="relative max-h-[760px] w-full overflow-auto rounded-md border bg-muted/30"
      >
        {!ready && !loadError ? (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" /> PDF 불러오는 중…
          </div>
        ) : null}
        <div className="relative inline-block">
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            className="cursor-crosshair"
          />
          {/* 현재 페이지 마커 */}
          {pageOverlays.map((o) => {
            const left = o.x * scale;
            const top = canvasH - o.y * scale;
            return (
              <div
                key={o.key}
                style={{ left, top }}
                className="pointer-events-none absolute -translate-y-full"
              >
                <div className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-primary ring-2 ring-white" />
                  <span className="whitespace-nowrap rounded bg-primary/90 px-1 py-0.5 text-[10px] font-medium text-primary-foreground">
                    {labelOf(o.key)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 배치 목록 (크기·폭 편집·삭제) */}
      {overlays.length > 0 ? (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-1.5 text-left">항목</th>
                <th className="px-3 py-1.5 text-left">페이지</th>
                <th className="px-3 py-1.5 text-left">크기(pt)</th>
                <th className="px-3 py-1.5 text-left">최대폭(pt)</th>
                <th className="px-3 py-1.5"></th>
              </tr>
            </thead>
            <tbody>
              {overlays.map((o, i) => (
                <tr key={o.key} className="border-b last:border-0">
                  <td className="px-3 py-1.5">{labelOf(o.key)}</td>
                  <td className="px-3 py-1.5">{o.page + 1}</td>
                  <td className="px-3 py-1.5">
                    <input
                      type="number"
                      min={6}
                      max={40}
                      value={o.size ?? DEFAULT_SIZE}
                      onChange={(e) =>
                        setOverlays((cur) =>
                          cur.map((x, j) =>
                            j === i
                              ? { ...x, size: Number(e.target.value) || DEFAULT_SIZE }
                              : x
                          )
                        )
                      }
                      className="h-7 w-16 rounded-md border border-input bg-background px-2"
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      type="number"
                      min={0}
                      placeholder="자동"
                      value={o.maxWidth ?? ""}
                      onChange={(e) =>
                        setOverlays((cur) =>
                          cur.map((x, j) =>
                            j === i
                              ? {
                                  ...x,
                                  maxWidth: e.target.value
                                    ? Number(e.target.value)
                                    : undefined,
                                }
                              : x
                          )
                        )
                      }
                      className="h-7 w-20 rounded-md border border-input bg-background px-2"
                    />
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <button
                      type="button"
                      onClick={() =>
                        setOverlays((cur) => cur.filter((_, j) => j !== i))
                      }
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
