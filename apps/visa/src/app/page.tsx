"use client";

import { useMemo, useState } from "react";
import {
  ShieldAlert,
  AlertTriangle,
  Info,
  FileText,
  CheckCircle2,
  Search,
  Ban,
  BadgeCheck,
  ChevronDown,
} from "lucide-react";
import { D, resolve, type Rule } from "@/data/engine";

/* ── kind / confidence 스타일 ─────────────────────────── */
const KIND_META: Record<
  Rule["kind"],
  { label: string; color: string; bg: string; icon: React.ReactNode }
> = {
  blocker: { label: "발급 제한", color: "#b3261e", bg: "#fdecea", icon: <Ban size={13} /> },
  caution: { label: "주의", color: "#8a6d1a", bg: "#fff7e0", icon: <AlertTriangle size={13} /> },
  requirement: { label: "요건", color: "var(--coral-d)", bg: "var(--coral-pale)", icon: <CheckCircle2 size={13} /> },
  doc: { label: "제출서류", color: "var(--blue)", bg: "#eaf2fb", icon: <FileText size={13} /> },
  verify: { label: "확인필요", color: "#7c3aed", bg: "#f1ebfd", icon: <Search size={13} /> },
  info: { label: "안내", color: "var(--ink-mid)", bg: "#f2f2f4", icon: <Info size={13} /> },
};

const CONF_META: Record<
  Rule["confidence"],
  { label: string; color: string; bg: string }
> = {
  confirmed: { label: "확인됨", color: "var(--green)", bg: "#e6f5ee" },
  inferred: { label: "유추", color: "#8a6d1a", bg: "#fff7e0" },
  conflict: { label: "자료충돌", color: "#c2620f", bg: "#fdefe2" },
  unknown: { label: "미확인", color: "#b3261e", bg: "#fdecea" },
};

