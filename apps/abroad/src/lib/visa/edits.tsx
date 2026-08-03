"use client";

/**
 * 텍스트 편집 + 다국어(한국어/베트남어) 오버레이.
 *
 * 값 우선순위(언어별): localStorage(미저장 임시) > overrides.{lang}.json(커밋됨) > 원본 데이터(ko 한정).
 *  - path(안정 키)로 식별: "doc:{id}:name", "dyn:balance:period:certified" 등.
 *  - 한국어(ko)는 원본 데이터가 기본값. 베트남어(vi)는 번역이 없으면 빈 값("").
 *  - 표시: 언어=ko → 한국어만. 언어=vi → 한국어 + (번역 있으면) 그 아래 베트남어 병기.
 *  - 편집(/edit): editLang 으로 한국어/베트남어를 전환해 각각 저장.
 *  - '소스에 저장'은 두 언어 오버레이 파일을 함께 기록(개발 서버 전용).
 */
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { VI } from "@/lib/visa/i18n";

type EditMap = Record<string, string>;
export type Lang = "ko" | "vi";
export type OverrideSet = Record<Lang, EditMap>;

export const LANG_LABEL: Record<Lang, string> = { ko: "한국어", vi: "Tiếng Việt" };

// 오버라이드(편집분)는 provider prop 으로 주입한다(유학센터: Supabase DB에서 로드).
const EMPTY_OVERRIDES: OverrideSet = { ko: {}, vi: {} };
const LS: Record<Lang, string> = { ko: "visa-text-edits-v1", vi: "visa-text-edits-vi-v1" };
const LS_LANG = "visa-lang";

interface EditCtx {
  // 표시 언어(공개 화면)
  lang: Lang;
  setLang: (l: Lang) => void;
  // 편집 모드(/edit)
  editMode: boolean;
  toggle: () => void;
  editLang: Lang;
  setEditLang: (l: Lang) => void;
  // 읽기
  getKo: (path: string, original: string) => string;
  getVi: (path: string) => string;
  setKo: (path: string, value: string) => void;
  // 활성 편집 언어 기준 읽기/쓰기(EditableText 용)
  getEdit: (path: string, koFallback: string) => string;
  setEdit: (path: string, value: string) => void;
  // 툴바
  edits: Record<Lang, EditMap>;
  reset: () => void;
  load: (m: EditMap) => void;
  saveToSource: () => Promise<number>;
}

const Ctx = createContext<EditCtx | null>(null);

