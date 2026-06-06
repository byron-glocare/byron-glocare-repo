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

  // 캔버스 초기화 (흰 배경 — 투명 PNG 가 아니라 인쇄/표시 편하도록)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
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
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
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
      } ${className ?? ""}`}
      style={{ touchAction: "none", aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}
    />
  );
});
