"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import {
  Search,
  ChevronDown,
  ShieldAlert,
  Pencil,
  Building2,
  Check,
  X,
} from "lucide-react";
import {
  D,
  lookup,
  axisLabel,
  valueLabel,
  ORIGIN_OPTIONS,
  EMPHASIZED_STATUS,
  type Candidate,
  type OptionTag,
  type UnivRegion,
  type UnivTier,
} from "@/data/engine";
import { ANN } from "@/data/annotations";
import { UNIVERSITIES } from "@/data/universities";

/* ── 라벨 ─────────────────────────────────────────────── */
const TIER_LABEL: Record<UnivTier, string> = {
  excellent: "우수인증",
  certified: "인증",
  general: "미인증(일반)",
  consulting: "컨설팅대학",
  restricted: "비자정밀 심사대학",
};
const REGION_LABEL: Record<UnivRegion, string> = { metro: "수도권", nonmetro: "비수도권" };

const TRACK_OPTS = D.axes.find((a) => a.id === "track")!.options;
const STATUS_OPTS = D.axes.find((a) => a.id === "statusCode")!.options;

interface UnivPick {
  name: string;
  tier: UnivTier;
  region: UnivRegion;
}
const UNIV_SPECIAL: UnivPick[] = [
  { name: "그 외 대학 — 수도권 (미인증)", tier: "general", region: "metro" },
  { name: "그 외 대학 — 비수도권 (미인증)", tier: "general", region: "nonmetro" },
  { name: "컨설팅대학 — 수도권", tier: "consulting", region: "metro" },
  { name: "컨설팅대학 — 비수도권", tier: "consulting", region: "nonmetro" },
  { name: "비자정밀 심사대학 — 수도권", tier: "restricted", region: "metro" },
  { name: "비자정밀 심사대학 — 비수도권", tier: "restricted", region: "nonmetro" },
];

/* group 표시 순서/라벨은 rules.json 것을 사용 */
const GROUPS_SORTED = Object.entries(D.groups).sort((a, b) => a[1].order - b[1].order);

export default function Page() {
  const [track, setTrack] = useState("new_d2");
  const [origin, setOrigin] = useState("vn_south");
  const [status, setStatus] = useState("D-2-2");
  const [univ, setUniv] = useState<UnivPick | null>(null);
  const [searched, setSearched] = useState(false);

  const originOpt = ORIGIN_OPTIONS.find((o) => o.value === origin)!;

  const result = useMemo(() => {
    if (!univ) return null;
    return lookup({
      track,
      nationality: originOpt.ctx.nationality as string,
      applicantRegion: (originOpt.ctx.applicantRegion ?? null) as string | null,
      univTier: univ.tier,
      univRegion: univ.region,
      statusCode: status,
    });
  }, [track, origin, status, univ, originOpt]);

  const canSearch = !!univ;

  return (
    <main style={{ minHeight: "100vh" }}>
      <header
        style={{
          background: "linear-gradient(135deg, var(--coral) 0%, var(--coral-d) 100%)",
          color: "#fff",
          padding: searched ? "24px 20px 20px" : "40px 20px 34px",
          transition: "padding .2s",
        }}
      >
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          <h1 style={{ fontSize: searched ? 20 : 28, fontWeight: 800, margin: 0, letterSpacing: -0.5, transition: "font-size .2s" }}>
            한국 유학비자 발급요건 조회
          </h1>
          {!searched && (
            <p style={{ margin: "8px 0 0", fontSize: 15, opacity: 0.92 }}>
              신청 상황 4가지를 고르고 조회하면, 적용되는 발급요건을 서류별로 정리해 드립니다. 기준일 {D.meta.compiledAt}.
            </p>
          )}
        </div>
      </header>

      <div style={{ maxWidth: 980, margin: "0 auto", padding: "20px 20px 64px" }}>
        {!searched ? (
          <InputForm
            {...{ track, setTrack, origin, setOrigin, status, setStatus, univ, setUniv }}
            canSearch={canSearch}
            onSearch={() => setSearched(true)}
          />
        ) : (
          <>
            <SummaryBar
              track={track}
              origin={originOpt.label}
              status={status}
              univ={univ!}
              onEdit={() => setSearched(false)}
            />
            {result && <Results result={result} />}
          </>
        )}
      </div>
    </main>
  );
}

