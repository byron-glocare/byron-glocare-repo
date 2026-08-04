"use client";

/**
 * 다국어(한국어/베트남어) 오버레이 + 편집 컨텍스트 — 공유 패키지판.
 *
 * ⚠ overrides 는 **prop 으로 주입**받는다(하드 import 금지).
 *   - 비자앱: 자기 overrides.json/.vi.json 을 import 해서 주입 + persistKey 로 편집·localStorage.
 *   - center(소비자): DB 에서 받은 오버라이드를 주입 + readOnly (편집·저장 없음).
 *
 * 값 우선순위(언어별): localStorage 편집(편집 가능할 때) > overrides(prop) > 원본(ko) / "" (vi) > 사전(VI, Bi/T 표시용).
 * 저장 엔드포인트·EditToolbar·/edit 페이지는 각 앱에 남긴다(여기 없음).
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { VI } from "../data/i18n";

type EditMap = Record<string, string>;
export type Lang = "ko" | "vi";
export type Overrides = { ko?: EditMap; vi?: EditMap };

export const LANG_LABEL: Record<Lang, string> = { ko: "한국어", vi: "Tiếng Việt" };
const EMPTY: EditMap = {};

interface EditCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  editMode: boolean;
  toggle: () => void;
  editLang: Lang;
  setEditLang: (l: Lang) => void;
  readOnly: boolean;
  getKo: (path: string, original: string) => string;
  getVi: (path: string) => string;
  setKo: (path: string, value: string) => void;
  getEdit: (path: string, koFallback: string) => string;
  setEdit: (path: string, value: string) => void;
  edits: Record<Lang, EditMap>;
  overrides: Record<Lang, EditMap>;
  reset: () => void;
  load: (m: EditMap) => void;
}

const Ctx = createContext<EditCtx | null>(null);

export function EditProvider({
  children,
  overrides,
  readOnly = false,
  defaultOn = false,
  persistKey,
}: {
  children: React.ReactNode;
  /** { ko, vi } 오버라이드(path→값). 하드 import 하지 말고 앱/DB 에서 주입. */
  overrides?: Overrides;
  /** true 면 편집·localStorage 저장 없음(순수 표시). */
  readOnly?: boolean;
  /** 편집 모드 기본 on(readOnly 면 무시). */
  defaultOn?: boolean;
  /** 주면 localStorage 에 편집·표시언어를 보관(`{key}:ko|vi|lang`). */
  persistKey?: string;
}) {
  const canEdit = !readOnly;
  const OVERRIDES_KO = overrides?.ko ?? EMPTY;
  const OVERRIDES_VI = overrides?.vi ?? EMPTY;

  const [editMode, setEditMode] = useState(canEdit && defaultOn);
  const [editLang, setEditLang] = useState<Lang>("ko");
  const [lang, setLangState] = useState<Lang>("ko");
  const [koEdits, setKoEdits] = useState<EditMap>({});
  const [viEdits, setViEdits] = useState<EditMap>({});

  const koKey = persistKey ? `${persistKey}:ko` : null;
  const viKey = persistKey ? `${persistKey}:vi` : null;
  const langKey = persistKey ? `${persistKey}:lang` : null;

  useEffect(() => {
    try {
      if (canEdit && koKey) { const s = localStorage.getItem(koKey); if (s) setKoEdits(JSON.parse(s)); }
      if (canEdit && viKey) { const s = localStorage.getItem(viKey); if (s) setViEdits(JSON.parse(s)); }
      if (langKey) { const l = localStorage.getItem(langKey); if (l === "ko" || l === "vi") setLangState(l); }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (canEdit && koKey) try { localStorage.setItem(koKey, JSON.stringify(koEdits)); } catch {} }, [koEdits, canEdit, koKey]);
  useEffect(() => { if (canEdit && viKey) try { localStorage.setItem(viKey, JSON.stringify(viEdits)); } catch {} }, [viEdits, canEdit, viKey]);

  const setLang = useCallback((l: Lang) => { setLangState(l); if (langKey) try { localStorage.setItem(langKey, l); } catch {} }, [langKey]);

  const getKo = useCallback(
    (path: string, original: string) => (path in koEdits ? koEdits[path] : path in OVERRIDES_KO ? OVERRIDES_KO[path] : original),
    [koEdits, OVERRIDES_KO]
  );
  const getVi = useCallback(
    (path: string) => (path in viEdits ? viEdits[path] : path in OVERRIDES_VI ? OVERRIDES_VI[path] : ""),
    [viEdits, OVERRIDES_VI]
  );
  const setKo = useCallback((path: string, value: string) => { if (canEdit) setKoEdits((e) => ({ ...e, [path]: value })); }, [canEdit]);
  const setVi = useCallback((path: string, value: string) => { if (canEdit) setViEdits((e) => ({ ...e, [path]: value })); }, [canEdit]);

  // 편집 화면: vi 는 저장된 번역이 없으면 사전(VI[현재 한국어]) 값을 초기값으로.
  const getEdit = useCallback(
    (path: string, koFallback: string) => (editLang === "ko" ? getKo(path, koFallback) : getVi(path) || VI[getKo(path, koFallback)] || ""),
    [editLang, getKo, getVi]
  );
  const setEdit = useCallback((path: string, value: string) => (editLang === "ko" ? setKo(path, value) : setVi(path, value)), [editLang, setKo, setVi]);
  const reset = useCallback(() => { if (!canEdit) return; if (editLang === "ko") setKoEdits({}); else setViEdits({}); }, [editLang, canEdit]);
  const load = useCallback((m: EditMap) => { if (!canEdit) return; if (editLang === "ko") setKoEdits(m); else setViEdits(m); }, [editLang, canEdit]);

  const value = useMemo<EditCtx>(
    () => ({
      lang, setLang,
      editMode, toggle: () => { if (canEdit) setEditMode((m) => !m); },
      editLang, setEditLang, readOnly,
      getKo, getVi, setKo, getEdit, setEdit,
      edits: { ko: koEdits, vi: viEdits },
      overrides: { ko: OVERRIDES_KO, vi: OVERRIDES_VI },
      reset, load,
    }),
    [lang, setLang, editMode, canEdit, editLang, readOnly, getKo, getVi, setKo, getEdit, setEdit, koEdits, viEdits, OVERRIDES_KO, OVERRIDES_VI, reset, load]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useEdit(): EditCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useEdit must be used within EditProvider");
  return c;
}

function biStack(koVal: string, viVal: string, viStyle?: React.CSSProperties) {
  return (
    <span style={{ display: "inline-block" }}>
      <span style={{ display: "block" }}>{koVal}</span>
      <span style={{ display: "block", color: "var(--ink-light)", fontSize: "0.92em", fontStyle: "italic", marginTop: 1, ...viStyle }}>{viVal}</span>
    </span>
  );
}

/** 병기 표시(내용). ko 면 한국어만, vi 면 한국어 + 그 아래 베트남어. 우선순위: 편집/overrides > 사전(VI) > 한국어만. */
export function Bi({ path, ko, viStyle }: { path: string; ko: string; viStyle?: React.CSSProperties }) {
  const { lang, getKo, getVi } = useEdit();
  const koVal = getKo(path, ko);
  if (lang === "ko") return <>{koVal}</>;
  const viVal = getVi(path) || VI[koVal] || "";
  if (!viVal) return <>{koVal}</>;
  return biStack(koVal, viVal, viStyle);
}

/** 병기 표시(UI 텍스트). 사전(VI) 기반. */
export function T({ ko, viStyle }: { ko: string; viStyle?: React.CSSProperties }) {
  const { lang } = useEdit();
  if (lang === "ko") return <>{ko}</>;
  const vi = VI[ko] || "";
  if (!vi) return <>{ko}</>;
  return biStack(ko, vi, viStyle);
}

/** UI 문자열 훅 — placeholder 등 병기 불가한 곳: vi 면 번역, 없으면 한국어. */
export function useTStr() {
  const { lang } = useEdit();
  return useCallback((ko: string) => (lang === "vi" && VI[ko] ? VI[ko] : ko), [lang]);
}

/** 헤더용 언어 선택 (한국어 / Tiếng Việt). */
export function LanguageToggle() {
  const { lang, setLang } = useEdit();
  const opt = (l: Lang) => (
    <button
      key={l}
      onClick={() => setLang(l)}
      style={{ border: "none", background: lang === l ? "#fff" : "transparent", color: lang === l ? "var(--coral-d)" : "#fff", fontWeight: 800, fontSize: 12.5, padding: "5px 12px", borderRadius: 999, cursor: "pointer" }}
    >
      {LANG_LABEL[l]}
    </button>
  );
  return (
    <div style={{ display: "inline-flex", gap: 2, background: "rgba(255,255,255,.22)", borderRadius: 999, padding: 2 }}>
      {opt("ko")}
      {opt("vi")}
    </div>
  );
}

const fieldStyle: React.CSSProperties = {
  font: "inherit",
  color: "inherit",
  background: "#fffdf5",
  border: "1px solid var(--coral-l)",
  borderRadius: 6,
  padding: "2px 7px",
  outline: "none",
  boxSizing: "border-box",
  boxShadow: "0 0 0 2px rgba(242,92,92,.08)",
};

/** 내용에 맞춰 높이가 자동으로 늘어나는 textarea. */
function AutoTextarea({ value, onChange, placeholder, style }: { value: string; onChange: (v: string) => void; placeholder?: string; style?: React.CSSProperties }) {
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const resize = React.useCallback(() => {
    const el = ref.current;
    if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + 2 + "px"; }
  }, []);
  React.useEffect(() => { resize(); }, [value, resize]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onInput={resize}
      placeholder={placeholder}
      rows={1}
      style={{ ...fieldStyle, ...style, width: "100%", resize: "none", overflow: "hidden", lineHeight: 1.5, display: "block" }}
    />
  );
}

/**
 * 편집 가능한 텍스트. 편집 모드가 아니면 활성 편집 언어 값(없으면 한국어) 표시.
 * 편집 모드면 자동높이 textarea. 베트남어 편집 시 한국어 원문을 placeholder 로.
 */
export function EditableText({ path, value, style }: { path: string; value: string; multiline?: boolean; style?: React.CSSProperties }) {
  const { editMode, editLang, getEdit, setEdit, getVi } = useEdit();
  const cur = getEdit(path, value);
  if (!editMode) return <span style={style}>{cur || value}</span>;
  const changed = editLang === "ko" ? cur !== value : getVi(path) !== "";
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  return (
    <span style={{ display: "block", width: "100%" }} onClick={stop} onMouseDown={stop}>
      {changed ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
          <span title="수정됨" style={{ fontSize: 10, fontWeight: 800, color: "var(--coral-d)" }}>● {editLang === "vi" ? "VI" : ""} 수정됨</span>
        </span>
      ) : null}
      <AutoTextarea value={cur} placeholder={editLang === "vi" ? value : undefined} onChange={(v) => setEdit(path, v)} style={style} />
    </span>
  );
}
