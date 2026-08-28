"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 날짜 입력 — 연/월/일 칸을 나눠 받는다.
 *
 * 네이티브 <input type="date"> 를 쓰지 않는 이유:
 *   1) 칸 순서가 **브라우저 언어**를 따른다. 화면을 한국어로 봐도 브라우저가
 *      베트남어면 dd/mm/yyyy 로 나온다. 우리 화면 언어와 어긋난다.
 *   2) 크롬은 연도 칸에 6자리까지 받는다(연도 275760 까지 지원). 실수로
 *      "19999" 같은 값이 들어간다.
 *
 * 제출 값은 네이티브와 동일하게 hidden input 으로 "yyyy-mm-dd" 를 낸다.
 * 그래서 이걸로 바꿔도 서버 액션·검증 코드는 그대로 둘 수 있다.
 */

export type DateOrder = "ymd" | "dmy";

/** 화면 언어 → 칸 순서. 한국어 yyyy-mm-dd, 베트남어 dd-mm-yyyy. */
export function dateOrderFor(locale: string): DateOrder {
  return locale === "ko" ? "ymd" : "dmy";
}

type Parts = { y: string; m: string; d: string };

function split(v: string | null | undefined): Parts {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((v ?? "").trim());
  return m ? { y: m[1], m: m[2], d: m[3] } : { y: "", m: "", d: "" };
}

/** 세 칸이 다 차야 날짜가 된다. 비면 빈 문자열(= 미입력). */
function join(p: Parts): string {
  if (p.y.length !== 4 || !p.m || !p.d) return "";
  const mm = p.m.padStart(2, "0");
  const dd = p.d.padStart(2, "0");
  return `${p.y}-${mm}-${dd}`;
}

const digits = (s: string) => s.replace(/\D/g, "");

export function DateInput({
  name,
  value: controlled,
  defaultValue,
  order = "ymd",
  required,
  disabled,
  className,
  onChange,
}: {
  /** 폼 제출용 이름. 없으면 hidden input 을 만들지 않는다(컨트롤드 전용). */
  name?: string;
  /** 컨트롤드로 쓸 때. 바깥 상태가 정본이 된다. */
  value?: string | null;
  /** 언컨트롤드로 쓸 때의 초기값. */
  defaultValue?: string | null;
  order?: DateOrder;
  required?: boolean;
  disabled?: boolean;
  /** 바깥 칸(각 input)에 입힐 클래스 */
  className?: string;
  onChange?: (value: string) => void;
}) {
  const [p, setP] = useState<Parts>(() => split(controlled ?? defaultValue));
  const yRef = useRef<HTMLInputElement>(null);
  const mRef = useRef<HTMLInputElement>(null);
  const dRef = useRef<HTMLInputElement>(null);

  const value = join(p);

  // 컨트롤드: 바깥에서 값이 바뀐 경우에만 칸을 다시 채운다.
  // 우리가 방금 낸 값까지 되받아 쓰면, 연도를 "20" 까지 쳤을 때 아직 날짜가
  // 완성되지 않아 빈 값이 내려오면서 입력하던 게 지워진다.
  useEffect(() => {
    if (controlled === undefined) return;
    if ((controlled ?? "") === value) return;
    setP(split(controlled));
  }, [controlled]); // eslint-disable-line react-hooks/exhaustive-deps

  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    onChange?.(value);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  /** 칸이 다 차면 다음 칸으로 넘긴다. 연도는 4자리에서 끊는다. */
  const set = (k: keyof Parts, raw: string, max: number, next?: HTMLInputElement | null) => {
    const v = digits(raw).slice(0, max);
    setP((prev) => ({ ...prev, [k]: v }));
    if (v.length === max) next?.focus();
  };

  /** 빈 칸에서 백스페이스 → 앞 칸으로. */
  const back = (k: keyof Parts, prevEl?: HTMLInputElement | null) =>
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace" && p[k] === "" && prevEl) {
        e.preventDefault();
        prevEl.focus();
      }
    };

  const box = className ?? "";
  const Y = (
    <input
      key="y"
      ref={yRef}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="YYYY"
      aria-label="연"
      maxLength={4}
      size={4}
      disabled={disabled}
      value={p.y}
      onChange={(e) => set("y", e.target.value, 4, mRef.current)}
      className={box}
      style={{ width: "5.5ch", textAlign: "center" }}
    />
  );
  const M = (
    <input
      key="m"
      ref={mRef}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="MM"
      aria-label="월"
      maxLength={2}
      size={2}
      disabled={disabled}
      value={p.m}
      onChange={(e) => set("m", e.target.value, 2, order === "ymd" ? dRef.current : yRef.current)}
      onKeyDown={back("m", order === "ymd" ? yRef.current : dRef.current)}
      className={box}
      style={{ width: "3.5ch", textAlign: "center" }}
    />
  );
  const D = (
    <input
      key="d"
      ref={dRef}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="DD"
      aria-label="일"
      maxLength={2}
      size={2}
      disabled={disabled}
      value={p.d}
      onChange={(e) => set("d", e.target.value, 2, order === "ymd" ? undefined : mRef.current)}
      onKeyDown={back("d", order === "ymd" ? mRef.current : undefined)}
      className={box}
      style={{ width: "3.5ch", textAlign: "center" }}
    />
  );

  const seq = order === "ymd" ? [Y, M, D] : [D, M, Y];

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      {seq[0]}
      <span aria-hidden>-</span>
      {seq[1]}
      <span aria-hidden>-</span>
      {seq[2]}
      {/* 제출 값은 네이티브 date 와 같은 형식 — 서버 코드는 그대로 둔다 */}
      {name ? <input type="hidden" name={name} value={value} /> : null}
      {/* 필수인데 미입력이면 브라우저 기본 검증에 걸리게 한다 */}
      {required ? (
        <input
          tabIndex={-1}
          aria-hidden
          required
          value={value}
          onChange={() => {}}
          style={{ position: "absolute", opacity: 0, width: 1, height: 1, pointerEvents: "none" }}
        />
      ) : null}
    </span>
  );
}