/* ══════════════════════ 입력 폼 ══════════════════════ */
function InputForm({
  track,
  setTrack,
  origin,
  setOrigin,
  status,
  setStatus,
  univ,
  setUniv,
  canSearch,
  onSearch,
}: {
  track: string;
  setTrack: (v: string) => void;
  origin: string;
  setOrigin: (v: string) => void;
  status: string;
  setStatus: (v: string) => void;
  univ: UnivPick | null;
  setUniv: (v: UnivPick | null) => void;
  canSearch: boolean;
  onSearch: () => void;
}) {
  return (
    <div style={{ background: "#fff", border: "1px solid var(--bdr)", borderRadius: 18, padding: 22, boxShadow: "var(--shadow-sm)" }}>
      <div style={{ display: "grid", gap: 18 }}>
        <Field label="현재 상태 및 희망 비자">
          <Dropdown value={track} onChange={setTrack} options={TRACK_OPTS.map((o) => ({ value: o.value, label: o.label }))} />
        </Field>
        <Field label="본인의 국적 및 거주지">
          <Dropdown value={origin} onChange={setOrigin} options={ORIGIN_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} />
        </Field>
        <Field label="지원할 대학교">
          <UnivPicker value={univ} onChange={setUniv} />
        </Field>
        <Field label="신청할 비자">
          <Dropdown
            value={status}
            onChange={setStatus}
            options={STATUS_OPTS.map((o) => ({ value: o.value, label: o.label, bold: EMPHASIZED_STATUS.has(o.value) }))}
          />
        </Field>
      </div>

      <button
        onClick={onSearch}
        disabled={!canSearch}
        style={{
          marginTop: 22,
          width: "100%",
          padding: "14px",
          borderRadius: 12,
          border: "none",
          background: canSearch ? "var(--coral)" : "var(--bdr-d)",
          color: "#fff",
          fontSize: 16,
          fontWeight: 800,
          cursor: canSearch ? "pointer" : "not-allowed",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        <Search size={18} /> 발급요건 조회
      </button>
      {!canSearch && (
        <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--ink-light)", textAlign: "center" }}>
          지원할 대학교를 선택하면 조회할 수 있습니다.
        </p>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-mid)", display: "block", marginBottom: 7 }}>{label}</span>
      {children}
    </label>
  );
}

/* ── 커스텀 드롭다운 (bold 옵션 지원) ─────────────────── */
function Dropdown({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; bold?: boolean }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutside(ref, () => setOpen(false));
  const sel = options.find((o) => o.value === value);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen((o) => !o)} style={selectBtn}>
        <span style={{ fontWeight: sel?.bold ? 800 : 500 }}>{sel?.label ?? "선택"}</span>
        <ChevronDown size={16} style={{ color: "var(--ink-light)", flexShrink: 0 }} />
      </button>
      {open && (
        <div style={dropdownPanel}>
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              style={{ ...dropdownItem, fontWeight: o.bold ? 800 : 500, background: o.value === value ? "var(--coral-pale)" : "#fff" }}
            >
              {o.label}
              {o.value === value && <Check size={15} style={{ color: "var(--coral-d)" }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── 대학교 검색 피커 ─────────────────────────────────── */
function UnivPicker({ value, onChange }: { value: UnivPick | null; onChange: (v: UnivPick | null) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useOutside(ref, () => setOpen(false));

  const matches = useMemo(() => {
    const query = q.trim();
    const base = query ? UNIVERSITIES.filter((u) => u.name.includes(query)) : UNIVERSITIES;
    return base.slice(0, 40);
  }, [q]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen((o) => !o)} style={selectBtn}>
        {value ? (
          <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <Building2 size={15} style={{ color: "var(--coral-d)", flexShrink: 0 }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value.name}</span>
            <TierBadge tier={value.tier} region={value.region} />
          </span>
        ) : (
          <span style={{ color: "var(--ink-light)" }}>대학교 검색 / 선택</span>
        )}
        <ChevronDown size={16} style={{ color: "var(--ink-light)", flexShrink: 0 }} />
      </button>
      {open && (
        <div style={{ ...dropdownPanel, maxHeight: 340, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: 8, borderBottom: "1px solid var(--bdr)", position: "sticky", top: 0, background: "#fff" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--peach)", borderRadius: 8, padding: "6px 10px" }}>
              <Search size={15} color="var(--ink-light)" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="대학명 입력 (예: 한양대, 부산대)"
                style={{ border: "none", outline: "none", background: "transparent", fontSize: 13.5, width: "100%" }}
              />
              {q && <X size={15} style={{ cursor: "pointer", color: "var(--ink-light)" }} onClick={() => setQ("")} />}
            </div>
          </div>
          <div style={{ overflowY: "auto" }}>
            {matches.map((u) => (
              <button key={u.name} type="button" onClick={() => pick(u)} style={dropdownItem}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</span>
                <TierBadge tier={u.tier} region={u.region} />
              </button>
            ))}
            {matches.length === 0 && (
              <div style={{ padding: "14px", fontSize: 12.5, color: "var(--ink-light)", textAlign: "center" }}>
                목록에 없는 대학입니다. 아래에서 등급·지역을 선택하세요.
              </div>
            )}
            <div style={{ borderTop: "1px solid var(--bdr)", padding: "6px 0" }}>
              <div style={{ fontSize: 11, color: "var(--ink-xlight)", padding: "4px 14px" }}>목록에 없거나 특수 등급</div>
              {UNIV_SPECIAL.map((u) => (
                <button key={u.name} type="button" onClick={() => pick(u)} style={dropdownItem}>
                  <span>{u.name}</span>
                  <TierBadge tier={u.tier} region={u.region} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function pick(u: UnivPick) {
    onChange({ name: u.name, tier: u.tier, region: u.region });
    setOpen(false);
    setQ("");
  }
}

function TierBadge({ tier, region }: { tier: UnivTier; region: UnivRegion }) {
  const color =
    tier === "excellent" ? "var(--green)" : tier === "certified" ? "var(--blue)" : tier === "general" ? "var(--ink-light)" : "var(--coral-d)";
  return (
    <span style={{ display: "inline-flex", gap: 4, flexShrink: 0, marginLeft: "auto" }}>
      <span style={{ fontSize: 10.5, fontWeight: 700, color: "#fff", background: color, padding: "1px 7px", borderRadius: 999 }}>{TIER_LABEL[tier]}</span>
      <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--ink-mid)", background: "var(--peach)", padding: "1px 7px", borderRadius: 999 }}>{REGION_LABEL[region]}</span>
    </span>
  );
}

/* ══════════════════════ 요약 바 ══════════════════════ */
function SummaryBar({ track, origin, status, univ, onEdit }: { track: string; origin: string; status: string; univ: UnivPick; onEdit: () => void }) {
  const trackLabel = TRACK_OPTS.find((o) => o.value === track)?.label ?? track;
  const statusLabel = STATUS_OPTS.find((o) => o.value === status)?.label ?? status;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", border: "1px solid var(--bdr)", borderRadius: 14, padding: "12px 14px", marginBottom: 18, boxShadow: "var(--shadow-sm)", flexWrap: "wrap" }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 1, minWidth: 0 }}>
        <SumChip>{trackLabel}</SumChip>
        <SumChip>{origin}</SumChip>
        <SumChip>
          {univ.name} · {TIER_LABEL[univ.tier]} · {REGION_LABEL[univ.region]}
        </SumChip>
        <SumChip strong>{statusLabel}</SumChip>
      </div>
      <button onClick={onEdit} style={{ display: "flex", alignItems: "center", gap: 5, border: "1.5px solid var(--coral)", background: "#fff", color: "var(--coral-d)", padding: "7px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
        <Pencil size={14} /> 수정
      </button>
    </div>
  );
}
function SumChip({ children, strong }: { children: React.ReactNode; strong?: boolean }) {
  return (
    <span style={{ fontSize: 12.5, fontWeight: strong ? 800 : 600, color: strong ? "var(--coral-d)" : "var(--ink-mid)", background: strong ? "var(--coral-pale)" : "var(--peach)", padding: "5px 11px", borderRadius: 8 }}>
      {children}
    </span>
  );
}

/* ══════════════════════ 결과 ══════════════════════ */
function Results({ result }: { result: { finProof: Set<string>; candidates: Candidate[] } }) {
  const { candidates, finProof } = result;
  const blockers = candidates.filter((c) => c.rule.kind === "blocker");
  const nonConfirmed = candidates.filter((c) => c.rule.confidence !== "confirmed");

  const finText =
    finProof.size > 1 ? "장학금 등 조건에 따라 다름" : valueLabel("finProof", [...finProof][0] ?? "required");

  return (
    <div>
      {/* 요약 */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <Pill label="적용 요건" value={candidates.length} tone="coral" />
        {blockers.length > 0 && <Pill label="발급 제한" value={blockers.length} tone="red" />}
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--peach)", color: "var(--ink-mid)", padding: "7px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700 }}>
          재정능력 입증: <b style={{ color: "var(--coral-d)" }}>{finText}</b>
        </span>
      </div>

      {blockers.length > 0 && (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "#fdecea", border: "1px solid #f3c6c1", color: "#b3261e", borderRadius: 12, padding: "12px 14px", fontSize: 13.5, marginBottom: 18 }}>
          <ShieldAlert size={18} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            <b>발급이 제한·불가할 수 있는 조건입니다.</b> {blockers.map((b) => ANN[b.rule.id]?.title ?? b.rule.title).join(" · ")}
          </span>
        </div>
      )}

      {GROUPS_SORTED.map(([gid, g]) => {
        const rows = candidates.filter((c) => c.rule.group === gid);
        if (rows.length === 0) return null;
        // doc 로 묶기
        const docs = new Map<string, Candidate[]>();
        for (const c of rows) {
          const key = ANN[c.rule.id]?.doc ?? ANN[c.rule.id]?.title ?? c.rule.title;
          if (!docs.has(key)) docs.set(key, []);
          docs.get(key)!.push(c);
        }
        return (
          <section key={gid} style={{ marginBottom: 26 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>{g.label}</h3>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--navy)", background: "#e8eef6", padding: "2px 9px", borderRadius: 999 }}>{g.gate} 심사</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[...docs.entries()].map(([docKey, list]) => (
                <DocCard key={docKey} title={docKey} list={list} />
              ))}
            </div>
          </section>
        );
      })}

      {nonConfirmed.length > 0 && (
        <p style={{ fontSize: 12.5, color: "var(--ink-light)", marginTop: 8 }}>
          ※ 적용 요건 중 <b>{nonConfirmed.length}건</b>은 확정되지 않았습니다(유추·자료충돌·미확인). 확정 안내로 쓰지 말고 관할 공관에 확인하세요.
        </p>
      )}
    </div>
  );
}

/* ── 문서 카드 ────────────────────────────────────────── */
function DocCard({ title, list }: { title: string; list: Candidate[] }) {
  const [open, setOpen] = useState(false);
  const hasBlocker = list.some((c) => c.rule.kind === "blocker");
  const hasCond = list.some((c) => c.tags.length > 0);
  const hasUnconfirmed = list.some((c) => c.rule.confidence !== "confirmed");

  return (
    <div
      style={{
        background: "#fff",
        border: `1px solid ${hasBlocker ? "#f3c6c1" : "var(--bdr)"}`,
        borderLeft: `4px solid ${hasBlocker ? "#b3261e" : "var(--coral)"}`,
        borderRadius: 12,
        padding: "13px 15px",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 15, fontWeight: 800 }}>{title}</span>
        {hasCond && <span style={badge("var(--blue)", "#eaf2fb")}>조건부</span>}
        {hasUnconfirmed && <span style={badge("#b3261e", "#fdecea")}>미확정</span>}
      </div>

      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 7 }}>
        {list.map((c) => (
          <Row key={c.rule.id} c={c} multi={list.length > 1} />
        ))}
      </div>

      <button
        onClick={() => setOpen((o) => !o)}
        style={{ marginTop: 10, border: "none", background: "none", padding: 0, cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: "var(--ink-light)", display: "flex", alignItems: "center", gap: 5 }}
      >
        <ChevronDown size={14} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
        {open ? "상세 닫기" : "상세히 보기"}
      </button>

      {open && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10, borderTop: "1px solid var(--bdr)", paddingTop: 10 }}>
          {list.map((c) => (
            <div key={c.rule.id} style={{ fontSize: 13, color: "var(--ink-mid)", lineHeight: 1.65 }}>
              {c.tags.length > 0 && (
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 5 }}>
                  {c.tags.map((t, i) => (
                    <Tag key={i} tag={t} />
                  ))}
                </div>
              )}
              <div>{c.rule.body}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ c, multi }: { c: Candidate; multi: boolean }) {
  const terse = ANN[c.rule.id]?.terse ?? c.rule.title;
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
      {multi && <span style={{ color: "var(--coral)", flexShrink: 0 }}>•</span>}
      <div style={{ flex: 1 }}>
        <span style={{ fontSize: 13.5, color: "var(--ink)" }}>{terse}</span>
        {c.tags.length > 0 && (
          <span style={{ display: "inline-flex", gap: 5, flexWrap: "wrap", marginLeft: 8, verticalAlign: "middle" }}>
            {c.tags.map((t, i) => (
              <Tag key={i} tag={t} />
            ))}
          </span>
        )}
      </div>
    </div>
  );
}

function Tag({ tag }: { tag: OptionTag }) {
  const label = tag.values.map((v) => valueLabel(tag.axis, v)).join(" / ");
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        color: tag.negate ? "var(--ink-light)" : "var(--navy)",
        background: tag.negate ? "#f2f2f4" : "#eef2f8",
        border: "1px solid var(--bdr)",
        padding: "1px 8px",
        borderRadius: 999,
        whiteSpace: "nowrap",
      }}
    >
      {tag.negate ? "제외 " : ""}
      {axisLabel(tag.axis)}: {label}
    </span>
  );
}

/* ── 소품 ─────────────────────────────────────────────── */
function Pill({ label, value, tone }: { label: string; value: number; tone: "coral" | "red" }) {
  const map = { coral: { bg: "var(--coral-pale)", fg: "var(--coral-d)" }, red: { bg: "#fdecea", fg: "#b3261e" } } as const;
  const t = map[tone];
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6, background: t.bg, color: t.fg, padding: "7px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700 }}>
      <span style={{ fontSize: 17, fontWeight: 800 }}>{value}</span>
      {label}
    </span>
  );
}
const badge = (fg: string, bg: string): React.CSSProperties => ({ fontSize: 11, fontWeight: 700, color: fg, background: bg, padding: "2px 8px", borderRadius: 999 });

/* ── util ─────────────────────────────────────────────── */
function useOutside(ref: React.RefObject<HTMLDivElement | null>, cb: () => void) {
  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) cb();
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  });
}

const selectBtn: React.CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  padding: "11px 13px",
  borderRadius: 10,
  border: "1.5px solid var(--bdr-d)",
  background: "#fff",
  fontSize: 14,
  color: "var(--ink)",
  cursor: "pointer",
  textAlign: "left",
};
const dropdownPanel: React.CSSProperties = {
  position: "absolute",
  top: "calc(100% + 6px)",
  left: 0,
  right: 0,
  background: "#fff",
  border: "1px solid var(--bdr-d)",
  borderRadius: 12,
  boxShadow: "var(--shadow-lg)",
  zIndex: 30,
  overflow: "hidden",
  maxHeight: 300,
  overflowY: "auto",
};
const dropdownItem: React.CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 13px",
  border: "none",
  background: "#fff",
  fontSize: 13.5,
  color: "var(--ink)",
  cursor: "pointer",
  textAlign: "left",
};
