import Link from "next/link";

import type { Locale } from "@/lib/i18n";

/**
 * SNS 로그인은 했지만 customers row 와 매핑 안 된 사용자에게 노출되는 배너.
 */
export function UnmappedBanner({ locale }: { locale: Locale }) {
  const isVi = locale === "vi";
  return (
    <div
      style={{
        background: "#FFF8E1",
        borderBottom: "1px solid #FFE082",
        padding: "10px 20px",
        textAlign: "center",
        fontSize: "0.85rem",
        color: "#7E5C00",
      }}
    >
      ⚠️{" "}
      {isVi
        ? "Tài khoản chưa được liên kết với hồ sơ GLOCARE."
        : "계정이 글로케어 프로필과 연동되지 않았습니다."}{" "}
      <Link
        href="/verify"
        style={{
          color: "var(--coral-d)",
          fontWeight: 700,
          textDecoration: "underline",
          marginLeft: "0.4rem",
        }}
      >
        {isVi ? "Xác thực ngay →" : "지금 확인하기 →"}
      </Link>
    </div>
  );
}
