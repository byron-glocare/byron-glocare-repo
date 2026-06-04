import { redirect } from "next/navigation";

import { SignOutButton } from "@/components/sign-out-button";
import { getAuthState } from "@/lib/auth";
import { getLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const auth = await getAuthState();
  if (auth.kind === "guest") redirect("/login?next=/profile");
  if (auth.kind === "unmapped") redirect("/verify");

  const locale = await getLocale();
  const isVi = locale === "vi";
  const c = auth.customer;

  return (
    <div className="page-wrap fade-up" style={{ maxWidth: 720 }}>
      <div className="eyebrow">{isVi ? "Thông tin của tôi" : "내 정보"}</div>
      <h1 className="page-title">
        {(isVi ? c.name_vi : c.name_kr) || c.name_vi || c.name_kr || "—"}
      </h1>

      <div className="card" style={{ marginTop: "1.5rem" }}>
        <div style={{ display: "grid", gap: "0.8rem", fontSize: "0.9rem" }}>
          <Row label={isVi ? "Mã" : "회원 코드"} value={c.code} />
          <Row label="Email" value={c.email ?? "—"} />
          <Row
            label={isVi ? "SĐT" : "전화"}
            value={c.phone ?? "—"}
          />
          <Row
            label={isVi ? "Gói" : "상품"}
            value={c.product_type ?? (isVi ? "(Chưa đăng ký)" : "(미등록)")}
          />
        </div>
      </div>

      <div style={{ marginTop: "2rem" }}>
        <SignOutButton label={isVi ? "Đăng xuất" : "로그아웃"} />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div style={{ display: "flex", gap: "1rem" }}>
      <span
        style={{
          color: "var(--ink-light)",
          minWidth: "100px",
          fontSize: "0.82rem",
        }}
      >
        {label}
      </span>
      <span style={{ color: "var(--ink)", fontWeight: 600 }}>{value}</span>
    </div>
  );
}