export function EditProvider({
  children,
  defaultOn = false,
  overrides = EMPTY_OVERRIDES,
  readOnly = false,
}: {
  children: React.ReactNode;
  defaultOn?: boolean;
  /** DB에서 로드한 편집분(경로→값). 유학센터에서 주입. */
  overrides?: OverrideSet;
  /** 읽기 전용(편집 UI·localStorage 비활성) */
  readOnly?: boolean;
}) {
  const OVERRIDES = overrides;
  const [editMode, setEditMode] = useState(defaultOn);
  const [editLang, setEditLang] = useState<Lang>("ko");
  const [lang, setLangState] = useState<Lang>("ko");
  const [koEdits, setKoEdits] = useState<EditMap>({});
  const [viEdits, setViEdits] = useState<EditMap>({});

  useEffect(() => {
    try {
      const ko = localStorage.getItem(LS.ko);
      if (ko) setKoEdits(JSON.parse(ko));
      const vi = localStorage.getItem(LS.vi);
      if (vi) setViEdits(JSON.parse(vi));
      const l = localStorage.getItem(LS_LANG);
      if (l === "ko" || l === "vi") setLangState(l);
    } catch {}
  }, []);
  useEffect(() => { try { localStorage.setItem(LS.ko, JSON.stringify(koEdits)); } catch {} }, [koEdits]);
  useEffect(() => { try { localStorage.setItem(LS.vi, JSON.stringify(viEdits)); } catch {} }, [viEdits]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(LS_LANG, l); } catch {}
  }, []);

  const getKo = useCallback(
    (path: string, original: string) => (path in koEdits ? koEdits[path] : path in OVERRIDES.ko ? OVERRIDES.ko[path] : original),
    [koEdits]
  );
  const getVi = useCallback(
    (path: string) => (path in viEdits ? viEdits[path] : path in OVERRIDES.vi ? OVERRIDES.vi[path] : ""),
    [viEdits]
  );
  const setKo = useCallback((path: string, value: string) => setKoEdits((e) => ({ ...e, [path]: value })), []);
  const setVi = useCallback((path: string, value: string) => setViEdits((e) => ({ ...e, [path]: value })), []);

  // 편집 화면: vi 는 저장된 번역이 없으면 사전(VI[현재 한국어]) 값을 초기값으로 보여준다.
  const getEdit = useCallback(
    (path: string, koFallback: string) => (editLang === "ko" ? getKo(path, koFallback) : getVi(path) || VI[getKo(path, koFallback)] || ""),
    [editLang, getKo, getVi]
  );
  const setEdit = useCallback((path: string, value: string) => (editLang === "ko" ? setKo(path, value) : setVi(path, value)), [editLang, setKo, setVi]);

  const reset = useCallback(() => (editLang === "ko" ? setKoEdits({}) : setViEdits({})), [editLang]);
  const load = useCallback((m: EditMap) => (editLang === "ko" ? setKoEdits(m) : setViEdits(m)), [editLang]);

  const saveToSource = useCallback(async () => {
    const body = {
      ko: { ...OVERRIDES.ko, ...koEdits },
      vi: { ...OVERRIDES.vi, ...viEdits },
    };
    const res = await fetch("/api/overrides", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(j.error || `HTTP ${res.status}`);
    }
    const j = (await res.json()) as { count: number };
    return j.count;
  }, [koEdits, viEdits]);

  return (
    <Ctx.Provider
      value={{
        lang, setLang,
        editMode, toggle: () => setEditMode((m) => !m),
        editLang, setEditLang,
        getKo, getVi, setKo, getEdit, setEdit,
        edits: { ko: koEdits, vi: viEdits },
        reset, load, saveToSource,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useEdit(): EditCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useEdit must be used within EditProvider");
  return c;
}

function biStack( koVal: string, viVal: string, viStyle?: React.CSSProperties) {
  return (
    <span style={{ display: "inline-block" }}>
      <span style={{ display: "block" }}>{koVal}</span>
      <span style={{ display: "block", color: "var(--ink-light)", fontSize: "0.92em", fontStyle: "italic", marginTop: 1, ...viStyle }}>{viVal}</span>
    </span>
  );
}

/**
 * 병기 표시(내용). 표시 언어가 ko 면 한국어만, vi 면 한국어 + 그 아래 베트남어.
 * 번역 우선순위: 사용자 편집(overrides.vi/localStorage) > 사전(VI) > 없으면 한국어만.
 */
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

/** UI 문자열 훅 — placeholder 등 JSX 를 못 쓰는 곳(병기 불가): vi 면 번역, 없으면 한국어. */
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
      style={{
        border: "none",
        background: lang === l ? "#fff" : "transparent",
        color: lang === l ? "var(--coral-d)" : "#fff",
        fontWeight: 800,
        fontSize: 12.5,
        padding: "5px 12px",
        borderRadius: 999,
        cursor: "pointer",
      }}
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

/** 내용에 맞춰 높이가 자동으로 늘어나는 textarea (길이·줄바꿈 자유). */
function AutoTextarea({ value, onChange, placeholder, style }: { value: string; onChange: (v: string) => void; placeholder?: string; style?: React.CSSProperties }) {
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const resize = React.useCallback(() => {
    const el = ref.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = el.scrollHeight + 2 + "px";
    }
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
 * 편집 모드면 자동높이 textarea. 베트남어 편집 시 한국어 원문을 placeholder 로 보여준다.
 */
export function EditableText({
  path,
  value,
  style,
}: {
  path: string;
  value: string;
  multiline?: boolean;
  style?: React.CSSProperties;
}) {
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

/** 편집 툴바 — 편집 on/off, 언어 전환, 변경 개수, 소스 저장/내보내기/불러오기/초기화. */
export function EditToolbar() {
  const { editMode, toggle, editLang, setEditLang, edits, reset, load, saveToSource } = useEdit();
  const count = Object.keys(edits[editLang]).length;
  const [saveState, setSaveState] = useState<"idle" | "saving" | "done" | "err">("idle");
  const [saveMsg, setSaveMsg] = useState("");

  const doSave = async () => {
    setSaveState("saving");
    setSaveMsg("");
    try {
      const n = await saveToSource();
      setSaveMsg(`소스에 저장됨 · ${n}건 (커밋·배포하면 모두에게 반영)`);
      setSaveState("done");
      setTimeout(() => setSaveState("idle"), 4000);
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : String(e));
      setSaveState("err");
    }
  };

  const exportJson = () => {
    const text = JSON.stringify(edits[editLang], null, 2);
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `visa-text-edits-${editLang}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const importJson = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          load(JSON.parse(String(r.result)));
        } catch {
          alert("JSON 파싱 실패");
        }
      };
      r.readAsText(f);
    };
    input.click();
  };

  const btn: React.CSSProperties = { border: "1px solid var(--bdr-d)", background: "#fff", color: "var(--ink-mid)", padding: "6px 11px", borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: "pointer" };
  const langBtn = (l: Lang) => (
    <button
      key={l}
      onClick={() => setEditLang(l)}
      style={{ ...btn, border: "none", background: editLang === l ? "var(--navy)" : "var(--peach)", color: editLang === l ? "#fff" : "var(--ink-mid)" }}
    >
      {LANG_LABEL[l]}
    </button>
  );

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 14, background: editMode ? "#fff7f5" : "#fff", border: `1px solid ${editMode ? "var(--coral-l)" : "var(--bdr)"}`, borderRadius: 12, padding: "10px 12px" }}>
      <button onClick={toggle} style={{ ...btn, border: "none", background: editMode ? "var(--coral)" : "var(--ink-mid)", color: "#fff" }}>
        {editMode ? "✓ 편집 모드 (켜짐)" : "✏ 편집 모드"}
      </button>
      {editMode && (
        <>
          <span style={{ fontSize: 12, color: "var(--ink-light)", fontWeight: 700 }}>편집 언어</span>
          {langBtn("ko")}
          {langBtn("vi")}
          <span style={{ fontSize: 12.5, color: "var(--ink-light)" }}>변경 {count}건</span>
          <button onClick={doSave} disabled={saveState === "saving"} style={{ ...btn, border: "none", background: "var(--coral)", color: "#fff", cursor: saveState === "saving" ? "default" : "pointer" }}>
            {saveState === "saving" ? "저장 중…" : "💾 소스에 저장(배포용)"}
          </button>
          <span style={{ flex: 1 }} />
          <button onClick={exportJson} style={btn}>내보내기(JSON)</button>
          <button onClick={importJson} style={btn}>불러오기</button>
          <button onClick={() => { if (confirm(`${LANG_LABEL[editLang]} 편집을 모두 초기화할까요?`)) reset(); }} style={{ ...btn, color: "#b3261e", borderColor: "#f3c6c1" }}>초기화</button>
        </>
      )}
      {editMode && saveState !== "idle" && saveMsg && (
        <span style={{ width: "100%", fontSize: 12, fontWeight: 700, color: saveState === "err" ? "#b3261e" : "var(--coral-d)" }}>
          {saveState === "err" ? `저장 실패: ${saveMsg}` : `✓ ${saveMsg}`}
        </span>
      )}
      {editMode && (
        <span style={{ width: "100%", fontSize: 11.5, color: "var(--ink-light)" }}>
          <b>편집 언어</b>를 <b>Tiếng Việt</b> 로 바꾸면 각 칸에 베트남어 번역을 넣습니다(한국어 원문은 흐린 안내로 표시). <b>💾 소스에 저장</b>은 한국어·베트남어 오버레이를 함께 파일에 기록합니다 — 커밋·배포하면 모두에게 반영. (운영 사이트에서는 저장 비활성화)
        </span>
      )}
    </div>
  );
}
