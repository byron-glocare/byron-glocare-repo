import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getAuthState } from "@/lib/auth";
import { getDict } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function ResumeViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) notFound();

  const auth = await getAuthState();
  if (auth.kind === "guest") redirect(`/login?next=/resume/${id}`);

  const supabase = await createClient();
  const t = await getDict();

  const { data: resume } = await supabase
    .from("resumes")
    .select("*")
    .eq("id", numericId)
    .maybeSingle();

  if (!resume) notFound();

  if (auth.kind !== "mapped" || resume.user_id !== auth.userId) {
    redirect("/resume");
  }

  return (
    <div className="page-wrap fade-up" style={{ maxWidth: 720 }}>
      <Link
        href="/resume"
        style={{
          display: "inline-block",
          fontSize: "0.85rem",
          color: "var(--ink-light)",
          marginBottom: "1.2rem",
        }}
      >
        ← {t["resume.list.title"]}
      </Link>

      <div className="eyebrow">{t["resume.eyebrow"]}</div>
      <h1 className="page-title">
        {resume.name_vi} / {resume.name_ko}
      </h1>
      <p
        className="page-desc"
        style={{ fontSize: "0.85rem", color: "var(--ink-xlight)" }}
      >
        {resume.created_at &&
          new Date(resume.created_at).toLocaleString("ko-KR")}
      </p>

      {resume.status === "ready" && resume.pdf_url && (
        <>
          <div
            style={{
              marginTop: "1.5rem",
              marginBottom: "1.5rem",
              display: "flex",
              gap: "0.6rem",
            }}
          >
            <a
              href={resume.pdf_url}
              target="_blank"
              rel="noreferrer"
              className="btn-coral"
            >
              ⬇ {t["resume.view.download"]}
            </a>
          </div>

          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: 12,
              overflow: "hidden",
              background: "var(--peach)",
              height: 720,
            }}
          >
            <iframe
              src={resume.pdf_url}
              style={{ width: "100%", height: "100%", border: 0 }}
              title="Resume PDF"
            />
          </div>
        </>
      )}

      {resume.status === "generating" && (
        <div
          className="card"
          style={{
            textAlign: "center",
            padding: "3rem",
            marginTop: "1.5rem",
          }}
        >
          <div style={{ fontSize: "2rem", marginBottom: "0.7rem" }}>⏳</div>
          <p style={{ color: "var(--ink-light)" }}>
            {t["resume.view.generating"]}
          </p>
        </div>
      )}

      {resume.status === "failed" && (
        <div
          className="card"
          style={{
            textAlign: "center",
            padding: "3rem",
            marginTop: "1.5rem",
            border: "1.5px solid var(--coral)",
            background: "var(--coral-pale)",
          }}
        >
          <div style={{ fontSize: "2rem", marginBottom: "0.7rem" }}>⚠️</div>
          <p style={{ color: "var(--coral-d)", marginBottom: "1rem" }}>
            {t["resume.view.failed"]}
          </p>
          <Link href="/resume/new" className="btn-coral">
            {t["resume.list.new"]}
          </Link>
        </div>
      )}
    </div>
  );
}
