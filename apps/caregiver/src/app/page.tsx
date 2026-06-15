import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  Briefcase,
  FileText,
  MapPin,
  PlaySquare,
  Stethoscope,
} from "lucide-react";

import { TrainingSignupTrigger } from "@/components/training-signup-modal";
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

  const steps = [t["home.steps.s1"], t["home.steps.s2"], t["home.steps.s3"]];

  const usps = [
    { icon: <MapPin />, title: t["usp.local.title"], desc: t["usp.local.desc"] },
    {
      icon: <BookOpenCheck />,
      title: t["usp.material.title"],
      desc: t["usp.material.desc"],
    },
    { icon: <Briefcase />, title: t["usp.job.title"], desc: t["usp.job.desc"] },
    {
      icon: <Stethoscope />,
      title: t["usp.visa.title"],
      desc: t["usp.visa.desc"],
    },
  ];

  const features = [
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
      href: "/resume",
      icon: <FileText />,
      title: t["feature.resume.title"],
      desc: t["feature.resume.desc"],
    },
  ];

  const trainingStrings = {
    title: t["modal.training.title"],
    subtitle: t["modal.training.subtitle"],
    name: t["modal.training.name"],
    namePh: t["modal.training.namePh"],
    phone: t["modal.training.phone"],
    phonePh: t["modal.training.phonePh"],
    email: t["modal.training.email"],
    emailPh: t["modal.training.emailPh"],
    region: t["modal.training.region"],
    regionPh: t["modal.training.regionPh"],
    topik: t["modal.training.topik"],
    topikPh: t["modal.training.topikPh"],
    visa: t["modal.training.visa"],
    visaPh: t["modal.training.visaPh"],
    message: t["modal.training.message"],
    messagePh: t["modal.training.messagePh"],
    submit: t["modal.training.submit"],
    success: t["modal.training.success"],
    needLogin: t["modal.training.needLogin"],
  };

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
          <h1
            className="page-title fade-up"
            style={{ whiteSpace: "pre-line" }}
          >
            <em>{t["home.hero.title"]}</em>
          </h1>
          <p
            className="page-desc fade-up"
            style={{ margin: "0.8rem auto 1.8rem" }}
          >
            {t["home.hero.sub"]}
          </p>
          <div
            style={{
              display: "flex",
              gap: "0.8rem",
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            <TrainingSignupTrigger
              label={t["home.hero.cta"]}
              strings={trainingStrings}
            />
            <Link
              href="/service"
              className="card"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "0.7rem 1.4rem",
                background: "var(--white)",
                color: "var(--coral)",
                fontWeight: 700,
              }}
            >
              {t["home.hero.cta2"]} <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* 진행 3스텝 */}
      <section className="page-wrap" style={{ textAlign: "center" }}>
        <h2 className="page-title" style={{ marginBottom: "1.6rem" }}>
          {t["home.steps.title"]}
        </h2>
        <div
          style={{
            display: "flex",
            gap: "0.6rem",
            justifyContent: "center",
            alignItems: "center",
            flexWrap: "wrap",
            marginBottom: "1.4rem",
          }}
        >
          {steps.map((s, i) => (
            <div
              key={s}
              style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}
            >
              <div
                className="card"
                style={{
                  padding: "0.8rem 1.6rem",
                  fontWeight: 800,
                  color: "var(--ink)",
                  fontFamily: "var(--font-noto-serif-kr), serif",
                }}
              >
                {s}
              </div>
              {i < steps.length - 1 && (
                <ArrowRight size={18} style={{ color: "var(--coral)" }} />
              )}
            </div>
          ))}
        </div>
        <Link
          href="/service"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontWeight: 700,
            color: "var(--coral)",
          }}
        >
          {t["home.steps.more"]} <ArrowRight size={16} />
        </Link>
      </section>

      {/* KPI STRIP */}
      <section style={{ background: "var(--ink)", padding: "2.5rem 20px" }}>
        <div className="page-wrap" style={{ padding: 0 }}>
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

      {/* 기능 카드 — 이런 걸로 공부해요 */}
      <section
        className="page-wrap"
        style={{ background: "var(--peach)", maxWidth: "none", margin: 0 }}
      >
        <div className="page-wrap" style={{ padding: 0 }}>
          <h2
            className="page-title"
            style={{ textAlign: "center", marginBottom: "2rem" }}
          >
            {t["home.features.title"]}
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

      {/* USP — 왜 글로케어일까요? */}
      <section className="page-wrap">
        <h2
          className="page-title"
          style={{ textAlign: "center", marginBottom: "2rem" }}
        >
          {t["home.usp.title"]}
        </h2>
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

      {/* 후기 티저 */}
      <section
        className="page-wrap"
        style={{ textAlign: "center", paddingTop: 0 }}
      >
        <h2 className="page-title" style={{ marginBottom: "1rem" }}>
          {t["home.reviews.title"]}
        </h2>
        <Link
          href="/reviews"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontWeight: 700,
            color: "var(--coral)",
          }}
        >
          {t["home.reviews.cta"]} <ArrowRight size={16} />
        </Link>
      </section>

      {/* 고객센터 */}
      <section
        style={{
          background: "var(--coral-l)",
          padding: "2.5rem 20px",
          textAlign: "center",
          color: "var(--white)",
        }}
      >
        <p style={{ fontWeight: 800, fontSize: "1.1rem", marginBottom: "0.4rem" }}>
          {t["brand.tagline"]}
        </p>
        <p style={{ opacity: 0.85, fontSize: "0.9rem", lineHeight: 1.7 }}>
          {t["footer.contact"]}
        </p>
      </section>
    </>
  );
}
