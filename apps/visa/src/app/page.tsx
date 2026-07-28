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
import { ANN, DOCUMENTS, docOf } from "@/data/annotations";
import { UNIVERSITIES } from "@/data/universities";
import { DOCUMENTS_DATA, DOC_CATEGORY_ORDER, type VisaDoc, type Holder, type HolderWho } from "@/data/documents";

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
  const matches = useMemo(() => {
    const query = q.trim();
    return query ? pool.filter((u) => u.name.includes(query)) : pool;
  }, [q, pool]);

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
            <div style={{ fontSize: 11, color: "var(--ink-xlight)", padding: "6px 14px 2px" }}>{matches.length}개</div>
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
            {matches.length === 0 && (
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
const CONDITION_KEYS = new Set(["eligibility", "channel", "duration", "jurisdiction", "process"]);

function Results({ result }: { result: { finProof: Set<string>; candidates: Candidate[] } }) {
  const { candidates } = result;
  const blockers = candidates.filter((c) => c.rule.kind === "blocker");
  const candMap = useMemo(() => new Map(candidates.map((c) => [c.rule.id, c])), [candidates]);

  // 제출 서류 = documents.ts (적용 조항이 하나라도 후보인 서류), 카테고리 순
  const submitByCat = useMemo(() => {
    const applies = DOCUMENTS_DATA.filter((d) => (d.ruleRefs ?? []).some((id) => candMap.has(id)));
    return DOC_CATEGORY_ORDER.map((cat) => ({ cat, docs: applies.filter((d) => d.category === cat) })).filter((g) => g.docs.length);
  }, [candMap]);

  // 발급 조건 = 서류가 아닌 조항(조건 그룹)
  const condByKey = useMemo(() => {
    const m = new Map<string, Candidate[]>();
    for (const c of candidates) {
      const k = docOf(c.rule);
      if (CONDITION_KEYS.has(k)) {
        if (!m.has(k)) m.set(k, []);
        m.get(k)!.push(c);
      }
    }
    return m;
  }, [candidates]);
  const cond = DOCUMENTS.filter((d) => d.section === "condition" && condByKey.get(d.key)?.length);

  return (
    <div>
      {blockers.length > 0 && (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "#fdecea", border: "1px solid #f3c6c1", color: "#b3261e", borderRadius: 12, padding: "12px 14px", fontSize: 13.5, marginBottom: 18 }}>
          <ShieldAlert size={18} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            <b>발급이 제한·불가할 수 있습니다.</b> {blockers.map((b) => ANN[b.rule.id]?.title ?? b.rule.title).join(" · ")}
          </span>
        </div>
      )}

      <SectionHead icon={<ClipboardList size={18} />} title="제출 서류" sub="비자 신청 시 준비할 서류. 서류명을 펼치면 발급기관·형식·명의·유효기간 등 세부가 나옵니다." />
      <div style={{ marginBottom: 28 }}>
        {submitByCat.map(({ cat, docs }) => (
          <div key={cat} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-xlight)", margin: "0 2px 7px", letterSpacing: 0.3 }}>{cat}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {docs.map((d) => (
                <DocuCard key={d.id} doc={d} rules={(d.ruleRefs ?? []).map((id) => candMap.get(id)).filter(Boolean) as Candidate[]} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <SectionHead icon={<FileText size={18} />} title="발급 조건" sub="서류 외에 발급 여부·경로·기간에 영향을 주는 조건." />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {cond.map((d) => (
          <DocCard key={d.key} def={d} list={condByKey.get(d.key)!} />
        ))}
      </div>
    </div>
  );
}

/* ── 명의(holder) 강조 ─────────────────────────────────── */
const WHO_LABEL: Record<HolderWho, string> = {
  self: "본인",
  father: "아버지",
  mother: "어머니",
  family: "부모 외 가족",
  kr_family: "한국 국적 가족",
  professor: "지도교수",
  company: "회사",
  institution: "기관 발급",
  na: "",
};
function holderText(h: Holder): { text: string; suffix: string } {
  const labels = h.who.map((w) => WHO_LABEL[w]).filter(Boolean);
  if (h.logic === "allOf") return { text: labels.join(" + "), suffix: " 모두 제출" };
  if (h.logic === "anyOf") return { text: labels.join(" / "), suffix: " 중 1인 이상" };
  if (h.logic === "oneOf") return { text: labels.join(" / "), suffix: labels.length > 1 ? " 중 택1" : "" };
  return { text: labels.join(" / "), suffix: "" };
}
function HolderBadge({ holder }: { holder: Holder }) {
  const { text, suffix } = holderText(holder);
  const amb = holder.ambiguous;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 11.5,
        fontWeight: 800,
        color: amb ? "#b3261e" : "var(--navy)",
        background: amb ? "#fdecea" : "#e8eef6",
        border: `1px solid ${amb ? "#f3c6c1" : "#cdd9ea"}`,
        padding: "2px 9px",
        borderRadius: 999,
        whiteSpace: "nowrap",
      }}
      title={holder.note}
    >
      {amb && <ShieldAlert size={12} />}
      명의: {text}
      {suffix}
      {amb ? " · 확인필요" : ""}
    </span>
  );
}

