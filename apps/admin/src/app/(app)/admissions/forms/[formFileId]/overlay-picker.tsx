"use client";

/**
 * [작성서류] PDF 채움 영역(박스) 지정기.
 *   원본 양식 PDF 를 pdfjs 로 캔버스에 렌더 → 운영자가 항목별 "채움 박스"를 놓고
 *   드래그로 이동·모서리로 크기 조절. 화면(px) → PDF(pt, 좌하단 원점) 변환해 저장.
 *   채움 엔진(abroad /final/pdf)이 박스 안에 학생 데이터를 맞춰(축소·줄바꿈) 그린다.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Save, Trash2, Crosshair, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { saveFieldOverlaysAction } from "@/app/(app)/universities/[id]/forms/actions";

export type FieldChoice = { key: string; label: string; aliases?: string[] };

/** 인접한 선 인덱스를 하나로 묶어 대표값(평균)으로. */
function clusterLines(idxs: number[], tol = 4): number[] {
  if (idxs.length === 0) return [];
  const sorted = [...idxs].sort((a, b) => a - b);
  const out: number[] = [];
  let group = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] <= tol) group.push(sorted[i]);
    else {
      out.push(group.reduce((s, v) => s + v, 0) / group.length);
      group = [sorted[i]];
    }
  }
  out.push(group.reduce((s, v) => s + v, 0) / group.length);
  return out;
}

/** 렌더된 비트맵에서 표 괘선(가로/세로 긴 어두운 선)을 감지. (벡터·스캔 공통) */
function detectGrid(
  data: Uint8ClampedArray,
  W: number,
  H: number
): { vX: number[]; hY: number[] } {
  const dark = (x: number, y: number) => {
    const i = (y * W + x) * 4;
    return data[i] + data[i + 1] + data[i + 2] < 380 && data[i + 3] > 128;
  };
  const hY: number[] = [];
  const hMin = W * 0.3;
  for (let y = 0; y < H; y++) {
    let run = 0;
    let max = 0;
    for (let x = 0; x < W; x++) {
      if (dark(x, y)) {
        run++;
        if (run > max) max = run;
      } else run = 0;
    }
    if (max > hMin) hY.push(y);
  }
  const vX: number[] = [];
  const vMin = H * 0.2;
  for (let x = 0; x < W; x++) {
    let run = 0;
    let max = 0;
    for (let y = 0; y < H; y++) {
      if (dark(x, y)) {
        run++;
        if (run > max) max = run;
      } else run = 0;
    }
    if (max > vMin) vX.push(x);
  }
  return { vX: clusterLines(vX), hY: clusterLines(hY) };
}

/** 점(px,py, 캔버스 좌상단 원점)을 둘러싼 셀 경계(캔버스 px). 없으면 null. */
function cellAt(
  grid: { vX: number[]; hY: number[] },
  px: number,
  py: number
): { left: number; right: number; top: number; bottom: number } | null {
  let left = -Infinity;
  let right = Infinity;
  for (const v of grid.vX) {
    if (v <= px && v > left) left = v;
    if (v > px && v < right) right = v;
  }
  let top = -Infinity;
  let bottom = Infinity;
  for (const hy of grid.hY) {
    if (hy <= py && hy > top) top = hy;
    if (hy > py && hy < bottom) bottom = hy;
  }
  if (!isFinite(left) || !isFinite(right) || !isFinite(top) || !isFinite(bottom))
    return null;
  return { left, right, top, bottom };
}

/** 라벨 텍스트로 특수 박스 종류 추론 (사진/서명/날짜). */
function inferSpecialKind(
  label: string
):
  | { kind: "image" }
  | { kind: "signature" }
  | { kind: "input"; inputLabel: string }
  | null {
  const s = label.replace(/\s/g, "");
  if (/(증명)?사진|photo/i.test(s)) return { kind: "image" };
  if (/서명|사인|signature|자필/i.test(s)) return { kind: "signature" };
  if (/작성일|신청일|지원일|날짜|일자|date/i.test(s))
    return { kind: "input", inputLabel: label.trim() };
  return null;
}

export type OverlayKind = "text" | "image" | "signature" | "check";

