"use client";

/**
 * 텍스트 편집 모드.
 *
 * 정적 사이트라 서버 저장이 없어 편집값은 localStorage 에 보관하고,
 * JSON 내보내기/불러오기로 백업·이관한다. (원본 데이터 파일은 그대로.)
 *
 * - 편집 대상은 path(안정적 키)로 식별: "doc:{id}:name", "rule:{id}:terse" 등.
 * - 여러 위치에서 참조되는 값(조항 terse 등)은 shared 카운트로 "공유 N곳" 표시.
 */
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import overridesRaw from "@/data/overrides.json";

type EditMap = Record<string, string>;

/**
 * 소스에 커밋된 편집값(개발 중 /api/overrides 로 저장). 배포에 실려 모든 방문자에게 반영.
 * 우선순위: 브라우저 localStorage(미저장 임시) > overrides.json(커밋됨) > 원본 데이터.
 */
const OVERRIDES = overridesRaw as EditMap;

interface EditCtx {
  editMode: boolean;
  toggle: () => void;
  get: (path: string, original: string) => string;
  set: (path: string, value: string) => void;
  clear: (path: string) => void;
  edits: EditMap;
  reset: () => void;
  load: (m: EditMap) => void;
  /** localStorage + overrides 를 합쳐 소스 파일(overrides.json)에 기록(개발 서버 전용). 저장 건수 반환. */
  saveToSource: () => Promise<number>;
}

const Ctx = createContext<EditCtx | null>(null);
const LS_KEY = "visa-text-edits-v1";

export function EditProvider({ children, defaultOn = false }: { children: React.ReactNode; defaultOn?: boolean }) {
  const [editMode, setEditMode] = useState(defaultOn);
  const [edits, setEdits] = useState<EditMap>({});

  useEffect(() => {
    try {
      const s = localStorage.getItem(LS_KEY);
      if (s) setEdits(JSON.parse(s));
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(edits));
    } catch {}
  }, [edits]);

  const get = useCallback(
    (path: string, original: string) => (path in edits ? edits[path] : path in OVERRIDES ? OVERRIDES[path] : original),
    [edits]
  );
  const set = useCallback((path: string, value: string) => setEdits((e) => ({ ...e, [path]: value })), []);
  const clear = useCallback((path: string) => setEdits((e) => { const n = { ...e }; delete n[path]; return n; }), []);
  const reset = useCallback(() => setEdits({}), []);
  const load = useCallback((m: EditMap) => setEdits(m), []);
  const saveToSource = useCallback(async () => {
    const merged: EditMap = { ...OVERRIDES, ...edits };
    const res = await fetch("/api/overrides", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(merged) });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(j.error || `HTTP ${res.status}`);
    }
    const j = (await res.json()) as { count: number };
    return j.count;
  }, [edits]);

  return (
    <Ctx.Provider value={{ editMode, toggle: () => setEditMode((m) => !m), get, set, clear, edits, reset, load, saveToSource }}>
      {children}
    </Ctx.Provider>
  );
}

export function useEdit(): EditCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useEdit must be used within EditProvider");
  return c;
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
function AutoTextarea({ value, onChange, style }: { value: string; onChange: (v: string) => void; style?: React.CSSProperties }) {
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
      rows={1}
      style={{ ...fieldStyle, ...style, width: "100%", resize: "none", overflow: "hidden", lineHeight: 1.5, display: "block" }}
    />
  );
}

/**
 * 편집 가능한 텍스트. 편집 모드가 아니면 그냥 텍스트, 편집 모드면 자동높이 textarea.
 * 길이·줄바꿈 제한 없음. shared>1 이면 "공유 N곳" 배지 노출.
 */
export function EditableText({
  path,
  value,
  shared,
  style,
}: {
  path: string;
  value: string;
  multiline?: boolean;
  shared?: number;
  style?: React.CSSProperties;
}) {
  const { editMode, get, set } = useEdit();
  const cur = get(path, value);

  if (!editMode) return <span style={style}>{cur}</span>;

  const changed = cur !== value;
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  return (
    <span style={{ display: "block", width: "100%" }} onClick={stop} onMouseDown={stop}>
      {(shared && shared > 1) || changed ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
          {shared && shared > 1 ? (
            <span
              title={`이 값은 ${shared}곳에 연결되어 있어, 수정하면 모두 함께 바뀝니다.`}
              style={{ fontSize: 10, fontWeight: 800, color: "#8a4b00", background: "#ffe8cc", border: "1px solid #f0c088", borderRadius: 999, padding: "0 6px", whiteSpace: "nowrap" }}
            >
              🔗 공유 {shared}곳
            </span>
          ) : null}
          {changed ? <span title="수정됨" style={{ fontSize: 10, fontWeight: 800, color: "var(--coral-d)" }}>● 수정됨</span> : null}
        </span>
      ) : null}
      <AutoTextarea value={cur} onChange={(v) => set(path, v)} style={style} />
    </span>
  );
}

/** 편집 툴바 — 편집 on/off, 변경 개수, 내보내기/불러오기/초기화. */
export function EditToolbar() {
  const { editMode, toggle, edits, reset, load, saveToSource } = useEdit();
  const count = Object.keys(edits).length;
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
    const text = JSON.stringify(edits, null, 2);
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "visa-text-edits.json";
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

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 14, background: editMode ? "#fff7f5" : "#fff", border: `1px solid ${editMode ? "var(--coral-l)" : "var(--bdr)"}`, borderRadius: 12, padding: "10px 12px" }}>
      <button
        onClick={toggle}
        style={{ ...btn, border: "none", background: editMode ? "var(--coral)" : "var(--ink-mid)", color: "#fff" }}
      >
        {editMode ? "✓ 편집 모드 (켜짐)" : "✏ 편집 모드"}
      </button>
      {editMode && (
        <>
          <span style={{ fontSize: 12.5, color: "var(--ink-light)" }}>변경 {count}건</span>
          <button
            onClick={doSave}
            disabled={saveState === "saving"}
            style={{ ...btn, border: "none", background: "var(--coral)", color: "#fff", cursor: saveState === "saving" ? "default" : "pointer" }}
          >
            {saveState === "saving" ? "저장 중…" : "💾 소스에 저장(배포용)"}
          </button>
          <span style={{ flex: 1 }} />
          <button onClick={exportJson} style={btn}>내보내기(JSON)</button>
          <button onClick={importJson} style={btn}>불러오기</button>
          <button onClick={() => { if (confirm("모든 편집을 초기화할까요?")) reset(); }} style={{ ...btn, color: "#b3261e", borderColor: "#f3c6c1" }}>초기화</button>
        </>
      )}
      {editMode && saveState !== "idle" && saveMsg && (
        <span style={{ width: "100%", fontSize: 12, fontWeight: 700, color: saveState === "err" ? "#b3261e" : "var(--coral-d)" }}>
          {saveState === "err" ? `저장 실패: ${saveMsg}` : `✓ ${saveMsg}`}
        </span>
      )}
      {editMode && <span style={{ width: "100%", fontSize: 11.5, color: "var(--ink-light)" }}>🔗 표시가 붙은 값은 여러 곳에 연결돼 있어, 수정하면 모두 함께 바뀝니다. <b>💾 소스에 저장</b>을 누르면 로컬 개발 서버가 편집값을 소스 파일에 기록합니다 — 커밋·배포하면 모든 방문자에게 영구 반영됩니다. (운영 사이트에서는 이 저장이 비활성화됩니다.)</span>}
    </div>
  );
}
