import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PayFailPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const sp = await searchParams;
  return (
    <div className="page-wrap fade-up" style={{ maxWidth: 480, textAlign: "center" }}>
      <h1 className="page-title">결제를 완료하지 못했어요</h1>
      <p className="page-desc">
        {sp.message ? decodeURIComponent(sp.message) : "다시 시도해주세요."}
      </p>
      <Link
        href="/my"
        style={{
          display: "inline-block",
          marginTop: "1.5rem",
          background: "var(--coral)",
          color: "var(--white)",
          fontWeight: 700,
          padding: "0.8rem 2rem",
          borderRadius: 12,
        }}
      >
        마이페이지로
      </Link>
    </div>
  );
}
