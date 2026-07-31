"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Search, ChevronDown, ShieldAlert, Pencil, Building2, Check, X } from "lucide-react";
import { D, ORIGIN_OPTIONS, EMPHASIZED_STATUS, type UnivRegion, type UnivTier } from "@/data/engine";
import { UNIVERSITIES } from "@/data/universities";
import { judge, sectionNeeded, DOCS, SECTIONS, docAttrRaws, balanceTags, UNVERIFIED, type Course, type Section, type ChecklistDoc, type Tier, type Region } from "@/data/checklist";
import { flowOf, PROCESS_STEPS, TRACK_META, type FlowResult } from "@/data/process";
import { EditProvider, useEdit } from "@/lib/edits";

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
  tier: UnivTier; // 학위과정 등급
  region: UnivRegion;
  lang?: boolean; // 어학연수 인증 여부
  langRestricted?: boolean; // 어학연수 정밀심사
}

const TIER_OPTS: { value: UnivTier; label: string }[] = [
  { value: "excellent", label: "우수 인증대학" },
  { value: "certified", label: "인증대학" },
  { value: "general", label: "미인증(일반) 대학" },
  { value: "consulting", label: "컨설팅대학 (비자심사 강화)" },
  { value: "restricted", label: "비자정밀 심사대학" },
];
// 어학당(D-4-1) 어학연수 등급
const LANG_TIER_OPTS: { value: UnivTier; label: string }[] = [
  { value: "certified", label: "어학연수 인증" },
  { value: "general", label: "어학연수 일반(미인증)" },
  { value: "restricted", label: "어학연수 정밀심사" },
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
  const [condLangTier, setCondLangTier] = useState<UnivTier>("certified");
  const [condRegion, setCondRegion] = useState<UnivRegion>("metro");
  const [origin, setOrigin] = useState("vn");
  const [status, setStatus] = useState("D-2-2");
  const [searched, setSearched] = useState(false);

  const originOpt = ORIGIN_OPTIONS.find((o) => o.value === origin)!;

  // 조회 대상(대학/조건) 확정
  const place: UnivPick | null =
    pickMode === "name" ? univ : { name: "", tier: condTier, region: condRegion, lang: condLangTier === "certified", langRestricted: condLangTier === "restricted" };
  const canSearch = pickMode === "cond" || !!univ;

  // 판정 입력: 학위과정 등급 / 어학연수 등급 / 지역
  const degreeTier: UnivTier = pickMode === "name" ? univ?.tier ?? "certified" : condTier;
  const langTier: UnivTier = pickMode === "name" ? (univ?.langRestricted ? "restricted" : univ?.lang ? "certified" : "general") : condLangTier;
  const region2: UnivRegion = pickMode === "name" ? univ?.region ?? "metro" : condRegion;

  function changeInst(next: InstKind) {
    setInst(next);
    setUniv(null);
    setIsChange(false);
    setStatus(next === "hagwon" ? "D-4-1" : "D-2-2");
  }

  return (
    <EditProvider>
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
            {...{ inst, changeInst, isChange, setIsChange, pickMode, setPickMode, univ, setUniv, condTier, setCondTier, condLangTier, setCondLangTier, condRegion, setCondRegion, origin, setOrigin, status, setStatus }}
            canSearch={canSearch}
            onSearch={() => setSearched(true)}
          />
        ) : (
          <>
            <SummaryBar inst={inst} isChange={isChange} origin={originOpt.label} status={status} place={place!} onEdit={() => setSearched(false)} />
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
              <Link href="/edit" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, color: "var(--ink-light)", textDecoration: "none", border: "1px solid var(--bdr)", borderRadius: 9, padding: "6px 11px", background: "#fff" }}>
                <Pencil size={13} /> 서류 내용 편집
              </Link>
            </div>
            {place && (
              <Results
                course={inst === "hagwon" ? "hagwon" : "univ"}
                degreeTier={degreeTier}
                langTier={langTier}
                region={region2}
                nationality={originOpt.ctx.nationality as string}
                applicantRegion={(originOpt.ctx.applicantRegion ?? null) as string | null}
                status={status}
                isChange={isChange}
              />
            )}
          </>
        )}
      </div>
    </main>
    </EditProvider>
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
  condLangTier: UnivTier;
  setCondLangTier: (v: UnivTier) => void;
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
          ) : p.inst === "hagwon" ? (
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <LabeledDropdown label="학위과정 등급" value={p.condTier} onChange={(v) => p.setCondTier(v as UnivTier)} options={TIER_OPTS} />
                <LabeledDropdown label="어학연수 등급" value={p.condLangTier} onChange={(v) => p.setCondLangTier(v as UnivTier)} options={LANG_TIER_OPTS} />
              </div>
              <Dropdown value={p.condRegion} onChange={(v) => p.setCondRegion(v as UnivRegion)} options={REGION_OPTS} />
            </div>
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
function LabeledDropdown({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label style={{ display: "block" }}>
      <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink-light)", display: "block", marginBottom: 4 }}>{label}</span>
      <Dropdown value={value} onChange={onChange} options={options} />
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

  const pool = UNIVERSITIES; // 어학당도 전체 대학(어학 인증/일반 모두)
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
                  onChange({ name: u.name, tier: u.tier, region: u.region, lang: u.lang, langRestricted: u.langRestricted });
                  setOpen(false);
                  setQ("");
                }}
                style={dropdownItem}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</span>
                <span style={{ display: "inline-flex", gap: 4, marginLeft: "auto", flexShrink: 0 }}>
                  {inst === "hagwon" && (
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: "#fff", background: u.langRestricted ? "#b3261e" : u.lang ? "var(--blue)" : "var(--ink-light)", padding: "1px 7px", borderRadius: 999 }}>{u.langRestricted ? "어학정밀" : u.lang ? "어학인증" : "어학일반"}</span>
                  )}
                  <TierBadge tier={u.tier} region={u.region} />
                </span>
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
    <span style={{ display: "inline-flex", gap: 4, flexShrink: 0 }}>
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
        <SumChip>
          {place.name ? `${place.name} · ` : ""}
          {inst === "hagwon" ? `학위 ${TIER_LABEL[place.tier]} · 어학 ${place.langRestricted ? "정밀" : place.lang ? "인증" : "일반"}` : TIER_LABEL[place.tier]}
          {` · ${REGION_LABEL[place.region]}`}
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
const SECTION_EMOJI: Record<Section, string> = {
  "신분·공통": "🪪",
  "학력": "🎓",
  "재정": "💰",
  "건강": "🩺",
  "어학": "🗣️",
};