/* ── 서류 카드 (documents.ts 정본) ────────────────────── */
function DocuCard({ doc, rules }: { doc: VisaDoc; rules: Candidate[] }) {
  const [open, setOpen] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const showHolder = doc.holder && doc.holder.logic !== "na";
  const summary = [doc.issuer.join("·"), doc.form + (doc.bringOriginal ? "(원본지참)" : "")].join(" · ");

  return (
    <div style={{ background: "#fff", border: `1px solid ${doc.holder?.ambiguous ? "#f3c6c1" : "var(--bdr)"}`, borderLeft: "4px solid var(--coral)", borderRadius: 12, overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
      <button onClick={() => setOpen((o) => !o)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "13px 16px", border: "none", background: "none", cursor: "pointer", textAlign: "left" }}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
            <span style={{ fontSize: 15, fontWeight: 800 }}>{doc.name}</span>
            {showHolder && doc.holder && (doc.holder.ambiguous || doc.holder.who.length > 1) && <HolderBadge holder={doc.holder} />}
            {doc.confidence !== "confirmed" && <span style={badge("#b3261e", "#fdecea")}>미확정</span>}
          </span>
          <span style={{ display: "block", fontSize: 12.5, color: "var(--ink-light)", marginTop: 3 }}>{summary}</span>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0, color: "var(--ink-light)", fontSize: 12, fontWeight: 700 }}>
          {open ? "닫기" : "세부"}
          <ChevronDown size={17} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
        </span>
      </button>

      {open && (
        <div style={{ borderTop: "1px solid var(--bdr)", padding: "12px 16px" }}>
          <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 12px", fontSize: 12.5 }}>
            <Attr k="발급기관" v={doc.issuer.join(", ")} />
            <Attr k="형식" v={doc.form + (doc.bringOriginal ? " · 대조용 원본 지참" : "")} />
            {doc.validity && <Attr k="유효기간" v={validityText(doc.validity)} />}
            {showHolder && doc.holder && <Attr k="명의" v={<HolderInline holder={doc.holder} />} highlight={doc.holder.ambiguous} />}
            {doc.translation && <Attr k="번역" v={doc.translation.required ? `필요 (${(doc.translation.langs ?? ["ko", "en"]).map((l) => (l === "ko" ? "국문" : "영문")).join("/")})${doc.translation.note ? " · " + doc.translation.note : ""}` : "불요"} />}
            {doc.notarization?.required && <Attr k="공증" v={`필요${doc.notarization.by ? " · " + doc.notarization.by : ""}`} />}
            {doc.authentication?.required && <Attr k="영사확인" v={`${(doc.authentication.chain ?? []).join(" → ")}${doc.authentication.validityDays ? ` (${doc.authentication.validityDays}일 이내)` : ""}`} />}
            {doc.signature?.handwrittenOnly && <Attr k="서명" v={`친필 서명 원본만${doc.signature.note ? " · " + doc.signature.note : ""}`} />}
            <Attr k="발급 소요일" v={doc.obtainDays ?? "미상 (전문가 자료 대기)"} />
            {doc.appliesTo && <Attr k="적용 대상" v={doc.appliesTo} />}
          </dl>

          {(() => {
            // DOC-* 는 여러 서류를 나열한 '묶음 규정' → 목록(terse)은 숨기고 적용상황(태그)만.
            const substantive = rules.filter((c) => c.rule.group !== "documents");
            const bundleTags: OptionTag[] = [];
            const seen = new Set<string>();
            for (const c of rules.filter((c) => c.rule.group === "documents")) {
              for (const t of c.tags) {
                const key = `${t.axis}|${t.values.join(",")}|${t.negate ? "!" : ""}`;
                if (!seen.has(key)) { seen.add(key); bundleTags.push(t); }
              }
            }
            if (substantive.length === 0 && bundleTags.length === 0) return null;
            return (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--coral-d)", marginBottom: 6 }}>적용 조건 (선택 상황 기준)</div>
                {bundleTags.length > 0 && (
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center", marginBottom: substantive.length ? 8 : 0 }}>
                    <span style={{ fontSize: 12, color: "var(--ink-light)" }}>적용 상황</span>
                    {bundleTags.map((t, i) => (
                      <Tag key={i} tag={t} />
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {substantive.map((c) => (
                    <div key={c.rule.id} style={{ display: "flex", gap: 7, alignItems: "baseline" }}>
                      <span style={{ color: "var(--coral)", flexShrink: 0, fontSize: 12 }}>•</span>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: 12.5, color: "var(--ink-mid)" }}>{ANN[c.rule.id]?.terse ?? c.rule.title}</span>
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
                {substantive.length > 0 && (
                  <>
                    <button onClick={() => setShowRaw((s) => !s)} style={{ marginTop: 8, border: "none", background: "none", padding: 0, cursor: "pointer", fontSize: 11.5, fontWeight: 700, color: "var(--ink-xlight)" }}>
                      {showRaw ? "규정 원문 닫기" : "규정 원문 보기"}
                    </button>
                    {showRaw && (
                      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                        {substantive.map((c) => (
                          <div key={c.rule.id} style={{ fontSize: 12, color: "var(--ink-light)", lineHeight: 1.6 }}>
                            <b style={{ color: "var(--ink-mid)" }}>{ANN[c.rule.id]?.title ?? c.rule.title}</b> — {c.rule.body}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })()}

          {doc.ambiguities && doc.ambiguities.length > 0 && (
            <div style={{ marginTop: 12, fontSize: 11.5, color: "#8a6d1a", background: "#fff7e0", border: "1px solid #f0dca0", borderRadius: 8, padding: "7px 10px" }}>
              확인 필요: {doc.ambiguities.join(" / ")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Attr({ k, v, highlight }: { k: string; v: React.ReactNode; highlight?: boolean }) {
  return (
    <>
      <dt style={{ fontWeight: 700, color: "var(--ink-light)", whiteSpace: "nowrap" }}>{k}</dt>
      <dd style={{ margin: 0, color: highlight ? "#b3261e" : "var(--ink-mid)" }}>{v}</dd>
    </>
  );
}
function HolderInline({ holder }: { holder: Holder }) {
  const { text, suffix } = holderText(holder);
  return (
    <span style={{ fontWeight: holder.ambiguous ? 800 : 600, color: holder.ambiguous ? "#b3261e" : "var(--ink-mid)" }}>
      {text}
      {suffix}
      {holder.note ? <span style={{ display: "block", fontWeight: 400, color: "var(--ink-light)", marginTop: 2 }}>{holder.note}</span> : null}
    </span>
  );
}
function validityText(v: import("@/data/documents").Validity): string {
  if (v.byStage && v.byStage.length) {
    return v.byStage.map((s) => `${s.stage} ${s.days}일`).join(" / ") + (v.note ? ` · ${v.note}` : "");
  }
  if (v.days) return `${v.days}일${v.basis ? ` (${v.basis} 기준)` : ""}${v.note ? ` · ${v.note}` : ""}`;
  return v.note ?? "-";
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

/* ── 서류/조건 카드 (서류명 + 한 줄 핵심 → 펼치면 세부조건) ── */
function DocCard({ def, list }: { def: { key: string; name: string; section: string; headline?: string }; list: Candidate[] }) {
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState(false);
  const isCond = def.section === "condition";
  const hasBlocker = list.some((c) => c.rule.kind === "blocker");
  const hasCondTag = list.some((c) => c.tags.length > 0);
  const hasUnconfirmed = list.some((c) => c.rule.confidence !== "confirmed");
  const accent = hasBlocker ? "#b3261e" : isCond ? "var(--ink-xlight)" : "var(--coral)";

  return (
    <div style={{ background: "#fff", border: `1px solid ${hasBlocker ? "#f3c6c1" : "var(--bdr)"}`, borderLeft: `4px solid ${accent}`, borderRadius: 12, overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
      <button onClick={() => setOpen((o) => !o)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "13px 16px", border: "none", background: "none", cursor: "pointer", textAlign: "left" }}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
            <span style={{ fontSize: 15, fontWeight: 800 }}>{def.name}</span>
            {hasCondTag && !isCond && <span style={badge("var(--blue)", "#eaf2fb")}>조건부</span>}
            {hasUnconfirmed && <span style={badge("#b3261e", "#fdecea")}>미확정</span>}
          </span>
          <span style={{ display: "block", fontSize: 12.5, color: "var(--ink-light)", marginTop: 3 }}>
            {def.headline ?? (open ? "" : `세부 조건 ${list.length}건`)}
          </span>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0, color: "var(--ink-light)", fontSize: 12, fontWeight: 700 }}>
          {open ? "닫기" : "세부 조건"}
          <ChevronDown size={17} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
        </span>
      </button>

      {open && (
        <div style={{ borderTop: "1px solid var(--bdr)", padding: "12px 16px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {list.map((c) => {
              const blk = c.rule.kind === "blocker";
              return (
                <div key={c.rule.id} style={{ display: "flex", gap: 7, alignItems: "baseline" }}>
                  <span style={{ color: blk ? "#b3261e" : accent, flexShrink: 0, fontSize: 12 }}>•</span>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 13, color: blk ? "#b3261e" : "var(--ink-mid)", fontWeight: blk ? 700 : 400 }}>
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
              );
            })}
          </div>
          <button onClick={() => setRaw((s) => !s)} style={{ marginTop: 10, border: "none", background: "none", padding: 0, cursor: "pointer", fontSize: 11.5, fontWeight: 700, color: "var(--ink-xlight)" }}>
            {raw ? "규정 원문 닫기" : "규정 원문 보기"}
          </button>
          {raw && (
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
              {list.map((c) => (
                <div key={c.rule.id} style={{ fontSize: 12, color: "var(--ink-light)", lineHeight: 1.6 }}>
                  <b style={{ color: "var(--ink-mid)" }}>{ANN[c.rule.id]?.title ?? c.rule.title}</b> — {c.rule.body}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
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