export type Overlay = {
  key: string; // 박스 고유 id
  page: number; // 0-based
  x: number; // 박스 좌하단 x (PDF pt)
  y: number; // 박스 좌하단 y (PDF pt, 좌하단 원점)
  w: number; // 박스 너비 (PDF pt)
  h: number; // 박스 높이 (PDF pt)
  size?: number; // 최대 글자 크기 (박스보다 크면 자동 축소)
  maxWidth?: number; // 레거시
  kind?: OverlayKind; // 박스 종류 (기본 text)
  source?: "student" | "input"; // text 출처
  dataKey?: string; // 연결 키 (학생데이터/이미지/체크)
  inputLabel?: string; // 생성 시 입력 라벨
  inputType?: "date" | "text"; // 생성 시 입력 형식
  matchValue?: string; // check 일치값
};

/** DB 에서 읽은 오버레이 — 레거시는 w/h/kind 가 없을 수 있다. */
export type RawOverlay = {
  key: string;
  page: number;
  x: number;
  y: number;
  w?: number;
  h?: number;
  size?: number;
  maxWidth?: number;
  kind?: OverlayKind;
  source?: "student" | "input";
  dataKey?: string;
  inputLabel?: string;
  inputType?: "date" | "text";
  matchValue?: string;
};


const DEFAULT_SIZE = 11;
const DEFAULT_W = 150;
const DEFAULT_H = 18;

/** 매칭용 정규화: 공백·구두점·괄호·별표 제거, 소문자. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\s:：·*•()[\]{}_\-.,/\\]+/g, "")
    .replace(/['"’”]/g, "");
}

/**
 * 후보 텍스트(양식 필드명/라벨) ↔ 항목(choice) 매칭 점수.
 *   3=완전일치, 2=접두/접미 일치, 1=포함. 0=불일치.
 */
function matchScore(candidate: string, aliases: string[]): number {
  const c = norm(candidate);
  if (c.length < 2) return 0;
  let best = 0;
  for (const raw of aliases) {
    const a = norm(raw);
    if (a.length < 2) continue;
    if (c === a) best = Math.max(best, 3);
    else if (c.startsWith(a) || a.startsWith(c)) best = Math.max(best, 2);
    else if (a.length >= 3 && (c.includes(a) || a.includes(c)))
      best = Math.max(best, 1);
  }
  return best;
}

/** 레거시(점) 오버레이를 박스로 변환 + 종류 기본값 보정. */
function toBox(o: RawOverlay): Overlay {
  const size = o.size ?? DEFAULT_SIZE;
  const kind = o.kind ?? "text";
  const common = {
    key: o.key,
    page: o.page,
    size,
    kind,
    source: kind === "text" ? (o.source ?? "student") : undefined,
    dataKey: o.dataKey ?? (kind === "text" && o.source === "input" ? undefined : o.key),
    inputLabel: o.inputLabel,
    inputType: o.inputType,
    matchValue: o.matchValue,
  };
  if (o.w && o.h) {
    return { ...common, x: o.x, y: o.y, w: o.w, h: o.h };
  }
  return {
    ...common,
    x: o.x,
    w: o.maxWidth && o.maxWidth > 0 ? o.maxWidth : DEFAULT_W,
    h: Math.round(size * 1.6),
    y: Math.max(0, o.y - size * 0.3), // baseline → 박스 바닥(근사)
  };
}

