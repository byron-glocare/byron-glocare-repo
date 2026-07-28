"use client";

import { useMemo, useState } from "react";
import {
  Search,
  X,
  Clock,
  RefreshCw,
  Ban,
  Briefcase,
  FileText,
  ListChecks,
  CheckCircle2,
  Info,
  Globe,
  AlertTriangle,
} from "lucide-react";
import { VISAS, IS_SAMPLE_DATA } from "@/data/visas";
import { CATEGORY_ORDER, type VisaCategory, type VisaType } from "@/data/types";

const CATEGORY_COLOR: Record<VisaCategory, string> = {
  "유학·연수": "var(--blue)",
  취업: "var(--green)",
  "거주·동포": "var(--navy)",
  결혼이민: "var(--coral)",
  "방문·단기": "var(--yellow)",
  "구직·기타": "var(--ink-light)",
};

export default function Page() {
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<VisaCategory | "전체">("전체");
  const [selected, setSelected] = useState<VisaType | null>(null);

  const categories = useMemo(() => {
    const present = new Set(VISAS.map((v) => v.category));
    return CATEGORY_ORDER.filter((c) => present.has(c));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return VISAS.filter((v) => {
      if (activeCat !== "전체" && v.category !== activeCat) return false;
      if (!q) return true;
      const hay = [
        v.code,
        v.nameKo,
        v.nameEn ?? "",
        v.summary,
        v.purpose,
        v.category,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [query, activeCat]);

  return (
    <main style={{ minHeight: "100vh" }}>
      {/* ── Header ─────────────────────────────────────────── */}
      <header
        style={{
          background:
            "linear-gradient(135deg, var(--coral) 0%, var(--coral-d) 100%)",
          color: "#fff",
          padding: "48px 20px 40px",
        }}
      >
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(255,255,255,.18)",
              padding: "6px 14px",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 16,
            }}
          >
            <Globe size={15} /> 대한민국 체류자격(비자) 안내
          </div>
          <h1 style={{ fontSize: 34, fontWeight: 800, margin: "0 0 8px", letterSpacing: -0.5 }}>
            한국 비자 발급 요건 조회
          </h1>
          <p style={{ margin: 0, fontSize: 16, opacity: 0.92, maxWidth: 640 }}>
            체류자격별 자격요건 · 제출서류 · 신청절차를 한눈에. 비자 기호나
            키워드로 검색하세요.
          </p>

          {/* Search */}
          <div
            style={{
              marginTop: 24,
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "#fff",
              borderRadius: 14,
              padding: "12px 16px",
              maxWidth: 560,
              boxShadow: "var(--shadow-md)",
            }}
          >
            <Search size={20} color="var(--ink-light)" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="예: D-2, 유학, 취업, 결혼…"
              style={{
                border: "none",
                outline: "none",
                fontSize: 16,
                flex: 1,
                color: "var(--ink)",
                background: "transparent",
              }}
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                aria-label="지우기"
                style={{ border: "none", background: "none", cursor: "pointer", color: "var(--ink-light)", display: "flex" }}
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "0 20px 64px" }}>
        {IS_SAMPLE_DATA && (
          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
              background: "#fff9e6",
              border: "1px solid #f5d98a",
              color: "#8a6d1a",
              borderRadius: 12,
              padding: "12px 16px",
              margin: "20px 0 4px",
              fontSize: 14,
            }}
          >
            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              현재 화면은 <b>예시(샘플) 데이터</b>입니다. 실제 발급 요건과 다를 수
              있으며, 자료 파일을 반영하면 정본으로 교체됩니다.
            </span>
          </div>
        )}

        {/* Category chips */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "24px 0 20px" }}>
          <Chip active={activeCat === "전체"} onClick={() => setActiveCat("전체")}>
            전체 <span style={{ opacity: 0.6 }}>{VISAS.length}</span>
          </Chip>
          {categories.map((c) => {
            const count = VISAS.filter((v) => v.category === c).length;
            return (
              <Chip key={c} active={activeCat === c} color={CATEGORY_COLOR[c]} onClick={() => setActiveCat(c)}>
                {c} <span style={{ opacity: 0.6 }}>{count}</span>
              </Chip>
            );
          })}
        </div>

        <div style={{ fontSize: 13, color: "var(--ink-light)", marginBottom: 14 }}>
          {filtered.length}개 결과
        </div>

        {/* Cards */}
        {filtered.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "64px 20px",
              color: "var(--ink-light)",
              background: "#fff",
              borderRadius: 16,
              border: "1px dashed var(--bdr-d)",
            }}
          >
            검색 결과가 없습니다. 다른 키워드를 시도해 보세요.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: 16,
            }}
          >
            {filtered.map((v) => (
              <VisaCard key={v.code} visa={v} onClick={() => setSelected(v)} />
            ))}
          </div>
        )}
      </div>

      {selected && <DetailModal visa={selected} onClose={() => setSelected(null)} />}
    </main>
  );
}

