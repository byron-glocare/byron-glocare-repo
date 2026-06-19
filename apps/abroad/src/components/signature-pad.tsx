"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

export type SignaturePadHandle = {
  /** 서명이 비어 있으면 null, 아니면 PNG dataURL 반환 */
  toDataURL: () => string | null;
  clear: () => void;
  isEmpty: () => boolean;
};

const CANVAS_W = 600;
const CANVAS_H = 200;

/**
 * 마우스/터치/펜으로 서명을 그리는 캔버스 패드.
 *   - 고정 내부 해상도(600×200) + CSS 로 가로 100% 반응.
 *   - Pointer Events 로 마우스·터치·스타일러스 통합 처리.
 *   - ref 로 toDataURL()/clear()/isEmpty() 노출.
 */
export const SignaturePad = forwardRef<
  SignaturePadHandle,
  {
    disabled?: boolean;
    onChange?: (empty: boolean) => void;
    className?: string;
  }
>(function SignaturePad({ disabled, onChange, className }, ref) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [empty, setEmpty] = useState(true);

  // 캔버스 초기화 — 배경을 칠하지 않는다(투명 PNG).
  //   원본 양식의 "(인)" 같은 글자 위에 겹쳐도 흰 박스로 가리지 않고
  //   서명 획만 얹히도록. 편집 화면은 CSS bg-white 라 흰색으로 보인다.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#0f172a";
  }, []);

  const setEmptyState = (v: boolean) => {
    setEmpty(v);
    onChange?.(v);
  };

  useImperativeHandle(ref, () => ({
    toDataURL: () => {
      if (empty) return null;
      return canvasRef.current?.toDataURL("image/png") ?? null;
    },
    isEmpty: () => empty,
    clear: () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      setEmptyState(true);
    },
  }));

  // 화면 좌표 → 캔버스 내부 좌표
  const toCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    return { x, y };
  };

  const handleDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = toCanvasPoint(e);
  };

  const handleMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || disabled) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !last.current) return;
    const p = toCanvasPoint(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    if (empty) setEmptyState(false);
  };

  const handleUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    e.preventDefault();
    drawing.current = false;
    last.current = null;
  };

  return (
    <div className={`relative w-full ${className ?? ""}`}>
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerLeave={handleUp}
        onPointerCancel={handleUp}
        className={`w-full rounded-md border bg-white ${
          disabled ? "cursor-not-allowed opacity-60" : "cursor-crosshair"
        }`}
        style={{ touchAction: "none", aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}
      />
      {/* 작성 가이드 — DOM 오버레이라 캔버스(PNG)에는 포함되지 않는다.
          중심 기준 70% 영역을 점선으로 표시 + 안내. 그려지면 텍스트는 숨김. */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="flex h-[70%] w-[70%] items-center justify-center rounded border border-dashed border-slate-300/80">
          {empty ? (
            <span className="px-2 text-center text-[11px] leading-tight text-slate-400">
              해당 영역보다 크게 작성해주세요
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
});
