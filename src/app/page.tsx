import Link from "next/link";
import {
  BookOpenCheck,
  Briefcase,
  FileText,
  Hospital,
  Info,
  MapPin,
  PlaySquare,
  Sparkles,
  Stethoscope,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getDict } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const t = await getDict();
  const supabase = await createClient();

  // KPI 5종 — count(active) 만 집계
  const today = new Date().toISOString().slice(0, 10);
  const [
    { count: studentsCount },
    { count: workingCount },
    { count: trainingCentersCount },
    { count: careHomesCount },
    { count: universitiesCount },
  ] = await Promise.all([
    supabase.from("customers").select("id", { count: "exact", head: true }),
    // 일하는 사람: work_start_date 가 있고, work_end_date 가 없거나 미래
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .not("work_start_date", "is", null)
      .or(`work_end_date.is.null,work_end_date.gt.${today}`),
    supabase
      .from("training_centers")
      .select("id", { count: "exact", head: true })
      .eq("contract_active", true),
    supabase.from("care_homes").select("id", { count: "exact", head: true }),
    supabase
      .from("universities")
      .select("id", { count: "exact", head: true })
      .eq("active", true),
  ]);

  const kpis = [
    { label: t["kpi.students"], value: studentsCount ?? 0 },
    { label: t["kpi.working"], value: workingCount ?? 0 },
    { label: t["kpi.training_centers"], value: trainingCentersCount ?? 0 },
    { label: t["kpi.care_homes"], value: careHomesCount ?? 0 },
    { label: t["kpi.universities"], value: universitiesCount ?? 0 },
  ];

  const usps = [
    {
      icon: <MapPin />,
      title: t["usp.local.title"],
      desc: t["usp.local.desc"],
    },
    {
      icon: <BookOpenCheck />,
      title: t["usp.material.title"],
      desc: t["usp.material.desc"],
    },
    {
      icon: <Briefcase />,
      title: t["usp.job.title"],
      desc: t["usp.job.desc"],
    },
    {
      icon: <Stethoscope />,
      title: t["usp.visa.title"],
      desc: t["usp.visa.desc"],
    },
  ];

  const features = [
    {
      href: "/about",
      icon: <Info />,
      title: t["feature.about.title"],
      desc: t["feature.about.desc"],
    },
    {
      href: "/videos",
      icon: <PlaySquare />,
      title: t["feature.videos.title"],
      desc: t["feature.videos.desc"],
    },
    {
      href: "/cbt",
      icon: <BookOpenCheck />,
      title: t["feature.cbt.title"],
      desc: t["feature.cbt.desc"],
    },
    {
      href: "/partners",
      icon: <Hospital />,
      title: t["feature.partners.title"],
      desc: t["feature.partners.desc"],
    },
    {
      href: "/ambassador",
      icon: <Sparkles />,
      title: t["feature.ambassador.title"],
      desc: t["feature.ambassador.desc"],
    },
    {
      href: "/resume",
      icon: <FileText />,
      title: t["feature.resume.title"],
      desc: t["feature.resume.desc"],
    },
  ];

  return (
    <>
      {/* HERO */}
      <section
        style={{
          background:
            "linear-gradient(135deg, var(--peach) 0%, var(--coral-pale) 100%)",
          padding: "5rem 20px 4rem",
          textAlign: "center",
        }}
      >
        <div className="page-wrap" style={{ padding: 0, maxWidth: 760 }}>
          <div className="eyebrow">GLOCARE</div>
          <h1 className="page-title fade-up">
            <em>{t["home.heading"]}</em>
          </h1>
          <p className="page-desc fade-up" style={{ margin: "0.8rem auto 1.8rem" }}>
            {t["home.tagline"]}
          </p>
          <div
            style={{
              display: "flex",
              gap: "0.8rem",
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            <Link href="/about#training" className="btn-coral">
              {t["home.cta.training"]}
            </Link>
            <Link href="/about#partner" className="btn-ghost">
              {t["home.cta.partner"]}
            </Link>
          </div>
        </div>
      </section>

      {/* KPI STRIP */}
      <section
        style={{
          background: "var(--ink)",
          padding: "2.5rem 20px",
        }}
      >
        <div
          className="page-wrap"
          style={{ padding: 0 }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: "1.5rem",
              textAlign: "center",
            }}
          >
            {kpis.map((k) => (
              <div key={k.label}>
                <div
                  style={{
                    fontFamily: "var(--font-noto-serif-kr), serif",
                    fontSize: "2.2rem",
                    fontWeight: 900,
                    color: "var(--white)",
                    lineHeight: 1,
                    marginBottom: "0.4rem",
                  }}
                >
                  {k.value.toLocaleString()}
                  <span style={{ color: "var(--coral)", marginLeft: 4 }}>+</span>
                </div>
                <div
                  style={{
                    fontSize: "0.78rem",
                    color: "rgba(255,255,255,0.55)",
                    lineHeight: 1.4,
                  }}
                >
                  {k.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* USP — 4 강점 */}
      <section className="page-wrap">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "1.2rem",
          }}
        >
          {usps.map((u) => (
            <div key={u.title} className="card">
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: "var(--coral-pale)",
                  color: "var(--coral)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "0.9rem",
                }}
              >
                {u.icon}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-noto-serif-kr), serif",
                  fontSize: "1.05rem",
                  fontWeight: 800,
                  color: "var(--ink)",
                  marginBottom: "0.4rem",
                }}
              >
                {u.title}
              </div>
              <div
                style={{
                  fontSize: "0.85rem",
                  color: "var(--ink-light)",
                  lineHeight: 1.6,
                }}
              >
                {u.desc}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 기능 카드 */}
      <section
        className="page-wrap"
        style={{ background: "var(--peach)", maxWidth: "none", margin: 0 }}
      >
        <div className="page-wrap" style={{ padding: 0 }}>
          <h2
            className="page-title"
            style={{ textAlign: "center", marginBottom: "2rem" }}
          >
            서비스 둘러보기
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "1.2rem",
            }}
          >
            {features.map((f) => (
              <Link
                key={f.href}
                href={f.href}
                className="card"
                style={{ display: "block", color: "inherit" }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: "var(--coral)",
                    color: "var(--white)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "0.9rem",
                  }}
                >
                  {f.icon}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-noto-serif-kr), serif",
                    fontSize: "1rem",
                    fontWeight: 700,
                    marginBottom: "0.3rem",
                  }}
                >
                  {f.title}
                </div>
                <div
                  style={{
                    fontSize: "0.82rem",
                    color: "var(--ink-light)",
                    lineHeight: 1.6,
                  }}
                >
                  {f.desc}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 고객센터 안내 */}
      <section
        style={{
          background: "var(--coral-l)",
          padding: "2.5rem 20px",
          textAlign: "center",
          color: "var(--white)",
        }}
      >
        <p
          style={{
            fontWeight: 800,
            fontSize: "1.1rem",
            marginBottom: "0.4rem",
          }}
        >
          글로케어는 여러분의 요양보호사 자격증 취득부터 취업, 비자 연장까지 함께
          합니다.
        </p>
        <p style={{ opacity: 0.85, fontSize: "0.9rem", lineHeight: 1.7 }}>
          요양보호사 자격증 취득 상담 · 요양보호사 교육원/요양원 제휴 상담
          <br />
          고객센터: <strong>02-456-0724</strong> (오전 9시 ~ 오후 6시)
        </p>
      </section>
    </>
  );
}
