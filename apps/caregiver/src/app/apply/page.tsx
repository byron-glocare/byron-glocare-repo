import { redirect } from "next/navigation";

import { submitApplication } from "@/app/actions/application";
import { getAuthState } from "@/lib/auth";
import { getDict } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function ApplyPage() {
  const auth = await getAuthState();
  if (auth.kind === "guest") redirect("/login?next=/apply");
  const t = await getDict();
  const c = auth.kind === "mapped" ? auth.customer : null;

  const fieldStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.7rem 0.9rem",
    borderRadius: 10,
    border: "1px solid var(--coral-soft)",
    fontSize: "0.95rem",
    marginTop: "0.3rem",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: "0.85rem",
    fontWeight: 700,
    color: "var(--ink)",
  };

  return (
    <div className="page-wrap fade-up" style={{ maxWidth: 560 }}>
      <div className="eyebrow">{t["modal.training.title"]}</div>
      <h1 className="page-title">{t["modal.training.title"]}</h1>
      <p className="page-desc">{t["modal.training.subtitle"]}</p>

      <form
        action={submitApplication}
        style={{ display: "grid", gap: "1rem", marginTop: "1.5rem" }}
      >
        <label style={labelStyle}>
          {t["modal.training.name"]}
          <input
            name="name_vi"
            defaultValue={c?.name_vi ?? c?.name_kr ?? ""}
            placeholder={t["modal.training.namePh"]}
            style={fieldStyle}
            required
          />
        </label>

        <label style={labelStyle}>
          {t["modal.training.phone"]}
          <input
            name="phone"
            defaultValue={c?.phone ?? ""}
            placeholder={t["modal.training.phonePh"]}
            style={fieldStyle}
            required
          />
        </label>

        <label style={labelStyle}>
          {t["modal.training.region"]}
          <input
            name="desired_region"
            placeholder={t["modal.training.regionPh"]}
            style={fieldStyle}
          />
        </label>

        <label style={labelStyle}>
          {t["modal.training.topik"]}
          <input
            name="topik_level"
            placeholder={t["modal.training.topikPh"]}
            style={fieldStyle}
          />
        </label>

        <label style={labelStyle}>
          {t["modal.training.visa"]}
          <input
            name="visa_type"
            placeholder={t["modal.training.visaPh"]}
            style={fieldStyle}
          />
        </label>

        <button
          type="submit"
          style={{
            background: "var(--coral)",
            color: "var(--white)",
            fontWeight: 700,
            padding: "0.85rem",
            borderRadius: 12,
            border: "none",
            cursor: "pointer",
            marginTop: "0.5rem",
          }}
        >
          {t["modal.training.submit"]}
        </button>
      </form>
    </div>
  );
}