function Results({
  course,
  degreeTier,
  langTier,
  region,
  nationality,
  applicantRegion,
  status,
  isChange,
}: {
  course: Course;
  degreeTier: UnivTier;
  langTier: UnivTier;
  region: UnivRegion;
  nationality: string;
  applicantRegion: string | null;
  status: string;
  isChange: boolean;
}) {
  const v = useMemo(() => judge(course, degreeTier as Tier, langTier as Tier, region as Region, nationality, status), [course, degreeTier, langTier, region, nationality, status]);
  const flow = useMemo(() => flowOf(course, degreeTier as Tier, langTier as Tier), [course, degreeTier, langTier]);
  const docName = (id: string) => DOCS.find((d) => d.id === id)?.name ?? id;

  if (flow.impossible) {
    return (
      <div style={{ background: "#fff", border: "1px solid var(--bdr)", borderRadius: 14, padding: "16px 18px", fontSize: 13.5, color: "var(--ink-mid)", lineHeight: 1.6 }}>
        제도상 발생하지 않는 조합입니다(어학연수 인증은 학위과정 인증이 전제). 등급을 다시 확인해 주세요.
      </div>
    );
  }
  if (flow.track === "blocked") {
    const doctoral = course === "univ" && ["D-2-4", "D-2-5"].includes(status);
    return (
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", background: "#fdecea", border: "1px solid #f3c6c1", color: "#b3261e", borderRadius: 14, padding: "16px 18px" }}>
        <ShieldAlert size={22} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>발급 제한 (흐름 {flow.key})</div>
          <div style={{ fontSize: 13.5, marginTop: 4, lineHeight: 1.6 }}>
            {course === "hagwon" ? "어학연수 정밀심사 대학은 어학연수 비자 발급이 제한됩니다." : "학위 정밀심사 대학은 학사·석사 신규 비자가 제한됩니다."}
            {doctoral && " 다만 박사·연구과정은 사증발급인정서 경로로 신청할 수 있습니다(이 문서 범위 밖 — 관할 공관 확인)."}
          </div>
        </div>
      </div>
    );
  }

  const sections = SECTIONS.filter((s) => sectionNeeded(s, v, course, nationality));

  return (
    <div>
      <ProcessStepper flow={flow} />
      {isChange && <Callout tone="blue">국내 변경(D-4→D-2)은 관할 출입국·외국인청에 접수합니다(하이코리아). 결핵진단서·영사확인·번역공증은 면제됩니다.</Callout>}
      {v.financeCaveat && <Callout tone="amber">{v.financeCaveat}</Callout>}
      {v.notes.map((n, i) => (
        <Callout key={i} tone="amber">{n}</Callout>
      ))}

      <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 24 }}>
        {sections.map((sec) => {
          const docs = DOCS.filter(
            (d) =>
              d.section === sec &&
              d.courses.includes(course) &&
              (d.onlyVN ? nationality === "vn" : true) &&
              (d.onlyNorth ? applicantRegion === "vn_north" : true) &&
              !(isChange && d.id === "tb")
          );
          if (!docs.length) return null;
          return (
            <div key={sec}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 17 }}>{SECTION_EMOJI[sec]}</span>
                <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>{sec}</h3>
                <span style={{ fontSize: 12, color: "var(--ink-xlight)" }}>{docs.length}건</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {docs.map((d) => (
                  <DocRow key={d.id} doc={d} docName={docName} ctx={{ course, region: region as Region, tier: degreeTier as Tier, langTier: langTier as Tier }} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProcessStepper({ flow }: { flow: FlowResult }) {
  const meta = TRACK_META[flow.track];
  const last = PROCESS_STEPS.length - 1;
  return (
    <div style={{ background: "#fff", border: "1px solid var(--bdr)", borderRadius: 14, padding: "16px 18px", boxShadow: "var(--shadow-sm)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <span style={{ fontSize: 15, fontWeight: 800 }}>지원 프로세스</span>
        <span style={{ fontSize: 12.5, fontWeight: 800, color: "#fff", background: meta.color, padding: "4px 12px", borderRadius: 999 }}>{meta.label}</span>
        <span style={{ fontSize: 11.5, color: "var(--ink-xlight)" }}>흐름 {flow.key}</span>
      </div>
      <div style={{ display: "flex", overflowX: "auto", paddingBottom: 4 }}>
        {PROCESS_STEPS.map((title, i) => {
          const cell = flow.steps[i];
          const empty = !cell;
          return (
            <div key={i} style={{ flex: "1 0 150px", minWidth: 150, display: "flex", flexDirection: "column" }}>
              {/* 번호 + 가로 연결선 */}
              <div style={{ display: "flex", alignItems: "center", height: 24 }}>
                <span style={{ flex: 1, height: 2, background: i === 0 ? "transparent" : "var(--bdr-d)" }} />
                <span style={{ width: 24, height: 24, borderRadius: 999, background: empty ? "var(--bdr-d)" : meta.color, color: "#fff", fontSize: 11.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
                <span style={{ flex: 1, height: 2, background: i === last ? "transparent" : "var(--bdr-d)" }} />
              </div>
              <div style={{ padding: "8px 8px 0", textAlign: "center" }}>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: empty ? "var(--ink-xlight)" : "var(--ink)" }}>{title}</div>
                {empty ? (
                  <div style={{ fontSize: 11.5, color: "var(--ink-xlight)", marginTop: 4 }}>{i === 0 ? "사전 준비 없음" : "해당 없음"}</div>
                ) : (
                  <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 5, textAlign: "left" }}>
                    {cell.split(" / ").map((line, j) => (
                      <StepLine key={j} text={line} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const ACTOR_COLOR: Record<string, string> = { 학생: "var(--coral-d)", 대학: "var(--blue)", 출입국: "var(--navy)", 대사관: "var(--green)" };
function StepLine({ text }: { text: string }) {
  const m = text.match(/^【([^】]+)】\s*(.*)$/);
  if (m) {
    return (
      <div style={{ fontSize: 12.5, color: "var(--ink-mid)", lineHeight: 1.5 }}>
        <span style={{ fontSize: 10.5, fontWeight: 800, color: "#fff", background: ACTOR_COLOR[m[1]] ?? "var(--ink-light)", padding: "1px 6px", borderRadius: 6, marginRight: 5 }}>{m[1]}</span>
        {m[2]}
      </div>
    );
  }
  return <div style={{ fontSize: 12.5, color: "var(--ink-mid)", lineHeight: 1.5 }}>{text}</div>;
}

/**
 * 조회 결과의 서류 카드(읽기 전용).
 * 편집값(이름·설명·속성·숨김·추가태그·조건별 값)은 편집 페이지(/edit)에서 저장한 값을 반영한다.
 * ★ 태그 = 조건별 값(조회 조건마다 달라짐). ★ 없는 태그 = 공용 값(모든 조건 공통).
 */
function DocRow({ doc, docName, ctx }: { doc: ChecklistDoc; docName: (id: string) => string; ctx: { course: Course; region: Region; tier: Tier; langTier: Tier } }) {
  const [open, setOpen] = useState(false);
  const { get } = useEdit();

  const attrs = docAttrRaws(doc, docName).map((a) => {
    const path = `doc:${doc.id}:${a.key}`;
    const val = get(path, a.raw);
    return { ...a, path, val, missing: val === UNVERIFIED };
  });

  const hidden: string[] = JSON.parse(get(`doc:${doc.id}:_hidden`, "[]"));
  const extra: { label: string; value: string }[] = JSON.parse(get(`doc:${doc.id}:_extra`, "[]"));
  const visibleAttrs = attrs.filter((a) => !hidden.includes(a.key));

  // ★ 조건별 값(조회 조건에 맞춰 계산 + 편집값 반영)
  const dynTags = doc.id === "balance" ? balanceTags(ctx.course, ctx.region, ctx.tier, ctx.langTier, get).map((t) => `★${t}`) : [];
  const collapsedTags = [...dynTags, ...visibleAttrs.filter((a) => !a.missing).map((a) => a.val), ...extra.filter((e) => e.value.trim()).map((e) => e.value)];

  return (
    <div
      onClick={() => setOpen((o) => !o)}
      style={{ background: "#fff", border: `1px solid ${doc.ambiguous ? "#f3c6c1" : "var(--bdr)"}`, borderLeft: "4px solid var(--coral)", borderRadius: 12, padding: "13px 16px", boxShadow: "var(--shadow-sm)", cursor: "pointer" }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: 15, fontWeight: 800 }}>{get(`doc:${doc.id}:name`, doc.name)}</span>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink-xlight)", flexShrink: 0 }}>{open ? "접기 ▲" : "자세히 ▾"}</span>
      </div>

      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8, alignItems: "center" }}>
        {!open
          ? collapsedTags.map((t, i) => (
              <span key={i} style={{ ...tagStyle, color: "var(--ink-mid)", background: "var(--peach)", borderColor: "var(--bdr)" }}>
                {t}
              </span>
            ))
          : (
            <>
              {dynTags.map((t, i) => (
                <span key={`d${i}`} style={{ ...tagStyle, color: "var(--coral-d)", background: "var(--coral-pale)", borderColor: "var(--coral-l)", fontWeight: 700 }}>
                  {t}
                </span>
              ))}
              {visibleAttrs.map((a) => (
                <span key={a.key} style={{ ...tagStyle, color: a.missing ? "#b3261e" : "var(--ink-mid)", background: a.missing ? "#fdecea" : "var(--peach)", borderColor: a.missing ? "#f3c6c1" : "var(--bdr)" }}>
                  <b style={{ color: "var(--ink-light)", fontWeight: 700, marginRight: 4 }}>{a.label}</b>
                  {a.val}
                </span>
              ))}
              {extra
                .filter((e) => e.value.trim())
                .map((ex, i) => (
                  <span key={`x${i}`} style={{ ...tagStyle, color: "var(--ink-mid)", background: "var(--peach)", borderColor: "var(--bdr)" }}>
                    {ex.label.trim() && <b style={{ color: "var(--ink-light)", fontWeight: 700, marginRight: 4 }}>{ex.label}</b>}
                    {ex.value}
                  </span>
                ))}
            </>
          )}
      </div>

      <div style={{ fontSize: 13, color: "var(--ink-mid)", marginTop: 8, lineHeight: 1.6 }}>
        {get(`doc:${doc.id}:brief`, doc.brief)}
        {open && (get(`doc:${doc.id}:detailDesc`, doc.detailDesc ?? "") ? " " + get(`doc:${doc.id}:detailDesc`, doc.detailDesc ?? "") : "")}
      </div>

      {doc.cond && (
        <div style={{ fontSize: 12.5, color: "var(--ink-light)", marginTop: 6, paddingLeft: 10, borderLeft: "2px solid var(--bdr-d)", lineHeight: 1.55 }}>
          {get(`doc:${doc.id}:cond`, doc.cond)}
        </div>
      )}

      {open && doc.ambiguous && (
        <div style={{ marginTop: 8, fontSize: 11.5, color: "#8a6d1a", background: "#fff7e0", border: "1px solid #f0dca0", borderRadius: 8, padding: "6px 9px", lineHeight: 1.55 }}>
          확인 필요: {get(`doc:${doc.id}:ambiguous`, doc.ambiguous)}
        </div>
      )}
    </div>
  );
}
const tagStyle: React.CSSProperties = { display: "inline-flex", alignItems: "baseline", fontSize: 12, fontWeight: 600, border: "1px solid var(--bdr)", borderRadius: 999, padding: "2px 10px", whiteSpace: "normal", maxWidth: "100%" };

function Callout({ tone, children }: { tone: "amber" | "blue"; children: React.ReactNode }) {
  const map = { amber: { bg: "#fff9e6", bd: "#f5d98a", fg: "#8a6d1a" }, blue: { bg: "#eaf2fb", bd: "#cdd9ea", fg: "var(--navy)" } } as const;
  const t = map[tone];
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: t.bg, border: `1px solid ${t.bd}`, color: t.fg, borderRadius: 12, padding: "11px 14px", fontSize: 13, lineHeight: 1.6, marginTop: 12 }}>
      <span style={{ flexShrink: 0 }}>⚠</span>
      <span>{children}</span>
    </div>
  );
}

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
