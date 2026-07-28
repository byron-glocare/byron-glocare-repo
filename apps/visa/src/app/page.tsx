"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import {
  Search,
  ChevronDown,
  ShieldAlert,
  Pencil,
  Building2,
  Check,
  FileText,
  ClipboardList,
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
import { ANN, DOC_GROUPS, docGroupKey } from "@/data/annotations";
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

const STATUS_OPTS = D.axes.find((a) => a.id === "statusCode")!.options;

type InstKind = "univ" | "hagwon";
type PickMode = "name" | "cond";

function statusOptionsFor(inst: InstKind) {
  const prefix = inst === "hagwon" ? "D-4" : "D-2";
  return STATUS_OPTS.filter((o) => o.value.startsWith(prefix));
}

interface UnivPick {
  name: string;
  tier: UnivTier;
  region: UnivRegion;
}

const TIER_OPTS: { value: UnivTier; label: string }[] = [
  { value: "excellent", label: "우수 인증대학" },
  { value: "certified", label: "인증대학" },
  { value: "general", label: "미인증(일반) 대학" },
  { value: "consulting", label: "컨설팅대학 (비자심사 강화)" },
  { value: "restricted", label: "비자정밀 심사대학" },
];
const REGION_OPTS: { value: UnivRegion; label: string }[] = [
  { value: "metro", label: "수도권 (서울·인천·경기)" },
  { value: "nonmetro", label: "비수도권 (그 외)" },
];

export default function Page() {
  const [inst, setInst] = useState<InstKind>("univ");
  const [isChange, setIsChange] = useState(false);
  const [pickMode, setPickMode] = useState<PickMode>("name");
  const [univ, setUniv] = useState<UnivPick | null>(null);
  const [condTier, setCondTier] = useState<UnivTier>("certified");
  const [condRegion, setCondRegion] = useState<UnivRegion>("metro");
  const [origin, setOrigin] = useState("vn_south");
  const [status, setStatus] = useState("D-2-2");
  const [searched, setSearched] = useState(false);

  const track = inst === "hagwon" ? "new_d4" : isChange ? "change_d4_d2" : "new_d2";
  const originOpt = ORIGIN_OPTIONS.find((o) => o.value === origin)!;

  // 조회 대상(대학/조건) 확정
  const place: UnivPick | null =
    pickMode === "name" ? univ : { name: "", tier: condTier, region: condRegion };
  const canSearch = pickMode === "cond" || !!univ;

  const result = useMemo(() => {
    if (!place) return null;
    return lookup({
      track,
      nationality: originOpt.ctx.nationality as string,
      applicantRegion: (originOpt.ctx.applicantRegion ?? null) as string | null,
      univTier: place.tier,
      univRegion: place.region,
      statusCode: status,
    });
  }, [track, originOpt, status, place?.tier, place?.region]); // eslint-disable-line react-hooks/exhaustive-deps

  function changeInst(next: InstKind) {
    setInst(next);
    setUniv(null);
    setIsChange(false);
    setStatus(next === "hagwon" ? "D-4-1" : "D-2-2");
  }

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
              신청 상황을 고르면 제출 서류와 발급 조건을 정리해 드립니다. 기준일 {D.meta.compiledAt}.
            </p>
          )}
        </div>
      </header>

      <div style={{ maxWidth: 980, margin: "0 auto", padding: "20px 20px 64px" }}>
        {!searched ? (
          <InputForm
            {...{ inst, changeInst, isChange, setIsChange, pickMode, setPickMode, univ, setUniv, condTier, setCondTier, condRegion, setCondRegion, origin, setOrigin, status, setStatus }}
            canSearch={canSearch}
            onSearch={() => setSearched(true)}
          />
        ) : (
          <>
            <SummaryBar inst={inst} isChange={isChange} origin={originOpt.label} status={status} place={place!} onEdit={() => setSearched(false)} />
            {result && <Results result={result} />}
          </>
        )}
      </div>
    </main>
  );
}