/* ── Chip ─────────────────────────────────────────────── */
function Chip({
  children,
  active,
  color = "var(--coral)",
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        border: `1.5px solid ${active ? color : "var(--bdr-d)"}`,
        background: active ? color : "#fff",
        color: active ? "#fff" : "var(--ink-mid)",
        padding: "8px 14px",
        borderRadius: 999,
        fontSize: 14,
        fontWeight: 600,
        cursor: "pointer",
        transition: "all .15s",
      }}
    >
      {children}
    </button>
  );
}

/* ── Card ─────────────────────────────────────────────── */
function VisaCard({ visa, onClick }: { visa: VisaType; onClick: () => void }) {
  const color = CATEGORY_COLOR[visa.category];
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: "left",
        background: "#fff",
        border: "1px solid var(--bdr)",
        borderRadius: 16,
        padding: 20,
        cursor: "pointer",
        boxShadow: "var(--shadow-sm)",
        transition: "transform .15s, box-shadow .15s",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-3px)";
        e.currentTarget.style.boxShadow = "var(--shadow-md)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "none";
        e.currentTarget.style.boxShadow = "var(--shadow-sm)";
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span
          style={{
            fontSize: 20,
            fontWeight: 800,
            color: "var(--coral-d)",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          }}
        >
          {visa.code}
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "#fff",
            background: color,
            padding: "3px 10px",
            borderRadius: 999,
          }}
        >
          {visa.category}
        </span>
      </div>
      <div>
        <div style={{ fontSize: 17, fontWeight: 700 }}>
          {visa.nameKo}
          {visa.nameEn && (
            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-xlight)", marginLeft: 6 }}>
              {visa.nameEn}
            </span>
          )}
        </div>
        <p style={{ margin: "6px 0 0", fontSize: 14, color: "var(--ink-light)", lineHeight: 1.5 }}>
          {visa.summary}
        </p>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: "auto" }}>
        <MiniTag icon={<Clock size={13} />}>{visa.duration}</MiniTag>
        {visa.extendable ? (
          <MiniTag icon={<RefreshCw size={13} />} tone="green">연장 가능</MiniTag>
        ) : (
          <MiniTag icon={<Ban size={13} />} tone="gray">연장 불가</MiniTag>
        )}
      </div>
    </button>
  );
}

function MiniTag({
  children,
  icon,
  tone = "gray",
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "gray" | "green";
}) {
  const map = {
    gray: { bg: "var(--peach)", fg: "var(--ink-mid)" },
    green: { bg: "#e6f5ee", fg: "var(--green)" },
  } as const;
  const c = map[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        background: c.bg,
        color: c.fg,
        fontSize: 12.5,
        fontWeight: 600,
        padding: "4px 10px",
        borderRadius: 8,
      }}
    >
      {icon}
      {children}
    </span>
  );
}

