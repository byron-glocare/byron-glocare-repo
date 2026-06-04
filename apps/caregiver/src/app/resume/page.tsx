import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { getAuthState, hasFeatureAccess } from "@/lib/auth";
import { getDict } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function ResumeLandingPage() {
  const t = await getDict();
  const auth = await getAuthState();

  if (auth.kind === "unmapped") {
    return (
      <div className="page-wrap" style={{ textAlign: "center", maxWidth: 480 }}>
        <h1 className="page-title">계정 연동 필요</h1>
        <p className="page-desc">먼저 본인 확인을 완료해주세요.</p>
        <Link href="/verify" className="btn-coral">
          본인 확인하기
        </Link>
      </div>
    );
  }
  if (auth.kind !== "mapped") return null;

  if (!hasFeatureAccess(auth.customer.product_type, "resume")) {
    return (
      <div
        className="page-wrap"
        style={{ textAlign: "center", maxWidth: 480 }}
      >
        <div
          className="eyebrow"
          style={{
            background: "#FFF8E1",
            color: "#7E5C00",
            borderColor: "#FFE082",
          }}
        >
          🔒 {t["resume.locked.title"]}
        </div>
        <h1 className="page-title">{t["resume.title"]}</h1>
        <p className="page-desc">{t["resume.locked.desc"]}</p>
        <Link href="/about#training" className="btn-coral">
          {t["resume.locked.cta"]}
        </Link>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: resumes } = await supabase
    .from("resumes")
    .select("id, name_ko, name_vi, status, generated_at, created_at")
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false });

  const statusLabel = (s: string) => {
    if (s === "ready") return t["resume.list.status.ready"];
    if (s === "generating") return t["resume.list.status.generating"];
    if (s === "failed") return t["resume.list.status.failed"];
    return t["resume.list.status.draft"];
  };
  const statusColor = (s: string) => {
    if (s === "ready") return "var(--green)";
    if (s === "failed") return "var(--coral)";
    if (s === "generating") return "var(--yellow)";
    return "var(--ink-light)";
  };

  return (
    <div className="page-wrap fade-up" style={{ maxWidth: 720 }}>
      <div className="eyebrow">{t["resume.eyebrow"]}</div>
      <h1 className="page-title">
        <em>{t["resume.title"]}</em>
      </h1>
      <p className="page-desc">{t["resume.intro"]}</p>

      <div style={{ marginTop: "1.5rem", marginBottom: "2rem" }}>
        <Link href="/resume/new" className="btn-coral">
          {t["resume.list.new"]}
        </Link>
      </div>

      <h2
        style={{
          fontFamily: "var(--font-noto-serif-kr), serif",
          fontSize: "1.1rem",
          fontWeight: 800,
          marginBottom: "1rem",
        }}
      >
        {t["resume.list.title"]}
      </h2>

      {!resumes || resumes.length === 0 ? (
        <div
          className="card"
          style={{
            textAlign: "center",
            padding: "2.5rem",
            color: "var(--ink-light)",
            fontSize: "0.9rem",
          }}
        >
          {t["resume.list.empty"]}
        </div>
      ) : (
        <div style={{ display: "grid", gap: "0.7rem" }}>
          {resumes.map((r) => (
            <Link
              key={r.id}
              href={`/resume/${r.id}`}
              className="card"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "1rem 1.2rem",
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>
                  {r.name_vi} / {r.name_ko}
                </div>
                <div
                  style={{
                    fontSize: "0.78rem",
                    color: "var(--ink-light)",
                    marginTop: 2,
                  }}
                >
                  {new Date(r.created_at).toLocaleString("ko-KR")}
                </div>
              </div>
              <div
                style={{
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  padding: "4px 12px",
                  borderRadius: 12,
                  background: `${statusColor(r.status)}1a`,
                  color: statusColor(r.status),
                  border: `1px solid ${statusColor(r.status)}40`,
                }}
              >
                {statusLabel(r.status)}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