/* ══════════════════════ 입력 폼 ══════════════════════ */
function InputForm(p: {
  inst: InstKind;
  changeInst: (v: InstKind) => void;
  isChange: boolean;
  setIsChange: (v: boolean) => void;
  pickMode: PickMode;
  setPickMode: (v: PickMode) => void;
  univ: UnivPick | null;
  setUniv: (v: UnivPick | null) => void;
  condTier: UnivTier;
  setCondTier: (v: UnivTier) => void;
  condRegion: UnivRegion;
  setCondRegion: (v: UnivRegion) => void;
  origin: string;
  setOrigin: (v: string) => void;
  status: string;
  setStatus: (v: string) => void;
  canSearch: boolean;
  onSearch: () => void;
}) {
  const instNoun = p.inst === "hagwon" ? "어학당" : "대학교";
  const statusOpts = statusOptionsFor(p.inst);
  return (
    <div style={{ background: "#fff", border: "1px solid var(--bdr)", borderRadius: 18, padding: 22, boxShadow: "var(--shadow-sm)" }}>
      <div style={{ display: "grid", gap: 18 }}>
        <Field label="지원 기관">
          <RadioGroup
            value={p.inst}
            onChange={(v) => p.changeInst(v as InstKind)}
            options={[
              { value: "univ", label: "대학교", desc: "학위과정 (D-2)" },
              { value: "hagwon", label: "어학당", desc: "어학연수 (D-4)" },
            ]}
          />
          {p.inst === "univ" && (
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 13, color: "var(--ink-mid)", cursor: "pointer" }}>
              <input type="checkbox" checked={p.isChange} onChange={(e) => p.setIsChange(e.target.checked)} style={{ width: 16, height: 16, accentColor: "var(--coral)" }} />
              이미 한국에서 어학연수(D-4) 중 → D-2로 국내 변경
            </label>
          )}
        </Field>

        <Field label="본인의 국적 및 거주지">
          <Dropdown value={p.origin} onChange={p.setOrigin} options={ORIGIN_OPTIONS.map((o) => ({ value: o.value, label: o.label, group: o.group }))} />
        </Field>

        <Field label={instNoun}>
          {/* 조회 방식 토글 */}
          <div style={{ marginBottom: 10 }}>
            <RadioGroup
              value={p.pickMode}
              onChange={(v) => p.setPickMode(v as PickMode)}
              options={[
                { value: "name", label: `${instNoun} 이름으로`, desc: "등급·지역 자동" },
                { value: "cond", label: "조건으로", desc: "등급 + 지역 직접" },
              ]}
              small
            />
          </div>
          {p.pickMode === "name" ? (
            <UnivPicker inst={p.inst} value={p.univ} onChange={p.setUniv} />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Dropdown value={p.condTier} onChange={(v) => p.setCondTier(v as UnivTier)} options={TIER_OPTS} />
              <Dropdown value={p.condRegion} onChange={(v) => p.setCondRegion(v as UnivRegion)} options={REGION_OPTS} />
            </div>
          )}
        </Field>

        <Field label="신청할 비자">
          <Dropdown value={p.status} onChange={p.setStatus} options={statusOpts.map((o) => ({ value: o.value, label: o.label, bold: EMPHASIZED_STATUS.has(o.value) }))} />
        </Field>
      </div>

      <button
        onClick={p.onSearch}
        disabled={!p.canSearch}
        style={{
          marginTop: 22,
          width: "100%",
          padding: "14px",
          borderRadius: 12,
          border: "none",
          background: p.canSearch ? "var(--coral)" : "var(--bdr-d)",
          color: "#fff",
          fontSize: 16,
          fontWeight: 800,
          cursor: p.canSearch ? "pointer" : "not-allowed",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        <Search size={18} /> 발급요건 조회
      </button>
      {!p.canSearch && (
        <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--ink-light)", textAlign: "center" }}>
          {instNoun}를 선택하면 조회할 수 있습니다.
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

/* ── 라디오 그룹 ──────────────────────────────────────── */
function RadioGroup({
  value,
  onChange,
  options,
  small,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; desc?: string }[];
  small?: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 10 }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              padding: small ? "8px 10px" : "12px 10px",
              borderRadius: small ? 10 : 12,
              border: `1.5px solid ${active ? "var(--coral)" : "var(--bdr-d)"}`,
              background: active ? "var(--coral-pale)" : "#fff",
              cursor: "pointer",
              transition: "all .12s",
            }}
          >
            <span style={{ fontSize: small ? 13.5 : 15, fontWeight: 800, color: active ? "var(--coral-d)" : "var(--ink)" }}>{o.label}</span>
            {o.desc && <span style={{ fontSize: small ? 11 : 12, color: active ? "var(--coral-d)" : "var(--ink-light)" }}>{o.desc}</span>}
          </button>
        );
      })}
    </div>
  );
}

