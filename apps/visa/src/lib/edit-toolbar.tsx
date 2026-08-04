"use client";

/**
 * 편집 툴바 — 비자앱 전용(공유 패키지에 넣지 않음).
 * 편집값을 소스 파일(overrides.json/.vi.json)에 기록하는 /api/overrides 를 호출한다.
 * (center 등 소비자는 readOnly 라 이 툴바·저장을 쓰지 않는다.)
 */
import React, { useState } from "react";
import { useEdit, LANG_LABEL, type Lang } from "@glocare/visa-core";

export function EditToolbar() {
  const { editMode, toggle, editLang, setEditLang, edits, overrides, reset } = useEdit();
  const count = Object.keys(edits[editLang]).length;
  const [saveState, setSaveState] = useState<"idle" | "saving" | "done" | "err">("idle");
  const [saveMsg, setSaveMsg] = useState("");

  const saveToSource = async (): Promise<number> => {
    const body = {
      ko: { ...overrides.ko, ...edits.ko },
      vi: { ...overrides.vi, ...edits.vi },
    };
    const res = await fetch("/api/overrides", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(j.error || `HTTP ${res.status}`);
    }
    const j = (await res.json()) as { count: number };
    return j.count;
  };

  const doSave = async () => {
    setSaveState("saving");
    setSaveMsg("");
    try {
      const n = await saveToSource();
      setSaveMsg(`저장됨 · ${n}건 (모두에게 즉시 반영)`);
      setSaveState("done");
      setTimeout(() => setSaveState("idle"), 4000);
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : String(e));
      setSaveState("err");
    }
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
            {saveState === "saving" ? "저장 중…" : "💾 저장"}
          </button>
          <span style={{ flex: 1 }} />
          <button onClick={() => { if (confirm(`${LANG_LABEL[editLang]} 미저장 편집을 초기화할까요?`)) reset(); }} style={{ ...btn, color: "#b3261e", borderColor: "#f3c6c1" }}>초기화</button>
        </>
      )}
      {editMode && saveState !== "idle" && saveMsg && (
        <span style={{ width: "100%", fontSize: 12, fontWeight: 700, color: saveState === "err" ? "#b3261e" : "var(--coral-d)" }}>
          {saveState === "err" ? `저장 실패: ${saveMsg}` : `✓ ${saveMsg}`}
        </span>
      )}
      {editMode && (
        <span style={{ width: "100%", fontSize: 11.5, color: "var(--ink-light)" }}>
          <b>편집 언어</b>를 <b>Tiếng Việt</b> 로 바꾸면 각 칸에 베트남어를 넣습니다(한국어 원문은 흐린 안내로 표시). <b>💾 저장</b>하면 DB에 기록되어 <b>모두에게 즉시 반영</b>됩니다(커밋·배포 불필요). <b>초기화</b>는 아직 저장 안 한 내 편집만 지웁니다.
        </span>
      )}
    </div>
  );
}
