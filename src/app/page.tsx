import { getDict } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const t = await getDict();

  return (
    <div className="page-wrap fade-up">
      <div className="eyebrow">GLOCARE</div>
      <h1 className="page-title">
        <em>{t["home.heading"]}</em>
      </h1>
      <p className="page-desc">{t["brand.tagline"]}</p>

      <div style={{ display: "flex", gap: "0.8rem", flexWrap: "wrap" }}>
        <button type="button" className="btn-coral">
          {t["home.cta.training"]}
        </button>
        <button type="button" className="btn-ghost">
          {t["home.cta.partner"]}
        </button>
      </div>

      <div
        style={{
          marginTop: "3rem",
          padding: "2rem",
          background: "var(--peach)",
          border: "1.5px solid var(--coral-soft)",
          borderRadius: "14px",
        }}
      >
        <p style={{ color: "var(--ink-light)", lineHeight: 1.7 }}>
          🏗️ <strong>{`준비 중 / Đang xây dựng`}</strong>
          <br />
          이 페이지는 곧 메인 카피·KPI 카드로 채워집니다. / Trang này sẽ sớm
          được hoàn thiện.
        </p>
      </div>
    </div>
  );
}
