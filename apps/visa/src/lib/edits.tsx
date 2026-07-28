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

type EditMap = Record<string, string>;

interface EditCtx {
  editMode: boolean;
  toggle: () => void;
  get: (path: string, original: string) => string;
  set: (path: string, value: string) => void;
  clear: (path: string) => void;
  edits: EditMap;
  reset: () => void;
  load: (m: EditMap) => void;
}

const Ctx = createContext<EditCtx | null>(null);
const LS_KEY = "visa-text-edits-v1";

export function EditProvider({ children }: { children: React.ReactNode }) {
  const [editMode, setEditMode] = useState(false);
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

  const get = useCallback((path: string, original: string) => (path in edits ? edits[path] : original), [edits]);
  const set = useCallback((path: string, value: string) => setEdits((e) => ({ ...e, [path]: value })), []);
  const clear = useCallback((path: string) => setEdits((e) => { const n = { ...e }; delete n[path]; return n; }), []);
  const reset = useCallback(() => setEdits({}), []);
  const load = useCallback((m: EditMap) => setEdits(m), []);

  return (
    <Ctx.Provider value={{ editMode, toggle: () => setEditMode((m) => !m), get, set, clear, edits, reset, load }}>
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
  padding: "1px 6px",
  outline: "none",
  boxShadow: "0 0 0 2px rgba(242,92,92,.08)",
};

/**
 * 편집 가능한 텍스트. 편집 모드가 아니면 그냥 텍스트, 편집 모드면 입력창.
 * shared>1 이면 "공유 N곳" 배지 노출(수정 시 연결된 모든 곳에 반영됨을 알림).
 */
export function EditableText({
  path,
  value,
  multiline,
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
  return (
    <span style={{ display: multiline ? "block" : "inline-flex", alignItems: "baseline", gap: 5, position: "relative", width: multiline ? "100%" : "auto", maxWidth: "100%" }}>
      {multiline ? (
        <textarea
          value={cur}
          onChange={(e) => set(path, e.target.value)}
          rows={Math.min(8, Math.max(2, Math.ceil(cur.length / 46)))}
          style={{ ...fieldStyle, ...style, width: "100%", resize: "vertical", lineHeight: 1.5 }}
        />
      ) : (
        <input
          value={cur}
          onChange={(e) => set(path, e.target.value)}
          style={{ ...fieldStyle, ...style, width: `${Math.min(60, Math.max(4, cur.length + 1))}ch` }}
        />
      )}
      {shared && shared > 1 ? (
        <span
          title={`이 값은 ${shared}곳에 연결되어 있어, 수정하면 모두 함께 바뀝니다.`}
          style={{ fontSize: 10, fontWeight: 800, color: "#8a4b00", background: "#ffe8cc", border: "1px solid #f0c088", borderRadius: 999, padding: "0 6px", whiteSpace: "nowrap", flexShrink: 0 }}
        >
          🔗 공유 {shared}곳
        </span>
      ) : null}
      {changed ? <span title="수정됨" style={{ width: 6, height: 6, borderRadius: 999, background: "var(--coral)", flexShrink: 0 }} /> : null}
    </span>
  );
}

/** 편집 툴바 — 편집 on/off, 변경 개수, 내보내기/불러오기/초기화. */
export function EditToolbar() {
  const { editMode, toggle, edits, reset, load } = useEdit();
  const count = Object.keys(edits).length;

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
          <span style={{ flex: 1 }} />
          <button onClick={exportJson} style={btn}>내보내기(JSON)</button>
          <button onClick={importJson} style={btn}>불러오기</button>
          <button onClick={() => { if (confirm("모든 편집을 초기화할까요?")) reset(); }} style={{ ...btn, color: "#b3261e", borderColor: "#f3c6c1" }}>초기화</button>
        </>
      )}
      {editMode && <span style={{ width: "100%", fontSize: 11.5, color: "var(--ink-light)" }}>🔗 표시가 붙은 값은 여러 곳에 연결돼 있어, 수정하면 모두 함께 바뀝니다. 편집값은 이 브라우저에 저장되며, 내보내기로 백업·이관하세요.</span>}
    </div>
  );
}
