"use client";

/**
 * 서류 편집 페이지 (/edit).
 *
 * 조회 화면과 분리된 전용 편집 공간. 여기서 한 곳에서 모든 서류를 수정한다.
 *  - 공용(공통) 값: 서류명·설명·속성 등 — 한 번 고치면 모든 조회 조건에 반영.
 *  - ★ 조건별 값: 조회 조건(과정·지역·기간)마다 다른 값 — 조건 종류별로 나열해 각각 편집.
 * 저장은 localStorage(조회 화면과 공유). 내보내기/불러오기로 백업·이관.
 */
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DOCS, SECTIONS, docAttrRaws, CONDITIONAL_SLOTS, type ChecklistDoc, type Section, EditableText, useEdit } from "@glocare/visa-core";
import { EditToolbar } from "@/lib/edit-toolbar";
import { LiveEditProvider } from "@/lib/live-edit-provider";

const SECTION_EMOJI: Record<Section, string> = { "신분·공통": "🪪", 학력: "🎓", 재정: "💰", 건강: "🩺", 어학: "🗣️" };
const nameOf = (id: string) => DOCS.find((d) => d.id === id)?.name ?? id;

export default function EditPage() {
  return (
    <LiveEditProvider defaultOn>
      <main style={{ minHeight: "100vh", background: "var(--peach)" }}>
        <header style={{ background: "linear-gradient(135deg, var(--coral) 0%, var(--coral-d) 100%)", color: "#fff", padding: "22px 20px" }}>
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#fff", textDecoration: "none", fontSize: 13, fontWeight: 700, opacity: 0.95 }}>
              <ArrowLeft size={15} /> 조회 화면으로
            </Link>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: "10px 0 0" }}>서류 내용 편집</h1>
            <p style={{ margin: "6px 0 0", fontSize: 13.5, opacity: 0.92 }}>
              한 번 고치면 그 서류가 나오는 <b>모든 조회 조건</b>에 반영됩니다. <b>★ 표시</b>는 조회 조건마다 값이 다른 항목이라 조건별로 따로 적습니다.
            </p>
          </div>
        </header>

        <div style={{ maxWidth: 900, margin: "0 auto", padding: "18px 20px 80px" }}>
          <EditToolbar />
          <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
            {SECTIONS.map((sec) => {
              const docs = DOCS.filter((d) => d.section === sec);
              if (!docs.length) return null;
              return (
                <section key={sec}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 17 }}>{SECTION_EMOJI[sec]}</span>
                    <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>{sec}</h2>
                    <span style={{ fontSize: 12, color: "var(--ink-xlight)" }}>{docs.length}건</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {docs.map((d) => (
                      <DocEditor key={d.id} doc={d} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </main>
    </LiveEditProvider>
  );
}

function DocEditor({ doc }: { doc: ChecklistDoc }) {
  const { getKo, setKo } = useEdit();
  const P = (k: string) => `doc:${doc.id}:${k}`;

  const attrs = docAttrRaws(doc, nameOf);
  const hidden: string[] = JSON.parse(getKo(P("_hidden"), "[]"));
  const extra: { label: string; value: string }[] = JSON.parse(getKo(P("_extra"), "[]"));
  const setHidden = (a: string[]) => setKo(P("_hidden"), JSON.stringify(a));
  const setExtra = (a: { label: string; value: string }[]) => setKo(P("_extra"), JSON.stringify(a));
  const slots = CONDITIONAL_SLOTS[doc.id] ?? [];
  const slotGroups = [...new Set(slots.map((s) => s.group))];

  return (
    <div style={{ background: "#fff", border: "1px solid var(--bdr)", borderLeft: "4px solid var(--coral)", borderRadius: 12, padding: "14px 16px", boxShadow: "var(--shadow-sm)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 800 }}>
          <EditableText path={P("name")} value={doc.name} />
        </div>
        <span style={{ fontSize: 10.5, color: "var(--ink-xlight)", background: "var(--peach)", padding: "2px 8px", borderRadius: 999, flexShrink: 0 }}>{doc.id}</span>
      </div>

      <Row label="설명"><EditableText path={P("brief")} value={doc.brief} multiline /></Row>
      <Row label="상세 설명"><EditableText path={P("detailDesc")} value={doc.detailDesc ?? ""} multiline /></Row>
      {doc.cond !== undefined && <Row label="조건·대체"><EditableText path={P("cond")} value={doc.cond} multiline /></Row>}
      {doc.ambiguous !== undefined && <Row label="확인 필요"><EditableText path={P("ambiguous")} value={doc.ambiguous} multiline /></Row>}

      <Divider>공용 속성 · 모든 조건 공통</Divider>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {attrs.filter((a) => !hidden.includes(a.key)).map((a) => (
          <div key={a.key} style={rowWrap}>
            <span style={labelCell}>{a.label}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <EditableText path={P(a.key)} value={a.raw} />
            </div>
            <button onClick={() => setHidden([...hidden, a.key])} style={delBtn} title="이 항목 숨김">삭제</button>
          </div>
        ))}
        {doc.id === "balance" && (
          <div style={rowWrap}>
            <span style={{ ...labelCell, color: "var(--coral-d)" }}>발급기관 (국내변경)</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <EditableText path="doc:balance:issuer:change" value="한국 은행" />
            </div>
          </div>
        )}
        {extra.map((ex, i) => (
          <div key={`x${i}`} style={rowWrap}>
            <input value={ex.label} placeholder="항목명" onChange={(e) => setExtra(extra.map((v, j) => (j === i ? { ...v, label: e.target.value } : v)))} style={{ ...labelInput }} />
            <input value={ex.value} placeholder="값" onChange={(e) => setExtra(extra.map((v, j) => (j === i ? { ...v, value: e.target.value } : v)))} style={{ ...valInput, flex: 1 }} />
            <button onClick={() => setExtra(extra.filter((_, j) => j !== i))} style={delBtn}>삭제</button>
          </div>
        ))}
        {attrs.filter((a) => hidden.includes(a.key)).map((a) => (
          <div key={`r${a.key}`} style={{ ...rowWrap, opacity: 0.6 }}>
            <span style={{ ...labelCell, textDecoration: "line-through" }}>{a.label}</span>
            <span style={{ flex: 1, fontSize: 12.5, color: "var(--ink-light)" }}>삭제됨</span>
            <button onClick={() => setHidden(hidden.filter((k) => k !== a.key))} style={{ ...delBtn, color: "var(--coral-d)", borderColor: "var(--coral-l)" }}>복구</button>
          </div>
        ))}
        <button onClick={() => setExtra([...extra, { label: "", value: "" }])} style={addBtn}>+ 항목 추가</button>
      </div>

      {slots.length > 0 && (
        <>
          <Divider star>조건별 값 · 조회 조건마다 다름</Divider>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {slotGroups.map((g) => (
              <div key={g}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "var(--coral-d)", marginBottom: 4 }}>★ {g}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {slots.filter((s) => s.group === g).map((s) => (
                    <div key={s.slot} style={rowWrap}>
                      <span style={{ ...labelCell, width: 168 }}>{s.label}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <EditableText path={`dyn:${doc.id}:${s.slot}`} value={s.value} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ ...rowWrap, alignItems: "flex-start" }}>
      <span style={labelCell}>{label}</span>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}
function Divider({ children, star }: { children: React.ReactNode; star?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "14px 0 8px" }}>
      <span style={{ fontSize: 11.5, fontWeight: 800, color: star ? "var(--coral-d)" : "var(--ink-light)", whiteSpace: "nowrap" }}>{children}</span>
      <span style={{ flex: 1, height: 1, background: "var(--bdr)" }} />
    </div>
  );
}

const rowWrap: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8 };
const labelCell: React.CSSProperties = { width: 92, flexShrink: 0, fontSize: 12, fontWeight: 700, color: "var(--ink-light)", paddingTop: 4 };
const labelInput: React.CSSProperties = { width: 92, flexShrink: 0, font: "inherit", fontSize: 12.5, border: "1px solid var(--coral-l)", borderRadius: 6, padding: "3px 7px", outline: "none", background: "#fffdf5" };
const valInput: React.CSSProperties = { font: "inherit", fontSize: 12.5, border: "1px solid var(--coral-l)", borderRadius: 6, padding: "3px 7px", outline: "none", background: "#fffdf5", minWidth: 0 };
const delBtn: React.CSSProperties = { flexShrink: 0, fontSize: 11.5, fontWeight: 700, color: "#b3261e", background: "#fff", border: "1px solid #f3c6c1", borderRadius: 7, padding: "3px 9px", cursor: "pointer" };
const addBtn: React.CSSProperties = { alignSelf: "flex-start", fontSize: 12, fontWeight: 800, color: "var(--coral-d)", background: "#fff", border: "1px solid var(--coral-l)", borderRadius: 8, padding: "5px 11px", cursor: "pointer", marginTop: 2 };
