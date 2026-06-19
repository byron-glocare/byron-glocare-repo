"use client";

/**
 * [작성서류] PDF 채움 영역(박스) 지정기.
 *   원본 양식 PDF 를 pdfjs 로 캔버스에 렌더 → 운영자가 항목별 "채움 박스"를 놓고
 *   드래그로 이동·모서리로 크기 조절. 화면(px) → PDF(pt, 좌하단 원점) 변환해 저장.
 *   채움 엔진(abroad /final/pdf)이 박스 안에 학생 데이터를 맞춰(축소·줄바꿈) 그린다.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Save, Trash2, Sparkles, X } from "lucide-react";
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
  const s = label.replace(/[\s()]/g, "");
  if (/(증명)?사진|photo|얼굴|반명함/i.test(s)) return { kind: "image" };
  if (/서명|사인|signature|자필|날인|서명인|인$/i.test(s))
    return { kind: "signature" };
  // 생년월일·졸업일 등 "학생 데이터 날짜"는 제외하고, 서류 작성/접수 날짜만 입력칸으로.
  if (/생년|생일|졸업|발급|입국|만료|만기|시작|종료/.test(s)) return null;
  if (/작성일|신청일|지원일|제출일|접수일|작성년월일|작성날짜/.test(s))
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
  source?: "student" | "input" | "static"; // text 출처
  dataKey?: string; // 연결 키 (학생데이터/이미지/체크)
  inputLabel?: string; // 생성 시 입력 라벨
  inputType?: "date" | "text"; // 생성 시 입력 형식
  staticText?: string; // source=static: 관리자 고정 텍스트
  datePart?: "year" | "month" | "day"; // input·date: 년/월/일 분리 출력
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
  source?: "student" | "input" | "static";
  dataKey?: string;
  inputLabel?: string;
  inputType?: "date" | "text";
  staticText?: string;
  datePart?: "year" | "month" | "day";
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
    staticText: o.staticText,
    datePart: o.datePart,
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

  const [overlays, setOverlays] = useState<Overlay[]>(() => {
    // 로드 시 key 중복 제거 (예전 자동배치가 만든 중복 key 데이터 방어)
    const seen = new Set<string>();
    const mk = () =>
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `box-${seen.size}-${Math.round(Math.random() * 1e9)}`;
    return initialOverlays.map(toBox).map((o) => {
      let key = o.key;
      while (seen.has(key)) key = mk();
      seen.add(key);
      return key === o.key ? o : { ...o, key };
    });
  });
  const [activeKey, setActiveKey] = useState<string>(
    choices.find((c) => !initialOverlays.some((o) => o.key === c.key))?.key ??
      choices[0]?.key ??
      ""
  );
  const defaultSize = DEFAULT_SIZE;
  const [saving, setSaving] = useState(false);
  const [autoBusy, setAutoBusy] = useState(false);
  // 정렬 가이드선 (axis x=세로선, y=가로선; PDF pt). 편집 보조용 — 저장 안 함.
  const [guides, setGuides] = useState<
    { id: string; axis: "x" | "y"; pos: number }[]
  >([]);
  const [showGuides, setShowGuides] = useState(true);

  const labelOf = useCallback(
    (k: string) => choices.find((c) => c.key === k)?.label ?? k,
    [choices]
  );

  // 가이드선 근처면 스냅 (PDF pt, 임계 5pt). 맞는 값 없으면 null.
  const snapTo = (val: number, axis: "x" | "y"): number | null => {
    let best: number | null = null;
    let bestD = 5;
    for (const g of guides) {
      if (g.axis !== axis) continue;
      const d = Math.abs(val - g.pos);
      if (d < bestD) {
        bestD = d;
        best = g.pos;
      }
    }
    return best;
  };

  // 키보드 화살표 → 선택 박스 1pt(shift=10pt) 이동
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!activeKey) return;
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName)) return;
      const step = e.shiftKey ? 10 : 1;
      let dx = 0;
      let dy = 0;
      if (e.key === "ArrowLeft") dx = -step;
      else if (e.key === "ArrowRight") dx = step;
      else if (e.key === "ArrowUp") dy = step; // pt: 위로 = y 증가
      else if (e.key === "ArrowDown") dy = -step;
      else return;
      e.preventDefault();
      setOverlays((cur) =>
        cur.map((o) =>
          o.key === activeKey
            ? { ...o, x: Math.max(0, o.x + dx), y: Math.max(0, o.y + dy) }
            : o
        )
      );
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeKey]);

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

  // 일반 박스 — 기본 텍스트(학생데이터). 추가 후 '선택 박스 설정'에서 종류·연결 지정.
  function addGeneralBox() {
    const page0 = pageNum - 1;
    const cx = (canvasRef.current?.width ?? 400) / scale / 2;
    const cy = (canvasRef.current?.height ?? 600) / scale / 2;
    const h = Math.round(defaultSize * 1.6);
    const key = uid();
    setOverlays((cur) => [
      ...cur,
      {
        key,
        page: page0,
        x: Math.max(0, cx - DEFAULT_W / 2),
        y: Math.max(0, cy - h / 2),
        w: DEFAULT_W,
        h,
        size: defaultSize,
        kind: "text",
        source: "student",
      },
    ]);
    setActiveKey(key);
  }

  const uid = () =>
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `box-${Math.round(performance.now())}-${Math.round(Math.random() * 1e6)}`;

  // 작성일 년/월/일 — 생성 시 정하는 날짜를 부분만 출력하는 3개 박스 (라벨 공유).
  function addDateParts() {
    const page0 = pageNum - 1;
    const cx = (canvasRef.current?.width ?? 400) / scale / 2;
    const cy = (canvasRef.current?.height ?? 600) / scale / 2;
    const h = Math.round(defaultSize * 1.6);
    const parts: Array<{ datePart: "year" | "month" | "day"; w: number }> = [
      { datePart: "year", w: 44 },
      { datePart: "month", w: 28 },
      { datePart: "day", w: 28 },
    ];
    let x = Math.max(0, cx - 60);
    const boxes: Overlay[] = parts.map((p) => {
      const box: Overlay = {
        key: uid(),
        page: page0,
        x,
        y: Math.max(0, cy - h / 2),
        w: p.w,
        h,
        size: defaultSize,
        kind: "text",
        source: "input",
        inputType: "date",
        inputLabel: "작성일",
        datePart: p.datePart,
      };
      x += p.w + 22; // 인쇄된 "년 월 일" 글자 자리만큼 띄움
      return box;
    });
    setOverlays((cur) => [...cur, ...boxes]);
    if (boxes[0]) setActiveKey(boxes[0].key);
  }

  // 가이드선 추가 (화면 가운데)
  function addGuide(axis: "x" | "y") {
    const canvas = canvasRef.current;
    const pos =
      axis === "x"
        ? Math.round((canvas ? canvas.width : 400) / scale / 2)
        : Math.round((canvas ? canvas.height : 600) / scale / 2);
    setGuides((g) => [...g, { id: uid(), axis, pos }]);
    setShowGuides(true);
  }

  // 가이드선 드래그 이동
  function startGuideDrag(e: React.PointerEvent, id: string, axis: "x" | "y") {
    e.preventDefault();
    e.stopPropagation();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const move = (ev: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const pos =
        axis === "x"
          ? Math.max(0, (ev.clientX - rect.left) / scale)
          : Math.max(0, (canvas.height - (ev.clientY - rect.top)) / scale);
      setGuides((g) =>
        g.map((x) => (x.id === id ? { ...x, pos: Math.round(pos) } : x))
      );
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
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
      // 선택된 박스를 클릭 위치로 이동 (종류·연결 유지)
      const y = Math.max(0, topPt - existing.h);
      setOverlays((cur) =>
        cur.map((o) => (o.key === activeKey ? { ...o, page: page0, x, y } : o))
      );
    }
  }

  // 박스 표시 라벨 (연결된 표준데이터를 보여줌 — 연결 안 되면 "연결필요")
  function boxLabel(o: Overlay): string {
    const kind = o.kind ?? "text";
    if (kind === "check")
      return o.dataKey ? `${labelOf(o.dataKey)} ✓` : "체크(연결필요)";
    if (kind === "image")
      return o.dataKey ? `[이미지] ${labelOf(o.dataKey)}` : "[이미지] 연결필요";
    if (kind === "signature")
      return o.dataKey ? `[사인] ${labelOf(o.dataKey)}` : "[사인] 연결필요";
    if (o.source === "static")
      return o.staticText ? `[고정] ${o.staticText}` : "[고정] 텍스트입력";
    if (o.source === "input") {
      const part =
        o.datePart === "year"
          ? "(년)"
          : o.datePart === "month"
            ? "(월)"
            : o.datePart === "day"
              ? "(일)"
              : "";
      if (!o.inputLabel && !o.datePart) return "[입력] 라벨필요";
      return `[입력] ${o.inputLabel || "작성일"}${part}`;
    }
    return o.dataKey ? labelOf(o.dataKey) : `${labelOf(o.key)} (연결필요)`;
  }

  /** 연결/설정이 필요한 미완성 박스 여부 (테두리 강조용). */
  function boxIncomplete(o: Overlay): boolean {
    const kind = o.kind ?? "text";
    if (kind === "image" || kind === "signature" || kind === "check")
      return !o.dataKey;
    if (kind === "text" && o.source === "static") return !o.staticText;
    if (kind === "text" && o.source === "input")
      return !o.inputLabel && !o.datePart;
    return !o.dataKey; // text/student
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
            let nx = Math.max(0, orig.x + dxPt);
            let ny = Math.max(0, orig.y - dyPt);
            // 가이드 스냅: 왼/오른쪽 모서리 → 세로선, 아래/위 모서리 → 가로선
            const sl = snapTo(nx, "x");
            if (sl != null) nx = sl;
            else {
              const sr = snapTo(nx + orig.w, "x");
              if (sr != null) nx = Math.max(0, sr - orig.w);
            }
            const sb = snapTo(ny, "y");
            if (sb != null) ny = sb;
            else {
              const st = snapTo(ny + orig.h, "y");
              if (st != null) ny = Math.max(0, st - orig.h);
            }
            return { ...o, x: nx, y: ny };
          }
          // resize: 좌상단 고정, 우하단을 끌어 너비·높이 변경 (+ 가이드 스냅)
          let w = Math.max(20, orig.w + dxPt);
          let h = Math.max(8, orig.h + dyPt);
          const sr = snapTo(orig.x + w, "x");
          if (sr != null) w = Math.max(20, sr - orig.x);
          const sb = snapTo(top - h, "y");
          if (sb != null) h = Math.max(8, top - sb);
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
      // 성별 체크박스 자동 생성용 — gender 항목 + 남/여 표식 위치
      const genderChoice = choices.find(
        (c) => c.key === "gender" || /성별|gender/i.test(c.label)
      );
      const genderMarks: Array<{
        page0: number;
        xPt: number;
        yPt: number;
        which: "male" | "female";
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
        type Rect = { left: number; right: number; top: number; bottom: number };
        const rectToBox = (c: Rect) => {
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
        // 라벨이 든 칸(특수 박스용)
        const cellBox = (cx: number, cy: number) => {
          const c = cellAt(grid, cx, cy);
          return c ? rectToBox(c) : null;
        };
        // 값 영역: (A)라벨 다음~칸끝 vs (B)오른쪽 칸 중 더 넓은 쪽. 오른쪽 끝은 다음 라벨 직전까지.
        const valueBox = (
          midCx: number,
          endCx: number,
          cy: number,
          limitCx: number
        ) => {
          const lc = cellAt(grid, midCx, cy);
          if (!lc) return null;
          // A: 같은 칸 라벨 뒤 여유
          const aLeft = Math.max(lc.left, endCx + 4);
          const aRight = Math.min(lc.right, limitCx);
          const aW = aRight - aLeft;
          // B: 오른쪽 칸
          let nextRight = Infinity;
          for (const v of grid.vX) {
            if (v > lc.right + 1 && v < nextRight) nextRight = v;
          }
          const bLeft = lc.right;
          const bRight = Math.min(isFinite(nextRight) ? nextRight : lc.right, limitCx);
          const bW = bRight - bLeft;
          // 더 넓은 영역 선택 (B가 의미있게 넓으면 B)
          if (bW > aW && bW > 20) {
            return rectToBox({ left: bLeft, right: bRight, top: lc.top, bottom: lc.bottom });
          }
          return rectToBox({ left: aLeft, right: aRight, top: lc.top, bottom: lc.bottom });
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

        // 성별: 옵션 표식("남( )","여( )") 위치에 체크박스 자동 생성
        if (genderChoice) {
          for (const t of texts) {
            if (!/[()（）]/.test(t.str)) continue; // 옵션 괄호가 있는 항목만
            const W = t.endX - t.x;
            const at = (token: string, which: "male" | "female") => {
              const idx = t.str.indexOf(token);
              if (idx < 0) return;
              const frac = (idx + 0.9) / Math.max(1, t.str.length);
              genderMarks.push({
                page0: p - 1,
                xPt: t.x + frac * W,
                yPt: t.y,
                which,
              });
            };
            at("남", "male");
            at("여", "female");
          }
        }

        for (const t of texts) {
          if (t.str.length > 24) continue;
          if (!/[A-Za-z가-힣]/.test(t.str)) continue;
          const special = inferSpecialKind(t.str);

          let box: { x: number; y: number; w: number; h: number } | null = null;
          const mid = toCanvas((t.x + t.endX) / 2, t.y);
          const endC = toCanvas(t.endX, t.y);
          // 같은 행에서 오른쪽으로 가장 가까운 다음 라벨 시작점 → 값 박스가 넘지 않게
          let nextTextPt = Infinity;
          for (const o of texts) {
            if (o !== t && Math.abs(o.y - t.y) <= 4 && o.x > t.endX)
              nextTextPt = Math.min(nextTextPt, o.x);
          }
          const limitCx = isFinite(nextTextPt)
            ? toCanvas(nextTextPt, t.y).cx - 3
            : Infinity;
          if (special) {
            // 사진/서명/날짜: 라벨이 들어있는 칸
            box = cellBox(mid.cx, mid.cy);
          } else {
            // 학생데이터: 라벨 칸의 값 영역(같은 칸 여유 or 오른쪽 칸, 다음 라벨 직전까지)
            box = valueBox(mid.cx, endC.cx, mid.cy, limitCx);
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

      // 이미 배치/연결된 항목 키 (박스 key + dataKey 둘 다)
      const placed = new Set(
        overlays.flatMap((o) => [o.key, o.dataKey].filter(Boolean) as string[])
      );
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
          // 서명→signature, 사진→document_photo 항목에 자동 연결(있으면)
          const dataKey =
            c.special.kind === "signature"
              ? choices.find((ch) => ch.key === "signature")?.key
              : choices.find(
                  (ch) => ch.key === "document_photo" || /사진/.test(ch.label)
                )?.key;
          additions.push({
            key: newKey(),
            page: c.page0,
            x: c.box.x,
            y: Math.max(0, c.box.y),
            w: Math.round(c.box.w),
            h: Math.round(c.box.h),
            size: defaultSize,
            kind: c.special.kind,
            ...(dataKey ? { dataKey } : {}),
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

      // 1-b) 성별 체크박스 — 남/여 표식마다 (gender 항목에 매치값 male/female)
      if (genderChoice) {
        const seenG = new Set<string>();
        for (const g of genderMarks) {
          const gk = `${g.page0}:${g.which}`;
          if (seenG.has(gk)) continue;
          seenG.add(gk);
          additions.push({
            key: newKey(),
            page: g.page0,
            x: Math.max(0, g.xPt),
            y: Math.max(0, g.yPt - 2),
            w: 12,
            h: 12,
            size: defaultSize,
            kind: "check",
            dataKey: genderChoice.key,
            matchValue: g.which,
          });
        }
      }

      // 2) 학생데이터 텍스트 — 별칭 매칭 (특수 아닌 후보만)
      const genderHandled = !!genderChoice && genderMarks.length > 0;
      const textCands = cands.filter((c) => !c.special && !c.crowded);
      const bestByKey = new Map<string, { score: number; cand: Cand }>();
      for (const ch of choices) {
        if (placed.has(ch.key)) continue;
        if (genderHandled && ch.key === genderChoice.key) continue; // 체크로 처리됨
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">문서 자동화 설정</h2>
          <p className="text-xs text-muted-foreground">
            <strong>자동 배치</strong>로 한번에 잡고, 박스를 드래그·크기조절해 보정하세요.
            (박스 {placedCount}개)
          </p>
        </div>
        <div className="flex items-center gap-2">
          {overlays.length > 0 ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOverlays([]);
                toast.message("박스를 모두 지웠습니다. ‘자동 배치’를 누르세요.");
              }}
              disabled={autoBusy}
            >
              <Trash2 className="size-4" />
              전체 지우기
            </Button>
          ) : null}
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

      {/* 좌: 박스추가·선택설정·배치할박스 / 우: 양식 캔버스 */}
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="space-y-4 lg:w-80 lg:shrink-0">
      {/* 박스 추가 + 자동완성 */}
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" disabled={!ready} onClick={addGeneralBox}>
            + 박스 추가
          </Button>
          <span className="text-[11px] text-muted-foreground">자동완성</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!ready}
            onClick={addDateParts}
          >
            작성일(년·월·일)
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          박스를 추가하면 화면 가운데 생깁니다(기본=학생 정보). 드래그로 위치,
          우하단 모서리로 크기 조절. 종류·연결은 아래 “선택 박스 설정”에서.
        </p>
      </div>

      {/* 선택 박스 설정 (선택된 박스 1개) */}
      <div className="rounded-md border bg-muted/20 p-3 text-xs">
        {(() => {
          const i = overlays.findIndex((o) => o.key === activeKey);
          const o = i >= 0 ? overlays[i] : null;
          if (!o)
            return (
              <p className="text-muted-foreground">
                박스를 선택하면 여기서 종류·연결·값을 설정합니다.
              </p>
            );
          const patch = (p: Partial<Overlay>) =>
            setOverlays((cur) => cur.map((x, j) => (j === i ? { ...x, ...p } : x)));
          const kind = o.kind ?? "text";
          const kindSel =
            kind === "text"
              ? o.source === "input"
                ? "text:input"
                : o.source === "static"
                  ? "text:static"
                  : "text:student"
              : kind;
          const dataSelect = (
            <select
              value={o.dataKey ?? ""}
              onChange={(e) => patch({ dataKey: e.target.value || undefined })}
              className="mt-0.5 h-7 w-full rounded-md border border-input bg-background px-1 text-xs"
            >
              <option value="">(연결할 표준데이터 선택)</option>
              {choices.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          );
          return (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">박스 #{i + 1} 설정</span>
                <button
                  type="button"
                  onClick={() => setOverlays((cur) => cur.filter((_, j) => j !== i))}
                  className="text-muted-foreground hover:text-destructive"
                  title="삭제"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              <label className="block text-[11px] text-muted-foreground">
                종류
                <select
                  value={kindSel}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "text:student") patch({ kind: "text", source: "student" });
                    else if (v === "text:input")
                      patch({ kind: "text", source: "input", inputType: o.inputType ?? "date" });
                    else if (v === "text:static") patch({ kind: "text", source: "static" });
                    else patch({ kind: v as OverlayKind, source: undefined });
                  }}
                  className="mt-0.5 h-7 w-full rounded-md border border-input bg-background px-1 text-xs"
                >
                  <option value="text:student">학생 정보로 자동 완성</option>
                  <option value="text:input">문서 생성할 때 작성</option>
                  <option value="text:static">고정된 텍스트</option>
                  <option value="check">체크</option>
                  <option value="image">이미지</option>
                  <option value="signature">사인</option>
                </select>
              </label>

              {kind === "text" && o.source === "static" ? (
                <label className="block text-[11px] text-muted-foreground">
                  고정 텍스트
                  <input
                    value={o.staticText ?? ""}
                    onChange={(e) => patch({ staticText: e.target.value })}
                    placeholder="예: ✓ · 해당"
                    className="mt-0.5 h-7 w-full rounded-md border border-input bg-background px-2 text-xs"
                  />
                </label>
              ) : kind === "text" && o.source === "input" ? (
                <div className="space-y-1">
                  <label className="block text-[11px] text-muted-foreground">
                    입력 라벨
                    <input
                      value={o.inputLabel ?? ""}
                      onChange={(e) => patch({ inputLabel: e.target.value })}
                      placeholder="예: 작성일"
                      className="mt-0.5 h-7 w-full rounded-md border border-input bg-background px-2 text-xs"
                    />
                  </label>
                  <div className="flex gap-1">
                    <select
                      value={o.inputType ?? "date"}
                      onChange={(e) => patch({ inputType: e.target.value as "date" | "text" })}
                      className="h-7 flex-1 rounded-md border border-input bg-background px-1 text-xs"
                    >
                      <option value="date">날짜</option>
                      <option value="text">텍스트</option>
                    </select>
                    {o.inputType !== "text" ? (
                      <select
                        value={o.datePart ?? ""}
                        onChange={(e) =>
                          patch({
                            datePart:
                              (e.target.value as "year" | "month" | "day") || undefined,
                          })
                        }
                        className="h-7 flex-1 rounded-md border border-input bg-background px-1 text-xs"
                        title="날짜 일부만 (년/월/일 분리 칸)"
                      >
                        <option value="">전체</option>
                        <option value="year">년</option>
                        <option value="month">월</option>
                        <option value="day">일</option>
                      </select>
                    ) : null}
                  </div>
                </div>
              ) : kind === "check" ? (
                <div className="space-y-1">
                  <label className="block text-[11px] text-muted-foreground">
                    연결 표준데이터{dataSelect}
                  </label>
                  <label className="block text-[11px] text-muted-foreground">
                    일치값
                    <input
                      value={o.matchValue ?? ""}
                      onChange={(e) => patch({ matchValue: e.target.value })}
                      placeholder="예: male"
                      className="mt-0.5 h-7 w-full rounded-md border border-input bg-background px-2 text-xs"
                    />
                  </label>
                </div>
              ) : (
                <label className="block text-[11px] text-muted-foreground">
                  연결 표준데이터{dataSelect}
                </label>
              )}

              <p className="text-[10px] text-muted-foreground">
                박스 {Math.round(o.w)}×{Math.round(o.h)} · 페이지 {o.page + 1}
              </p>
            </div>
          );
        })()}
      </div>

      {/* 배치할 박스 (번호 목록) */}
      <div className="space-y-1.5">
        <span className="text-xs font-medium">배치할 박스 ({overlays.length})</span>
        {overlays.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            아직 없음. 위 “박스 추가”로 만드세요.
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {overlays.map((o, i) => {
              const on = o.key === activeKey;
              return (
                <button
                  type="button"
                  key={o.key}
                  onClick={() => {
                    setActiveKey(o.key);
                    setPageNum(o.page + 1);
                  }}
                  className={`flex items-center gap-2 rounded-md border px-2 py-1 text-left text-xs ${
                    on
                      ? "border-amber-500 bg-amber-50 text-amber-800"
                      : boxIncomplete(o)
                        ? "border-red-300 bg-red-50/40"
                        : "border-input hover:bg-muted"
                  }`}
                >
                  <span className="inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-slate-700 text-[10px] font-medium text-white">
                    {i + 1}
                  </span>
                  <span className="truncate">{boxLabel(o)}</span>
                  <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                    P{o.page + 1}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

        </div>
        {/* ── 오른쪽: 양식 캔버스 ── */}
        <div className="min-w-0 flex-1 space-y-3">
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

      {/* 정렬 가이드선 */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-medium">가이드선</span>
        <Button type="button" variant="outline" size="sm" onClick={() => addGuide("y")}>
          + 가로선
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => addGuide("x")}>
          + 세로선
        </Button>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={showGuides}
            onChange={(e) => setShowGuides(e.target.checked)}
          />
          표시
        </label>
        {guides.length > 0 ? (
          <button
            type="button"
            onClick={() => setGuides([])}
            className="text-muted-foreground underline hover:text-destructive"
          >
            전체 삭제
          </button>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground">
        파란 박스 = 채움 영역. <strong>드래그</strong>로 이동,{" "}
        <strong>우하단 모서리</strong>로 크기 조절. 선택 후 <strong>화살표키</strong>로
        1pt(Shift=10pt) 미세 이동. 분홍 가이드선 근처에선 자동으로 붙습니다. 왼쪽 위
        숫자 = 박스 번호.
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
          {/* 정렬 가이드선 (분홍). 핸들로 이동, ×로 삭제. */}
          {showGuides
            ? guides.map((g) =>
                g.axis === "x" ? (
                  <div
                    key={g.id}
                    style={{ left: g.pos * scale }}
                    className="pointer-events-none absolute top-0 z-20 h-full w-px bg-fuchsia-500/70"
                  >
                    <span
                      onPointerDown={(e) => startGuideDrag(e, g.id, "x")}
                      className="pointer-events-auto absolute top-1 -left-1 size-2.5 cursor-ew-resize rounded-full bg-fuchsia-500"
                      title="가이드 이동"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setGuides((arr) => arr.filter((x) => x.id !== g.id))
                      }
                      className="pointer-events-auto absolute top-5 -left-2 flex size-4 items-center justify-center rounded-full bg-fuchsia-500 text-[9px] text-white"
                      title="가이드 삭제"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div
                    key={g.id}
                    style={{ top: canvasH - g.pos * scale }}
                    className="pointer-events-none absolute left-0 z-20 h-px w-full bg-fuchsia-500/70"
                  >
                    <span
                      onPointerDown={(e) => startGuideDrag(e, g.id, "y")}
                      className="pointer-events-auto absolute left-1 -top-1 size-2.5 cursor-ns-resize rounded-full bg-fuchsia-500"
                      title="가이드 이동"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setGuides((arr) => arr.filter((x) => x.id !== g.id))
                      }
                      className="pointer-events-auto absolute left-5 -top-2 flex size-4 items-center justify-center rounded-full bg-fuchsia-500 text-[9px] text-white"
                      title="가이드 삭제"
                    >
                      ×
                    </button>
                  </div>
                )
              )
            : null}
          {/* 현재 페이지 채움 박스 */}
          {pageOverlays.map((o) => {
            const left = o.x * scale;
            const top = canvasH - (o.y + o.h) * scale;
            const on = o.key === activeKey;
            const fs = (o.size ?? DEFAULT_SIZE) * scale;
            const num = overlays.indexOf(o) + 1;
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
                className={`absolute box-border cursor-move rounded-[2px] border ${
                  on
                    ? "border-amber-500 bg-amber-300/20"
                    : boxIncomplete(o)
                      ? "border-2 border-dashed border-red-400 bg-red-300/10"
                      : "border-sky-500 bg-sky-300/15"
                }`}
                title="드래그=이동 · 우하단 모서리=크기조절 · ×=삭제"
              >
                {/* 박스 번호 (좌상단) */}
                <span
                  className={`pointer-events-none absolute -left-2 -top-2 z-10 flex size-4 items-center justify-center rounded-full text-[9px] font-bold text-white ${
                    on ? "bg-amber-600" : "bg-slate-700"
                  }`}
                >
                  {num}
                </span>
                <span
                  style={{ fontSize: Math.max(7, Math.min(fs, 13)), lineHeight: 1.1 }}
                  className={`pointer-events-none flex h-full w-full items-center overflow-hidden whitespace-nowrap px-0.5 font-medium ${
                    on ? "text-amber-700" : "text-sky-700"
                  }`}
                >
                  {boxLabel(o)}
                </span>
                {/* 삭제 버튼 */}
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    setOverlays((cur) => cur.filter((x) => x.key !== o.key));
                  }}
                  title="삭제"
                  className="absolute -right-2 -top-2 flex size-4 items-center justify-center rounded-full bg-red-500 text-white shadow hover:bg-red-600"
                >
                  <X className="size-3" />
                </button>
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
        </div>
      </div>
      {/* ── 2단 레이아웃 끝 ── */}

    </div>
  );
}