export default function Page() {
  // 각 축의 기본값 = 첫 옵션
  const [input, setInput] = useState<Record<string, string>>(() =>
    Object.fromEntries(D.axes.map((a) => [a.id, a.options[0]?.value ?? ""]))
  );

  const { ctx, rules } = useMemo(() => resolve(input), [input]);

  const groupsSorted = useMemo(
    () =>
      Object.entries(D.groups).sort((a, b) => a[1].order - b[1].order),
    []
  );

  const blockers = rules.filter((r) => r.kind === "blocker");
  const nonConfirmed = rules.filter((r) => r.confidence !== "confirmed");
  const finProof = ctx.finProof as string | undefined;
  const finProofLabel = finProof ? D.derivedAxes.finProof.values[finProof] : "";

  const set = (id: string, v: string) => setInput((s) => ({ ...s, [id]: v }));

  return (
    <main style={{ minHeight: "100vh" }}>
      {/* ── Header ─────────────────────────────────────── */}
      <header
        style={{
          background: "linear-gradient(135deg, var(--coral) 0%, var(--coral-d) 100%)",
          color: "#fff",
          padding: "40px 20px 34px",
        }}
      >
        <div style={{ maxWidth: 1160, margin: "0 auto" }}>
          <div style={inlineBadge}>
            <BadgeCheck size={15} /> 베트남 국적 중심 · D-2 / D-4 · v{D.meta.version}
          </div>
          <h1 style={{ fontSize: 30, fontWeight: 800, margin: "0 0 8px", letterSpacing: -0.5 }}>
            한국 유학비자 발급요건 조회
          </h1>
          <p style={{ margin: 0, fontSize: 15, opacity: 0.92, maxWidth: 720 }}>
            신청 상황을 선택하면 적용되는 발급요건 조항을 실시간으로 판정합니다. 기준일 {D.meta.compiledAt}.
          </p>
        </div>
      </header>

      <div
        style={{
          maxWidth: 1160,
          margin: "0 auto",
          padding: "24px 20px 64px",
          display: "grid",
          gridTemplateColumns: "minmax(280px, 340px) 1fr",
          gap: 28,
          alignItems: "start",
        }}
      >
        {/* ── 입력 폼 ──────────────────────────────────── */}
        <aside
          style={{
            position: "sticky",
            top: 20,
            background: "#fff",
            border: "1px solid var(--bdr)",
            borderRadius: 18,
            padding: 20,
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <h2 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 4px" }}>신청 상황</h2>
          <p style={{ fontSize: 12.5, color: "var(--ink-light)", margin: "0 0 16px" }}>
            13개 항목을 선택하세요.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {D.axes.map((axis) => (
              <label key={axis.id} style={{ display: "block" }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink-mid)", display: "block", marginBottom: 5 }}>
                  {axis.label}
                </span>
                <div style={{ position: "relative" }}>
                  <select
                    value={input[axis.id]}
                    onChange={(e) => set(axis.id, e.target.value)}
                    style={selectStyle}
                  >
                    {axis.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} style={chevron} />
                </div>
              </label>
            ))}
          </div>

          {/* 파생: 재정능력 입증 */}
          <div
            style={{
              marginTop: 18,
              padding: "12px 14px",
              borderRadius: 12,
              background: "var(--peach)",
              border: "1px solid var(--bdr)",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-light)" }}>
              {D.derivedAxes.finProof.label} (자동 판정)
            </div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 800,
                marginTop: 3,
                color:
                  finProof === "exempt"
                    ? "var(--green)"
                    : finProof === "unknown"
                    ? "#b3261e"
                    : "var(--coral-d)",
              }}
            >
              {finProofLabel}
            </div>
          </div>
        </aside>

        {/* ── 결과 ────────────────────────────────────── */}
        <section>
          {/* 상시 경고 */}
          <Callout tone="amber" icon={<AlertTriangle size={18} />}>
            {D.meta.warning}
          </Callout>

          {/* 요약 */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "16px 0 4px" }}>
            <SummaryPill label="적용 조항" value={rules.length} tone="coral" />
            {blockers.length > 0 && <SummaryPill label="발급 제한" value={blockers.length} tone="red" />}
            {nonConfirmed.length > 0 && (
              <SummaryPill label="미확정(확인필요)" value={nonConfirmed.length} tone="amber" />
            )}
          </div>

          {/* 차단 조항 강조 */}
          {blockers.length > 0 && (
            <Callout tone="red" icon={<ShieldAlert size={18} />}>
              <b>발급이 제한·불가한 조건입니다.</b>{" "}
              {blockers.map((b) => b.title).join(" / ")}
            </Callout>
          )}

          {nonConfirmed.length > 0 && (
            <div style={{ fontSize: 12.5, color: "var(--ink-light)", margin: "10px 2px 0" }}>
              ※ 적용 조항 중 <b>{nonConfirmed.length}건</b>은 확정되지 않았습니다(유추·자료충돌·미확인).
              확정 안내로 사용하지 말고 관할 공관에 확인하세요.
            </div>
          )}

          {/* 그룹별 조항 */}
          <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 22 }}>
            {groupsSorted.map(([gid, g]) => {
              const list = rules.filter((r) => r.group === gid);
              if (list.length === 0) return null;
              return (
                <div key={gid}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>{g.label}</h3>
                    <span style={gateBadge}>{g.gate} 심사</span>
                    <span style={{ fontSize: 12.5, color: "var(--ink-xlight)" }}>{list.length}건</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {list.map((r) => (
                      <RuleCard key={r.id} rule={r} />
                    ))}
                  </div>
                </div>
              );
            })}
            {rules.length === 0 && (
              <div style={{ padding: 40, textAlign: "center", color: "var(--ink-light)", background: "#fff", borderRadius: 14, border: "1px dashed var(--bdr-d)" }}>
                이 조건에 적용되는 조항이 없습니다.
              </div>
            )}
          </div>

          <SourceFooter />
        </section>
      </div>
    </main>
  );
}