/* ── 커스텀 드롭다운 ──────────────────────────────────── */
function Dropdown({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; bold?: boolean; group?: string }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutside(ref, () => setOpen(false));
  const sel = options.find((o) => o.value === value);
  let lastGroup: string | undefined;
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen((o) => !o)} style={selectBtn}>
        <span style={{ fontWeight: sel?.bold ? 800 : 500 }}>{sel?.label ?? "선택"}</span>
        <ChevronDown size={16} style={{ color: "var(--ink-light)", flexShrink: 0 }} />
      </button>
      {open && (
        <div style={dropdownPanel}>
          {options.map((o) => {
            const showGroup = o.group && o.group !== lastGroup;
            lastGroup = o.group;
            return (
              <div key={o.value}>
                {showGroup && <div style={{ fontSize: 11, color: "var(--ink-xlight)", padding: "6px 13px 2px", fontWeight: 700 }}>{o.group}</div>}
                <button
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  style={{ ...dropdownItem, fontWeight: o.bold ? 800 : 500, background: o.value === value ? "var(--coral-pale)" : "#fff" }}
                >
                  {o.label}
                  {o.value === value && <Check size={15} style={{ color: "var(--coral-d)", marginLeft: "auto" }} />}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── 기관 검색 피커 ───────────────────────────────────── */
function UnivPicker({ inst, value, onChange }: { inst: InstKind; value: UnivPick | null; onChange: (v: UnivPick | null) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useOutside(ref, () => setOpen(false));

  const pool = useMemo(() => (inst === "hagwon" ? UNIVERSITIES.filter((u) => u.lang) : UNIVERSITIES), [inst]);
  const all = useMemo(() => {
    const query = q.trim();
    return query ? pool.filter((u) => u.name.includes(query)) : pool;
  }, [q, pool]);
  const matches = all.slice(0, 60);

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
          <span style={{ color: "var(--ink-light)" }}>{inst === "hagwon" ? "어학당 운영 대학 검색" : "대학교 검색"}</span>
        )}
        <ChevronDown size={16} style={{ color: "var(--ink-light)", flexShrink: 0 }} />
      </button>
      {open && (
        <div style={{ ...dropdownPanel, maxHeight: 360, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: 8, borderBottom: "1px solid var(--bdr)", position: "sticky", top: 0, background: "#fff" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--peach)", borderRadius: 8, padding: "6px 10px" }}>
              <Search size={15} color="var(--ink-light)" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={inst === "hagwon" ? "어학당 운영 대학 검색 (예: 부산대)" : "대학명 입력 (예: 한양대, 거제대)"}
                style={{ border: "none", outline: "none", background: "transparent", fontSize: 13.5, width: "100%" }}
              />
              {q && <X size={15} style={{ cursor: "pointer", color: "var(--ink-light)" }} onClick={() => setQ("")} />}
            </div>
          </div>
          <div style={{ overflowY: "auto" }}>
            {matches.map((u) => (
              <button
                key={u.name}
                type="button"
                onClick={() => {
                  onChange({ name: u.name, tier: u.tier, region: u.region });
                  setOpen(false);
                  setQ("");
                }}
                style={dropdownItem}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</span>
                <TierBadge tier={u.tier} region={u.region} />
              </button>
            ))}
            {all.length > matches.length && (
              <div style={{ padding: "10px 14px", fontSize: 12, color: "var(--ink-light)", textAlign: "center" }}>
                {all.length}개 중 60개 표시 — 더 좁히려면 검색하세요.
              </div>
            )}
            {all.length === 0 && (
              <div style={{ padding: "16px", fontSize: 12.5, color: "var(--ink-light)", textAlign: "center" }}>
                목록에 없습니다. 위 &quot;조건으로&quot;에서 등급·지역을 직접 선택하세요.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
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
function SummaryBar({ inst, isChange, origin, status, place, onEdit }: { inst: InstKind; isChange: boolean; origin: string; status: string; place: UnivPick; onEdit: () => void }) {
  const instLabel = inst === "hagwon" ? "어학당 (D-4)" : isChange ? "대학교 · D-4→D-2 변경" : "대학교 (D-2)";
  const statusLabel = STATUS_OPTS.find((o) => o.value === status)?.label ?? status;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", border: "1px solid var(--bdr)", borderRadius: 14, padding: "12px 14px", marginBottom: 18, boxShadow: "var(--shadow-sm)", flexWrap: "wrap" }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 1, minWidth: 0 }}>
        <SumChip>{instLabel}</SumChip>
        <SumChip>{origin}</SumChip>
        <SumChip>{place.name ? `${place.name} · ` : ""}{TIER_LABEL[place.tier]} · {REGION_LABEL[place.region]}</SumChip>
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
  const finText = finProof.size > 1 ? "장학금 등 조건에 따라 다름" : valueLabel("finProof", [...finProof][0] ?? "required");

  const byGroup = useMemo(() => {
    const m = new Map<string, Candidate[]>();
    for (const c of candidates) {
      const k = docGroupKey(c.rule);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(c);
    }
    return m;
  }, [candidates]);

  const submit = DOC_GROUPS.filter((g) => g.section === "submit" && byGroup.get(g.key)?.length);
  const cond = DOC_GROUPS.filter((g) => g.section === "condition" && byGroup.get(g.key)?.length);

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

      {/* ── 제출 서류 ── */}
      <SectionHead icon={<ClipboardList size={18} />} title="제출 서류" sub="비자 신청 시 준비할 서류. 각 서류를 펼치면 세부 절차·규칙이 나옵니다." />
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 30 }}>
        {submit.map((g) => (
          <SubmitCard key={g.key} def={g} list={byGroup.get(g.key)!} defaultOpen={g.key === "basic"} />
        ))}
      </div>

      {/* ── 발급 조건 ── */}
      <SectionHead icon={<FileText size={18} />} title="발급 조건 및 유의사항" sub="서류 외에 발급 가능성·경로·기간 등 판정에 영향을 주는 조건." />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {cond.map((g) => (
          <ConditionCard key={g.key} title={DOC_GROUPS.find((d) => d.key === g.key)!.title} list={byGroup.get(g.key)!} />
        ))}
      </div>

      {nonConfirmed.length > 0 && (
        <p style={{ fontSize: 12.5, color: "var(--ink-light)", marginTop: 16 }}>
          ※ 적용 요건 중 <b>{nonConfirmed.length}건</b>은 확정되지 않았습니다(유추·자료충돌·미확인). 확정 안내로 쓰지 말고 관할 공관에 확인하세요.
        </p>
      )}
    </div>
  );
}

function SectionHead({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: "var(--coral-d)" }}>{icon}</span>
        <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>{title}</h2>
      </div>
      <p style={{ margin: "4px 0 0 26px", fontSize: 12.5, color: "var(--ink-light)" }}>{sub}</p>
    </div>
  );
}

/* ── 서류 카드 (펼침형 체크리스트 항목) ───────────────── */
function SubmitCard({ def, list, defaultOpen }: { def: { key: string; title: string; intro?: string }; list: Candidate[]; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  const hasBlocker = list.some((c) => c.rule.kind === "blocker");
  const hasCond = list.some((c) => c.tags.length > 0);
  const hasUnconfirmed = list.some((c) => c.rule.confidence !== "confirmed");

  // 서류(doc) 단위 하위 묶음
  const docs = useMemo(() => {
    const m = new Map<string, Candidate[]>();
    for (const c of list) {
      const k = ANN[c.rule.id]?.doc ?? ANN[c.rule.id]?.title ?? c.rule.title;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(c);
    }
    return [...m.entries()];
  }, [list]);

  return (
    <div style={{ background: "#fff", border: `1px solid ${hasBlocker ? "#f3c6c1" : "var(--bdr)"}`, borderLeft: `4px solid ${hasBlocker ? "#b3261e" : "var(--coral)"}`, borderRadius: 12, overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
      <button onClick={() => setOpen((o) => !o)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", border: "none", background: "none", cursor: "pointer", textAlign: "left" }}>
        <span style={{ flex: 1 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 15.5, fontWeight: 800 }}>{def.title}</span>
            <span style={{ fontSize: 11.5, color: "var(--ink-xlight)" }}>{docs.length}개 항목</span>
            {hasCond && <span style={badge("var(--blue)", "#eaf2fb")}>조건부</span>}
            {hasUnconfirmed && <span style={badge("#b3261e", "#fdecea")}>미확정</span>}
          </span>
          {def.intro && <span style={{ display: "block", fontSize: 12.5, color: "var(--ink-light)", marginTop: 4 }}>{def.intro}</span>}
        </span>
        <ChevronDown size={18} style={{ color: "var(--ink-light)", flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
      </button>

      {open && (
        <div style={{ borderTop: "1px solid var(--bdr)", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
          {docs.map(([docKey, rules]) => (
            <DocBlock key={docKey} title={docKey} rules={rules} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── 서류 안의 개별 규정 묶음 ─────────────────────────── */
function DocBlock({ title, rules }: { title: string; rules: Candidate[] }) {
  const [showRaw, setShowRaw] = useState(false);
  return (
    <div>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {rules.map((c) => (
          <div key={c.rule.id} style={{ display: "flex", gap: 7, alignItems: "baseline" }}>
            <span style={{ color: "var(--coral)", flexShrink: 0, fontSize: 12 }}>•</span>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 13, color: "var(--ink-mid)" }}>{ANN[c.rule.id]?.terse ?? c.rule.title}</span>
              {c.tags.length > 0 && (
                <span style={{ display: "inline-flex", gap: 5, flexWrap: "wrap", marginLeft: 7, verticalAlign: "middle" }}>
                  {c.tags.map((t, i) => (
                    <Tag key={i} tag={t} />
                  ))}
                </span>
              )}
              {showRaw && <div style={{ fontSize: 12, color: "var(--ink-light)", lineHeight: 1.6, marginTop: 3 }}>{c.rule.body}</div>}
            </div>
          </div>
        ))}
      </div>
      <button onClick={() => setShowRaw((s) => !s)} style={{ marginTop: 6, border: "none", background: "none", padding: 0, cursor: "pointer", fontSize: 11.5, fontWeight: 700, color: "var(--ink-xlight)" }}>
        {showRaw ? "규정 원문 닫기" : "규정 원문 보기"}
      </button>
    </div>
  );
}

/* ── 조건 카드 ────────────────────────────────────────── */
function ConditionCard({ title, list }: { title: string; list: Candidate[] }) {
  const hasBlocker = list.some((c) => c.rule.kind === "blocker");
  const hasUnconfirmed = list.some((c) => c.rule.confidence !== "confirmed");
  return (
    <div style={{ background: "#fff", border: `1px solid ${hasBlocker ? "#f3c6c1" : "var(--bdr)"}`, borderLeft: `4px solid ${hasBlocker ? "#b3261e" : "var(--ink-xlight)"}`, borderRadius: 12, padding: "13px 15px", boxShadow: "var(--shadow-sm)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 14.5, fontWeight: 800 }}>{title}</span>
        {hasUnconfirmed && <span style={badge("#b3261e", "#fdecea")}>미확정</span>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {list.map((c) => (
          <div key={c.rule.id} style={{ display: "flex", gap: 7, alignItems: "baseline" }}>
            <span style={{ color: c.rule.kind === "blocker" ? "#b3261e" : "var(--ink-xlight)", flexShrink: 0, fontSize: 12 }}>•</span>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 13, color: c.rule.kind === "blocker" ? "#b3261e" : "var(--ink-mid)", fontWeight: c.rule.kind === "blocker" ? 700 : 400 }}>
                {ANN[c.rule.id]?.terse ?? c.rule.title}
              </span>
              {c.tags.length > 0 && (
                <span style={{ display: "inline-flex", gap: 5, flexWrap: "wrap", marginLeft: 7, verticalAlign: "middle" }}>
                  {c.tags.map((t, i) => (
                    <Tag key={i} tag={t} />
                  ))}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Tag({ tag }: { tag: OptionTag }) {
  const label = tag.values.map((v) => valueLabel(tag.axis, v)).join(" / ");
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color: tag.negate ? "var(--ink-light)" : "var(--navy)", background: tag.negate ? "#f2f2f4" : "#eef2f8", border: "1px solid var(--bdr)", padding: "1px 8px", borderRadius: 999, whiteSpace: "nowrap" }}>
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
  maxHeight: 320,
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