export function OverlayPicker({
  formFileId,
  fileUrl,
  choices,
  initialOverlays,
}: {
  formFileId: string;
  fileUrl: string;
  choices: FieldChoice[];
  initialOverlays: RawOverlay[];
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

  const [overlays, setOverlays] = useState<Overlay[]>(
    initialOverlays.map(toBox)
  );
  const [activeKey, setActiveKey] = useState<string>(
    choices.find((c) => !initialOverlays.some((o) => o.key === c.key))?.key ??
      choices[0]?.key ??
      ""
  );
  const [defaultSize, setDefaultSize] = useState(DEFAULT_SIZE);
  const [saving, setSaving] = useState(false);
  const [autoBusy, setAutoBusy] = useState(false);

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

  function nextId(kind: OverlayKind): string {
    let n = 1;
    while (overlays.some((o) => o.key === `${kind}-${n}`)) n++;
    return `${kind}-${n}`;
  }

  // 종류별 박스 추가 (페이지 가운데 근처에 생성 후 선택 → 드래그·바인딩)
  function addTypedBox(kind: OverlayKind) {
    const page0 = pageNum - 1;
    const cx = (canvasRef.current?.width ?? 400) / scale / 2;
    const cy = (canvasRef.current?.height ?? 600) / scale / 2;
    const dims =
      kind === "check"
        ? { w: 14, h: 14 }
        : kind === "image"
          ? { w: 90, h: 110 }
          : kind === "signature"
            ? { w: 120, h: 40 }
            : { w: DEFAULT_W, h: Math.round(defaultSize * 1.6) };
    const key = nextId(kind);
    const box: Overlay = {
      key,
      page: page0,
      x: Math.max(0, cx - dims.w / 2),
      y: Math.max(0, cy - dims.h / 2),
      ...dims,
      size: defaultSize,
      kind,
      ...(kind === "text"
        ? { source: "input", inputType: "date", inputLabel: "" }
        : {}),
    };
    setOverlays((cur) => [...cur, box]);
    setActiveKey(key);
  }

  // 빈 곳 클릭 → 선택 박스를 그 자리(좌상단)로 이동, 없으면 학생데이터 텍스트 박스 생성
  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!activeKey) {
      toast.error("먼저 항목을 선택하거나 박스를 추가하세요");
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const topPt = (canvas.height - py) / scale; // 클릭점 = 박스 좌상단
    const x = px / scale;
    const page0 = pageNum - 1;
    const existing = overlays.find((o) => o.key === activeKey);
    if (existing) {
      // 기존 박스 이동 (종류·바인딩 유지)
      const y = Math.max(0, topPt - existing.h);
      setOverlays((cur) =>
        cur.map((o) => (o.key === activeKey ? { ...o, page: page0, x, y } : o))
      );
      return;
    }
    // 학생데이터 텍스트 박스 신규 생성 (chip 으로 선택된 data_type_key)
    const h = defaultSize * 1.6;
    const y = Math.max(0, topPt - h);
    setOverlays((cur) => [
      ...cur,
      {
        key: activeKey,
        page: page0,
        x,
        y,
        w: DEFAULT_W,
        h,
        size: defaultSize,
        kind: "text",
        source: "student",
        dataKey: activeKey,
      },
    ]);
    const remaining = choices.find(
      (c) => c.key !== activeKey && !overlays.some((o) => o.key === c.key)
    );
    if (remaining) setActiveKey(remaining.key);
  }

  // 박스 표시 라벨
  function boxLabel(o: Overlay): string {
    const kind = o.kind ?? "text";
    if (kind === "check") return (o.dataKey ? labelOf(o.dataKey) : "체크") + " ✓";
    if (kind === "image") return "이미지";
    if (kind === "signature") return "사인";
    if (o.source === "input") return o.inputLabel || "입력";
    return labelOf(o.dataKey ?? o.key);
  }

  // 박스 이동/크기조절 드래그
  function startDrag(
    e: React.PointerEvent,
    key: string,
    mode: "move" | "resize"
  ) {
    e.preventDefault();
    e.stopPropagation();
    setActiveKey(key);
    const orig = overlays.find((o) => o.key === key);
    if (!orig) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const top = orig.y + orig.h; // resize 시 좌상단 고정용
    const move = (ev: PointerEvent) => {
      const dxPt = (ev.clientX - startX) / scale;
      const dyPt = (ev.clientY - startY) / scale; // 화면 아래 = pt 감소
      setOverlays((cur) =>
        cur.map((o) => {
          if (o.key !== key) return o;
          if (mode === "move") {
            return {
              ...o,
              x: Math.max(0, orig.x + dxPt),
              y: Math.max(0, orig.y - dyPt),
            };
          }
          // resize: 좌상단 고정, 우하단을 끌어 너비·높이 변경
          const w = Math.max(20, orig.w + dxPt);
          const h = Math.max(8, orig.h + dyPt);
          return { ...o, w, h, y: Math.max(0, top - h) };
        })
      );
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  // ── 자동 배치: 표 괘선(렌더 비트맵에서 감지)으로 박스를 칸에 스냅 + 종류 추론.
  //    1) 사진/서명/날짜 라벨 → 이미지/사인/입력 박스(라벨이 든 칸).
  //    2) 그 외 라벨 → 학생데이터 텍스트(별칭 매칭) → 라벨 오른쪽 칸.
  //    3) AcroForm 텍스트필드 → 필드 rect.
  const GRID_SCALE = 1.6;
  async function autoPlace() {
    if (!pdfRef.current) return;
    setAutoBusy(true);
    try {
      const pdf = pdfRef.current;

      // 박스 후보: 위치(PDF pt) + 매칭용 텍스트 + 추론 종류
      type Cand = {
        text: string;
        page0: number;
        box: { x: number; y: number; w: number; h: number };
        special: ReturnType<typeof inferSpecialKind>;
        crowded: boolean;
      };
      const cands: Cand[] = [];
      const fieldCands: Array<{
        text: string;
        page0: number;
        box: { x: number; y: number; w: number; h: number };
      }> = [];

      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const vp = page.getViewport({ scale: GRID_SCALE });
        const Hc = vp.height;
        const Wc = vp.width;

        // 오프스크린 렌더 → 괘선 감지
        let grid: { vX: number[]; hY: number[] } = { vX: [], hY: [] };
        try {
          const oc = document.createElement("canvas");
          oc.width = Wc;
          oc.height = Hc;
          const octx = oc.getContext("2d", { willReadFrequently: true });
          if (octx) {
            await page.render({ canvasContext: octx, viewport: vp }).promise;
            const img = octx.getImageData(0, 0, Wc, Hc);
            grid = detectGrid(img.data, Wc, Hc);
          }
        } catch {
          // 렌더 실패 — 괘선 없이 진행
        }

        // PDF pt → 캔버스 px, 캔버스 셀 → PDF 박스
        const toCanvas = (xPt: number, yPt: number) => ({
          cx: xPt * GRID_SCALE,
          cy: Hc - yPt * GRID_SCALE,
        });
        const cellBox = (cx: number, cy: number) => {
          const c = cellAt(grid, cx, cy);
          if (!c) return null;
          const pad = 1.5;
          const x = c.left / GRID_SCALE + pad;
          const w = (c.right - c.left) / GRID_SCALE - pad * 2;
          const yTop = (Hc - c.top) / GRID_SCALE;
          const yBot = (Hc - c.bottom) / GRID_SCALE;
          const y = yBot + pad;
          const h = yTop - yBot - pad * 2;
          if (w < 8 || h < 6 || w > 520) return null;
          return { x, y, w, h };
        };

        // AcroForm 텍스트필드
        const anns = (await page.getAnnotations()) as Array<{
          fieldType?: string;
          fieldName?: string;
          rect?: number[];
        }>;
        for (const a of anns) {
          if (a.fieldType !== "Tx" || !a.fieldName || !a.rect) continue;
          const r = a.rect;
          const x1 = Math.min(r[0], r[2]);
          const y1 = Math.min(r[1], r[3]);
          fieldCands.push({
            text: a.fieldName,
            page0: p - 1,
            box: {
              x: x1 + 1,
              y: y1 + 1,
              w: Math.max(12, Math.abs(r[2] - r[0]) - 2),
              h: Math.max(8, Math.abs(r[3] - r[1]) - 2),
            },
          });
        }

        // 텍스트 라벨
        const tc = await page.getTextContent();
        const raw = tc.items as Array<{
          str?: string;
          transform?: number[];
          width?: number;
        }>;
        const texts = raw
          .map((it) => {
            const str = (it.str ?? "").trim();
            const tr = it.transform;
            if (!str || !tr) return null;
            return { str, x: tr[4], endX: tr[4] + (it.width ?? 0), y: tr[5] };
          })
          .filter(
            (t): t is { str: string; x: number; endX: number; y: number } => !!t
          );

        for (const t of texts) {
          if (t.str.length > 24) continue;
          if (!/[A-Za-z가-힣]/.test(t.str)) continue;
          const special = inferSpecialKind(t.str);

          let box: { x: number; y: number; w: number; h: number } | null = null;
          if (special) {
            // 사진/서명/날짜: 라벨이 들어있는 칸
            const c = toCanvas((t.x + t.endX) / 2, t.y);
            box = cellBox(c.cx, c.cy);
          } else {
            // 학생데이터: 라벨 오른쪽 점이 든 칸
            const c = toCanvas(t.endX + 4, t.y);
            box = cellBox(c.cx, c.cy);
          }

          // 괘선 못 찾으면 라벨 오른쪽 빈칸 추정(폴백)
          let crowded = false;
          if (!box) {
            let rightGap = Infinity;
            for (const o of texts) {
              if (o === t || Math.abs(o.y - t.y) > 4 || o.x <= t.endX) continue;
              rightGap = Math.min(rightGap, o.x - t.endX);
            }
            crowded = rightGap < 16;
            const h = Math.round(defaultSize * 1.5);
            const w =
              Number.isFinite(rightGap) && rightGap < 480
                ? Math.max(24, rightGap - 8)
                : DEFAULT_W;
            box = special
              ? { x: t.x, y: t.y - defaultSize * 0.3, w: DEFAULT_W, h: special.kind === "image" ? 90 : h }
              : { x: t.endX + 6, y: t.y - defaultSize * 0.3, w, h };
          }
          cands.push({ text: t.str, page0: p - 1, box, special, crowded });
        }
      }

      const placed = new Set(overlays.map((o) => o.key));
      const cellKey = (page0: number, b: { x: number; y: number }) =>
        `${page0}:${Math.round(b.x / 4)}:${Math.round(b.y / 4)}`;
      // 기존 박스가 점유한 칸은 재실행 시 중복 생성 방지
      const usedCells = new Set<string>(
        overlays.map((o) => cellKey(o.page, o))
      );
      const newKey = () =>
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `box-${Math.round(performance.now())}-${Math.round(Math.random() * 1e6)}`;
      const additions: Overlay[] = [];

      // 1) 특수 종류(사진/서명/날짜) — 라벨에서 바로 생성
      for (const c of cands) {
        if (!c.special) continue;
        const ck = cellKey(c.page0, c.box);
        if (usedCells.has(ck)) continue;
        if (c.special.kind === "image" || c.special.kind === "signature") {
          usedCells.add(ck);
          additions.push({
            key: newKey(),
            page: c.page0,
            x: c.box.x,
            y: Math.max(0, c.box.y),
            w: Math.round(c.box.w),
            h: Math.round(c.box.h),
            size: defaultSize,
            kind: c.special.kind,
          });
        } else {
          usedCells.add(ck);
          additions.push({
            key: newKey(),
            page: c.page0,
            x: c.box.x,
            y: Math.max(0, c.box.y),
            w: Math.round(c.box.w),
            h: Math.round(c.box.h),
            size: defaultSize,
            kind: "text",
            source: "input",
            inputType: "date",
            inputLabel: c.special.inputLabel,
          });
        }
      }

      // 2) 학생데이터 텍스트 — 별칭 매칭 (특수 아닌 후보만)
      const textCands = cands.filter((c) => !c.special && !c.crowded);
      const bestByKey = new Map<string, { score: number; cand: Cand }>();
      for (const ch of choices) {
        if (placed.has(ch.key)) continue;
        const aliases = ch.aliases ?? [ch.label];
        for (const cand of textCands) {
          const sc = matchScore(cand.text, aliases);
          if (sc <= 0) continue;
          const prev = bestByKey.get(ch.key);
          if (!prev || sc > prev.score) bestByKey.set(ch.key, { score: sc, cand });
        }
      }
      const entries = Array.from(bestByKey.entries()).sort(
        (a, b) => b[1].score - a[1].score
      );
      for (const [key, { cand }] of entries) {
        const ck = cellKey(cand.page0, cand.box);
        if (usedCells.has(ck)) continue;
        usedCells.add(ck);
        additions.push({
          key,
          page: cand.page0,
          x: cand.box.x,
          y: Math.max(0, cand.box.y),
          w: Math.round(cand.box.w),
          h: Math.round(cand.box.h),
          size: defaultSize,
          kind: "text",
          source: "student",
          dataKey: key,
        });
      }

      // 3) AcroForm 필드 — 미사용 choice 와 별칭 매칭
      for (const fc of fieldCands) {
        let bestKey: string | null = null;
        let bestSc = 0;
        for (const ch of choices) {
          if (placed.has(ch.key) || additions.some((a) => a.key === ch.key))
            continue;
          const sc = matchScore(fc.text, ch.aliases ?? [ch.label]);
          if (sc > bestSc) {
            bestSc = sc;
            bestKey = ch.key;
          }
        }
        if (bestKey && bestSc > 0) {
          additions.push({
            key: bestKey,
            page: fc.page0,
            x: fc.box.x,
            y: fc.box.y,
            w: Math.round(fc.box.w),
            h: Math.round(fc.box.h),
            size: Math.min(14, Math.max(8, Math.round(fc.box.h * 0.55))),
            kind: "text",
            source: "student",
            dataKey: bestKey,
          });
        }
      }

      if (additions.length === 0) {
        toast.info(
          "자동으로 잡은 칸이 없습니다. 양식 표가 특이하거나 괘선이 흐릴 수 있어요 — 직접 박스를 놓아주세요."
        );
      } else {
        setOverlays((cur) => [...cur, ...additions]);
        if (additions[0]) setPageNum(additions[0].page + 1);
        toast.success(
          `${additions.length}개 자동 배치됨 (칸에 맞춤·종류 추론). 종류·연결·위치 확인 후 저장하세요.`
        );
      }
    } catch (e) {
      toast.error("자동 배치 실패", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setAutoBusy(false);
    }
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
          <h2 className="text-base font-semibold">채움 영역(박스) 지정</h2>
          <p className="text-xs text-muted-foreground">
            <strong>자동 배치</strong>로 한번에 잡고, 박스를 드래그·크기조절해 보정하세요.
            ({placedCount}/{totalCount} 배치됨)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={autoPlace}
            disabled={autoBusy || !ready || choices.length === 0}
          >
            {autoBusy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            자동 배치
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            좌표 저장
          </Button>
        </div>
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

      {/* 종류별 박스 추가 */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium">박스 추가:</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!ready}
          onClick={() => addTypedBox("text")}
        >
          + 입력칸(날짜 등)
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!ready}
          onClick={() => addTypedBox("check")}
        >
          + 체크
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!ready}
          onClick={() => addTypedBox("image")}
        >
          + 이미지
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!ready}
          onClick={() => addTypedBox("signature")}
        >
          + 사인
        </Button>
        <span className="text-[11px] text-muted-foreground">
          추가 후 표에서 연결·설정하고, 캔버스에서 드래그로 위치 지정
        </span>
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

      <p className="text-xs text-muted-foreground">
        파란 박스 = 채움 영역(글자가 길면 박스 안에서 자동 축소·줄바꿈). 박스를{" "}
        <strong>드래그</strong>해 이동, <strong>우하단 모서리</strong>로 크기 조절.
        빈 곳을 클릭하면 선택 항목 박스가 그 자리에 생깁니다.
      </p>

      {/* 캔버스 + 박스 오버레이 */}
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
          {/* 현재 페이지 채움 박스 */}
          {pageOverlays.map((o) => {
            const left = o.x * scale;
            const top = canvasH - (o.y + o.h) * scale;
            const on = o.key === activeKey;
            const fs = (o.size ?? DEFAULT_SIZE) * scale;
            return (
              <div
                key={o.key}
                onPointerDown={(e) => startDrag(e, o.key, "move")}
                style={{
                  left,
                  top,
                  width: o.w * scale,
                  height: o.h * scale,
                }}
                className={`absolute box-border cursor-move overflow-hidden rounded-[2px] border ${
                  on
                    ? "border-amber-500 bg-amber-300/20"
                    : "border-sky-500 bg-sky-300/15"
                }`}
                title="드래그=이동 · 우하단 모서리=크기조절"
              >
                <span
                  style={{ fontSize: Math.max(7, Math.min(fs, 13)), lineHeight: 1.1 }}
                  className={`pointer-events-none flex h-full items-center overflow-hidden whitespace-nowrap px-0.5 font-medium ${
                    on ? "text-amber-700" : "text-sky-700"
                  }`}
                >
                  {boxLabel(o)}
                </span>
                {/* 크기조절 핸들 */}
                <span
                  onPointerDown={(e) => startDrag(e, o.key, "resize")}
                  className={`absolute -bottom-1 -right-1 size-3 cursor-nwse-resize rounded-sm border border-white ${
                    on ? "bg-amber-500" : "bg-sky-500"
                  }`}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* 배치 목록 (종류·연결·크기·삭제) */}
      {overlays.length > 0 ? (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-1.5 text-left">종류</th>
                <th className="px-3 py-1.5 text-left">연결 · 설정</th>
                <th className="px-3 py-1.5 text-left">P</th>
                <th className="px-3 py-1.5 text-left">글자</th>
                <th className="px-3 py-1.5 text-left">박스</th>
                <th className="px-3 py-1.5"></th>
              </tr>
            </thead>
            <tbody>
              {overlays.map((o, i) => {
                const patch = (p: Partial<Overlay>) =>
                  setOverlays((cur) =>
                    cur.map((x, j) => (j === i ? { ...x, ...p } : x))
                  );
                const kind = o.kind ?? "text";
                const kindSel =
                  kind === "text"
                    ? o.source === "input"
                      ? "text:input"
                      : "text:student"
                    : kind;
                const dataSelect = (
                  <select
                    value={o.dataKey ?? ""}
                    onChange={(e) => patch({ dataKey: e.target.value || undefined })}
                    className="h-7 max-w-[180px] rounded-md border border-input bg-background px-1 text-xs"
                  >
                    <option value="">(연결 선택)</option>
                    {choices.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                );
                return (
                  <tr key={o.key} className="border-b last:border-0 align-top">
                    <td className="px-3 py-1.5">
                      <select
                        value={kindSel}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "text:student")
                            patch({ kind: "text", source: "student" });
                          else if (v === "text:input")
                            patch({
                              kind: "text",
                              source: "input",
                              inputType: o.inputType ?? "date",
                            });
                          else
                            patch({
                              kind: v as OverlayKind,
                              source: undefined,
                            });
                        }}
                        className="h-7 rounded-md border border-input bg-background px-1 text-xs"
                      >
                        <option value="text:student">텍스트(학생)</option>
                        <option value="text:input">텍스트(입력)</option>
                        <option value="check">체크</option>
                        <option value="image">이미지</option>
                        <option value="signature">사인</option>
                      </select>
                    </td>
                    <td className="px-3 py-1.5">
                      {kind === "text" && o.source === "input" ? (
                        <div className="flex flex-wrap items-center gap-1">
                          <input
                            value={o.inputLabel ?? ""}
                            onChange={(e) => patch({ inputLabel: e.target.value })}
                            placeholder="라벨 예: 작성일"
                            className="h-7 w-28 rounded-md border border-input bg-background px-2 text-xs"
                          />
                          <select
                            value={o.inputType ?? "date"}
                            onChange={(e) =>
                              patch({ inputType: e.target.value as "date" | "text" })
                            }
                            className="h-7 rounded-md border border-input bg-background px-1 text-xs"
                          >
                            <option value="date">날짜</option>
                            <option value="text">텍스트</option>
                          </select>
                        </div>
                      ) : kind === "check" ? (
                        <div className="flex flex-wrap items-center gap-1">
                          {dataSelect}
                          <input
                            value={o.matchValue ?? ""}
                            onChange={(e) => patch({ matchValue: e.target.value })}
                            placeholder="일치값(예: male)"
                            className="h-7 w-28 rounded-md border border-input bg-background px-2 text-xs"
                          />
                        </div>
                      ) : (
                        dataSelect
                      )}
                    </td>
                    <td className="px-3 py-1.5">{o.page + 1}</td>
                    <td className="px-3 py-1.5">
                      <input
                        type="number"
                        min={6}
                        max={40}
                        value={o.size ?? DEFAULT_SIZE}
                        onChange={(e) =>
                          patch({ size: Number(e.target.value) || DEFAULT_SIZE })
                        }
                        className="h-7 w-14 rounded-md border border-input bg-background px-2"
                      />
                    </td>
                    <td className="px-3 py-1.5 text-xs text-muted-foreground">
                      {Math.round(o.w)}×{Math.round(o.h)}
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
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