/* ── Rule card ────────────────────────────────────────── */
function RuleCard({ rule }: { rule: Rule }) {
  const k = KIND_META[rule.kind];
  const c = CONF_META[rule.confidence];
  const isBlocker = rule.kind === "blocker";
  return (
    <div
      style={{
        background: "#fff",
        border: `1px solid ${isBlocker ? "#f3c6c1" : "var(--bdr)"}`,
        borderLeft: `4px solid ${k.color}`,
        borderRadius: 12,
        padding: "14px 16px",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
        <span style={{ ...tag, color: k.color, background: k.bg }}>
          {k.icon} {k.label}
        </span>
        <span style={{ fontSize: 15, fontWeight: 700, flex: 1 }}>{rule.title}</span>
        <span
          style={{ ...tag, color: c.color, background: c.bg }}
          title={D.confidenceLevels[rule.confidence]?.desc}
        >
          {c.label}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-mid)", lineHeight: 1.6 }}>{rule.body}</p>
      {rule.note && (
        <p
          style={{
            margin: "8px 0 0",
            fontSize: 12.5,
            color: "#8a6d1a",
            background: "#fff7e0",
            border: "1px solid #f0dca0",
            borderRadius: 8,
            padding: "7px 10px",
            lineHeight: 1.55,
          }}
        >
          ⚠ {rule.note}
        </p>
      )}
      <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "var(--ink-xlight)", fontFamily: "ui-monospace, monospace" }}>{rule.id}</span>
        {(rule.sources ?? []).map((sid) => {
          const s = D.sources[sid];
          if (!s) return null;
          return (
            <span key={sid} style={sourceTag} title={s.title}>
              {s.issuer}
              {s.docAsOf ? ` · ${s.docAsOf}` : s.asOf ? ` · ${s.asOf}` : ""}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/* ── Source legend (collapsible) ─────────────────────── */
function SourceFooter() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 32, borderTop: "1px solid var(--bdr)", paddingTop: 16 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          border: "none",
          background: "none",
          cursor: "pointer",
          fontSize: 13,
          fontWeight: 700,
          color: "var(--ink-light)",
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: 0,
        }}
      >
        <ChevronDown size={15} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
        출처 · 확신도 안내
      </button>
      {open && (
        <div style={{ marginTop: 12, fontSize: 12.5, color: "var(--ink-mid)", lineHeight: 1.7 }}>
          <div style={{ marginBottom: 10 }}>
            <b>확신도</b>:{" "}
            {Object.entries(D.confidenceLevels)
              .map(([k, v]) => `${v.label} — ${v.desc}`)
              .join(" · ")}
          </div>
          <b>출처</b>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            {Object.entries(D.sources).map(([id, s]) => (
              <li key={id} style={{ marginBottom: 3 }}>
                <span style={{ fontFamily: "ui-monospace, monospace", color: "var(--ink-light)" }}>{id}</span> — {s.issuer},{" "}
                {s.title}
                {s.docAsOf ? ` (${s.docAsOf})` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ── small components ────────────────────────────────── */
function Callout({
  children,
  tone,
  icon,
}: {
  children: React.ReactNode;
  tone: "amber" | "red";
  icon: React.ReactNode;
}) {
  const map = {
    amber: { bg: "#fff9e6", bd: "#f5d98a", fg: "#8a6d1a" },
    red: { bg: "#fdecea", bd: "#f3c6c1", fg: "#b3261e" },
  } as const;
  const t = map[tone];
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        background: t.bg,
        border: `1px solid ${t.bd}`,
        color: t.fg,
        borderRadius: 12,
        padding: "12px 14px",
        fontSize: 13,
        lineHeight: 1.6,
        marginTop: 12,
      }}
    >
      <span style={{ flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <span>{children}</span>
    </div>
  );
}

function SummaryPill({ label, value, tone }: { label: string; value: number; tone: "coral" | "red" | "amber" }) {
  const map = {
    coral: { bg: "var(--coral-pale)", fg: "var(--coral-d)" },
    red: { bg: "#fdecea", fg: "#b3261e" },
    amber: { bg: "#fff7e0", fg: "#8a6d1a" },
  } as const;
  const t = map[tone];
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6, background: t.bg, color: t.fg, padding: "7px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700 }}>
      <span style={{ fontSize: 17, fontWeight: 800 }}>{value}</span>
      {label}
    </span>
  );
}

/* ── inline style objects ────────────────────────────── */
const inlineBadge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "rgba(255,255,255,.18)",
  padding: "6px 14px",
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 600,
  marginBottom: 14,
};
const selectStyle: React.CSSProperties = {
  width: "100%",
  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none",
  padding: "9px 34px 9px 12px",
  borderRadius: 10,
  border: "1.5px solid var(--bdr-d)",
  background: "#fff",
  fontSize: 13.5,
  color: "var(--ink)",
  cursor: "pointer",
  outline: "none",
};
const chevron: React.CSSProperties = {
  position: "absolute",
  right: 11,
  top: "50%",
  transform: "translateY(-50%)",
  color: "var(--ink-light)",
  pointerEvents: "none",
};
const tag: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontSize: 11.5,
  fontWeight: 700,
  padding: "3px 9px",
  borderRadius: 999,
  whiteSpace: "nowrap",
};
const gateBadge: React.CSSProperties = {
  fontSize: 11.5,
  fontWeight: 700,
  color: "var(--navy)",
  background: "#e8eef6",
  padding: "3px 9px",
  borderRadius: 999,
};
const sourceTag: React.CSSProperties = {
  fontSize: 11,
  color: "var(--ink-light)",
  background: "var(--peach)",
  border: "1px solid var(--bdr)",
  padding: "2px 7px",
  borderRadius: 6,
};
