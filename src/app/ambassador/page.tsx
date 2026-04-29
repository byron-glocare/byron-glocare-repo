import { createClient } from "@/lib/supabase/server";
import { getDict, getLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function AmbassadorPage() {
  const t = await getDict();
  const locale = await getLocale();
  const supabase = await createClient();

  const { data: config } = await supabase
    .from("ambassador_config")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  const benefits =
    locale === "vi" ? config?.benefits_vi : config?.benefits_ko;

  return (
    <div className="page-wrap fade-up" style={{ maxWidth: 720 }}>
      <div className="eyebrow">{t["ambassador.eyebrow"]}</div>
      <h1 className="page-title">
        <em>{t["ambassador.title"]}</em>
      </h1>
      <p className="page-desc">{t["ambassador.intro"]}</p>

      {/* 입장 코드 + QR */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: "1.2rem",
          marginTop: "2rem",
        }}
      >
        <div
          className="card"
          style={{
            background:
              "linear-gradient(135deg, var(--coral) 0%, var(--coral-l) 100%)",
            color: "var(--white)",
            textAlign: "center",
            padding: "2rem",
            border: "none",
          }}
        >
          <div
            style={{
              fontSize: "0.78rem",
              fontWeight: 700,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              opacity: 0.85,
              marginBottom: "0.6rem",
            }}
          >
            {t["ambassador.code.label"]}
          </div>
          <div
            style={{
              fontFamily: "monospace",
              fontSize: "2.4rem",
              fontWeight: 900,
              letterSpacing: "0.3em",
              userSelect: "all",
            }}
          >
            {config?.entry_code ?? (
              <span style={{ fontSize: "1rem", letterSpacing: 0 }}>
                {t["ambassador.code.empty"]}
              </span>
            )}
          </div>
        </div>

        <div
          className="card"
          style={{
            textAlign: "center",
            padding: "2rem",
          }}
        >
          <div
            style={{
              fontSize: "0.82rem",
              fontWeight: 700,
              color: "var(--ink-mid)",
              marginBottom: "1rem",
            }}
          >
            {t["ambassador.qr.label"]}
          </div>
          {config?.kakao_qr_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={config.kakao_qr_url}
              alt="KakaoTalk QR"
              style={{
                width: 240,
                height: 240,
                borderRadius: 12,
                margin: "0 auto",
                border: "1px solid var(--border)",
              }}
            />
          ) : (
            <div
              style={{
                width: 240,
                height: 240,
                borderRadius: 12,
                background: "var(--peach)",
                margin: "0 auto",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.85rem",
                color: "var(--ink-xlight)",
                border: "1px dashed var(--coral-soft)",
              }}
            >
              {t["ambassador.qr.empty"]}
            </div>
          )}
        </div>
      </div>

      {/* 혜택 */}
      {benefits && (
        <div style={{ marginTop: "2.5rem" }}>
          <h2
            style={{
              fontFamily: "var(--font-noto-serif-kr), serif",
              fontSize: "1.2rem",
              fontWeight: 800,
              marginBottom: "1rem",
            }}
          >
            {t["ambassador.benefits.title"]}
          </h2>
          <div
            className="card"
            style={{
              fontSize: "0.92rem",
              color: "var(--ink-mid)",
              lineHeight: 1.8,
              whiteSpace: "pre-line",
            }}
          >
            {benefits}
          </div>
        </div>
      )}
    </div>
  );
}
