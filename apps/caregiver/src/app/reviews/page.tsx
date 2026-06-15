import { getDict } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function ReviewsPage() {
  const t = await getDict();

  return (
    <div className="page-wrap fade-up" style={{ maxWidth: 760 }}>
      <div className="eyebrow">{t["reviews.eyebrow"]}</div>
      <h1 className="page-title">{t["reviews.title"]}</h1>
      <p className="page-desc">{t["reviews.intro"]}</p>

      <div
        className="card"
        style={{
          marginTop: "2rem",
          textAlign: "center",
          color: "var(--ink-light)",
          padding: "3rem 1.5rem",
        }}
      >
        {t["reviews.empty"]}
      </div>
    </div>
  );
}
