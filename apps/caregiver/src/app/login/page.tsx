import { SnsLoginButtons } from "@/components/sns-login-buttons";
import { getDict } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const t = await getDict();
  const next = sp.next ?? "/";

  return (
    <div className="page-wrap fade-up" style={{ maxWidth: 420 }}>
      <div className="eyebrow">{t["nav.login"]}</div>
      <h1 className="page-title">{t["login.title"]}</h1>
      <p className="page-desc">{t["login.desc"]}</p>

      {sp.error && (
        <div
          style={{
            padding: "0.8rem 1rem",
            background: "rgba(242,92,92,0.08)",
            border: "1px solid var(--coral-soft)",
            borderRadius: 8,
            color: "var(--coral-d)",
            fontSize: "0.85rem",
            marginBottom: "1.2rem",
          }}
        >
          {decodeURIComponent(sp.error)}
        </div>
      )}

      <SnsLoginButtons
        next={next}
        labels={{
          google: t["login.google"],
          facebook: t["login.facebook"],
        }}
      />
    </div>
  );
}