/* ── Detail modal ─────────────────────────────────────── */
function DetailModal({ visa, onClose }: { visa: VisaType; onClose: () => void }) {
  const color = CATEGORY_COLOR[visa.category];
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(28,28,30,.5)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "40px 16px",
        overflowY: "auto",
        zIndex: 50,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 20,
          maxWidth: 720,
          width: "100%",
          boxShadow: "var(--shadow-lg)",
          overflow: "hidden",
        }}
      >
        {/* head */}
        <div
          style={{
            background: `linear-gradient(135deg, ${color} 0%, var(--ink) 220%)`,
            color: "#fff",
            padding: "24px 28px",
            position: "relative",
          }}
        >
          <button
            onClick={onClose}
            aria-label="닫기"
            style={{
              position: "absolute",
              top: 18,
              right: 18,
              background: "rgba(255,255,255,.2)",
              border: "none",
              borderRadius: 999,
              width: 34,
              height: 34,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#fff",
            }}
          >
            <X size={18} />
          </button>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 28, fontWeight: 800, fontFamily: "ui-monospace, monospace" }}>
              {visa.code}
            </span>
            <span style={{ fontSize: 20, fontWeight: 700 }}>{visa.nameKo}</span>
            {visa.nameEn && <span style={{ opacity: 0.85 }}>{visa.nameEn}</span>}
          </div>
          <p style={{ margin: "10px 0 0", opacity: 0.92 }}>{visa.summary}</p>
        </div>

        {/* body */}
        <div style={{ padding: "24px 28px 32px", display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <MiniTag icon={<Clock size={13} />}>체류기간 {visa.duration}</MiniTag>
            {visa.extendable ? (
              <MiniTag icon={<RefreshCw size={13} />} tone="green">연장 가능</MiniTag>
            ) : (
              <MiniTag icon={<Ban size={13} />} tone="gray">연장 불가</MiniTag>
            )}
            {visa.workAllowed && <MiniTag icon={<Briefcase size={13} />}>취업활동 안내 포함</MiniTag>}
          </div>

          <Section icon={<Info size={17} />} title="체류 목적">
            <p style={{ margin: 0, color: "var(--ink-mid)" }}>{visa.purpose}</p>
          </Section>

          <Section icon={<CheckCircle2 size={17} />} title="자격 요건">
            <BulletList items={visa.eligibility} />
          </Section>

          <Section icon={<FileText size={17} />} title="제출 서류">
            <BulletList items={visa.requiredDocuments} />
          </Section>

          <Section icon={<ListChecks size={17} />} title="신청 절차">
            <ol style={{ margin: 0, paddingLeft: 20, color: "var(--ink-mid)", display: "flex", flexDirection: "column", gap: 6 }}>
              {visa.procedure.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ol>
          </Section>

          {visa.workAllowed && (
            <Section icon={<Briefcase size={17} />} title="취업활동">
              <p style={{ margin: 0, color: "var(--ink-mid)" }}>{visa.workAllowed}</p>
            </Section>
          )}

          {visa.fee && (
            <Section icon={<Info size={17} />} title="수수료">
              <p style={{ margin: 0, color: "var(--ink-mid)" }}>{visa.fee}</p>
            </Section>
          )}

          {visa.nationalityNotes && visa.nationalityNotes.length > 0 && (
            <Section icon={<Globe size={17} />} title="국적별 특이사항">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {visa.nationalityNotes.map((n, i) => (
                  <div key={i} style={{ display: "flex", gap: 8 }}>
                    <span
                      style={{
                        flexShrink: 0,
                        background: "var(--coral-pale)",
                        color: "var(--coral-d)",
                        fontWeight: 700,
                        fontSize: 12.5,
                        padding: "2px 10px",
                        borderRadius: 999,
                        height: "fit-content",
                      }}
                    >
                      {n.nationality}
                    </span>
                    <span style={{ color: "var(--ink-mid)" }}>{n.note}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {visa.notes && visa.notes.length > 0 && (
            <Section icon={<AlertTriangle size={17} />} title="유의사항">
              <BulletList items={visa.notes} />
            </Section>
          )}

          {(visa.source || visa.updatedAt) && (
            <div style={{ fontSize: 12.5, color: "var(--ink-xlight)", borderTop: "1px solid var(--bdr)", paddingTop: 14 }}>
              {visa.source && <div>출처: {visa.source}</div>}
              {visa.updatedAt && <div>기준: {visa.updatedAt}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 15,
          fontWeight: 700,
          margin: "0 0 10px",
          color: "var(--coral-d)",
        }}
      >
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 7 }}>
      {items.map((it, i) => (
        <li key={i} style={{ display: "flex", gap: 8, color: "var(--ink-mid)" }}>
          <span style={{ color: "var(--coral)", flexShrink: 0, marginTop: 1 }}>•</span>
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}
