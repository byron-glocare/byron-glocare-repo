"use client";

/**
 * 편집 툴바 — 비자앱 전용(공유 패키지에 넣지 않음).
 * 편집값을 소스 파일(overrides.json/.vi.json)에 기록하는 /api/overrides 를 호출한다.
 * (center 등 소비자는 readOnly 라 이 툴바·저장을 쓰지 않는다.)
 */
import React, { useState } from "react";
import { useEdit, LANG_LABEL, type Lang } from "@glocare/visa-core";

export function EditToolbar() {
  const { editMode, toggle, editLang, setEditLang, edits, overrides, reset, load } = useEdit();
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
