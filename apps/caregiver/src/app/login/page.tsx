import { SnsLoginButtons } from "@/components/sns-login-buttons";
import { PhoneLogin } from "@/components/phone-login";
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

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.8rem",
          margin: "1.4rem 0",
          color: "var(--ink-light)",
          fontSize: "0.8rem",
        }}
      >
        <span style={{ flex: 1, height: 1, background: "var(--coral-soft)" }} />
        {t["login.or"]}
        <span style={{ flex: 1, height: 1, background: "var(--coral-soft)" }} />
      </div>

      <PhoneLogin
        next={next}
        labels={{
          label: t["login.phone.label"],
          ph: t["login.phone.ph"],
          send: t["login.phone.send"],
          sending: t["login.phone.sending"],
          codeLabel: t["login.phone.code_label"],
          codePh: t["login.phone.code_ph"],
          verify: t["login.phone.verify"],
          verifying: t["login.phone.verifying"],
          sent: t["login.phone.sent"],
          resend: t["login.phone.resend"],
          error: t["login.phone.error"],
        }}
      />
    </div>
  );
}
