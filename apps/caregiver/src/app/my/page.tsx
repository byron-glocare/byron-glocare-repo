import Link from "next/link";
import { GraduationCap, FileText, User } from "lucide-react";

import { confirmEnrollment, setKakaoConsent } from "@/app/actions/my";
import { getAuthState } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function MyPage() {
  const t = await getDict();
  const auth = await getAuthState();
  if (auth.kind === "guest") {
    const { redirect } = await import("next/navigation");
    redirect("/login?next=/my");
  }

  const customer = auth.kind === "mapped" ? auth.customer : null;
  const pt = customer?.product_type ?? null;
  const depositKind =
    pt === "웰컴팩" || pt === "교육+웰컴팩"
      ? "welcomepack_reservation"
      : "education_reservation";

  // 교육 배정 상태 + 잔금/동의용 데이터
  const assigned = !!customer?.class_start_date;
  const confirmed = !!customer?.enrollment_confirmed_at;

  const supabase = await createClient();
  const [{ data: wp }, { data: cust }] = await Promise.all([
    customer
      ? supabase
          .from("welcome_pack_payments")
          .select("interim_amount, interim_date, balance_amount, balance_date")
          .eq("customer_id", customer.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    customer
      ? supabase
          .from("customers")
          .select("kakao_consent")
          .eq("id", customer.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const needVisaFee = !!wp && (wp.interim_amount ?? 0) > 0 && !wp.interim_date;
  const needBalance = !!wp && (wp.balance_amount ?? 0) > 0 && !wp.balance_date;
  const kakaoConsent = !!cust?.kakao_consent;

  const cards = [
    {
      href: "/learn",
      icon: <GraduationCap />,
      title: t["my.learn.title"],
      desc: t["my.learn.desc"],
    },
    {
      href: "/resume",
      icon: <FileText />,
      title: t["my.resume.title"],
      desc: t["my.resume.desc"],
    },
    {
      href: "/profile",
      icon: <User />,
      title: t["my.profile.title"],
      desc: t["my.profile.desc"],
    },
  ];

  return (
    <div className="page-wrap fade-up" style={{ maxWidth: 760 }}>
      <div className="eyebrow">{t["my.eyebrow"]}</div>
      <h1 className="page-title">{t["my.title"]}</h1>
      <p className="page-desc">{t["my.intro"]}</p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1.2rem",
          marginTop: "2rem",
        }}
      >
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="card"
            style={{ display: "block", color: "inherit" }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: "var(--coral-pale)",
                color: "var(--coral)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "0.9rem",
              }}
            >
              {c.icon}
            </div>
            <div
              style={{
                fontFamily: "var(--font-noto-serif-kr), serif",
                fontSize: "1.05rem",
                fontWeight: 800,
                color: "var(--ink)",
                marginBottom: "0.3rem",
              }}
            >
              {c.title}
            </div>
            <div
              style={{
                fontSize: "0.85rem",
                color: "var(--ink-light)",
                lineHeight: 1.6,
              }}
            >
              {c.desc}
            </div>
          </Link>
        ))}
      </div>

      {/* 예약금 결제 (P4) */}
      <div
        className="card"
        style={{
          marginTop: "1.2rem",
          background: "var(--peach)",
          border: "none",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-noto-serif-kr), serif",
            fontWeight: 800,
            color: "var(--ink)",
            marginBottom: "0.35rem",
          }}
        >
          {t["my.pay.title"]}
        </div>
        <div
          style={{
            fontSize: "0.85rem",
            color: "var(--ink-mid)",
            lineHeight: 1.7,
            marginBottom: "0.9rem",
          }}
        >
          {t["my.pay.desc"]}
        </div>
        <Link
          href={`/pay?kind=${depositKind}`}
          style={{
            display: "inline-block",
            background: "var(--coral)",
            color: "var(--white)",
            fontWeight: 700,
            padding: "0.7rem 1.6rem",
            borderRadius: 10,
          }}
        >
          {t["my.pay.cta"]}
        </Link>
      </div>

      {/* 교육 배정 컨펌 */}
      {assigned && (
        <div className="card" style={{ marginTop: "1.2rem" }}>
          <div
            style={{
              fontFamily: "var(--font-noto-serif-kr), serif",
              fontWeight: 800,
              color: "var(--ink)",
              marginBottom: "0.35rem",
            }}
          >
            {t["my.enroll.title"]}
          </div>
          <div
            style={{
              fontSize: "0.85rem",
              color: "var(--ink-mid)",
              lineHeight: 1.7,
              marginBottom: "0.9rem",
            }}
          >
            {customer?.class_start_date} ~ {customer?.class_end_date ?? "—"}
          </div>
          {confirmed ? (
            <span style={{ color: "var(--coral)", fontWeight: 700 }}>
              ✓ {t["my.enroll.done"]}
            </span>
          ) : (
            <form action={confirmEnrollment}>
              <button
                type="submit"
                style={{
                  background: "var(--coral)",
                  color: "var(--white)",
                  fontWeight: 700,
                  padding: "0.7rem 1.6rem",
                  borderRadius: 10,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {t["my.enroll.cta"]}
              </button>
            </form>
          )}
        </div>
      )}

      {/* 잔금 결제 (비자수수료 / 최종잔금) — 관리자가 금액 설정 시 노출 */}
      {(needVisaFee || needBalance) && (
        <div
          className="card"
          style={{ marginTop: "1.2rem", display: "flex", gap: "0.8rem", flexWrap: "wrap" }}
        >
          {needVisaFee && (
            <Link
              href="/pay?kind=welcomepack_interim"
              style={{
                background: "var(--coral)",
                color: "var(--white)",
                fontWeight: 700,
                padding: "0.7rem 1.4rem",
                borderRadius: 10,
              }}
            >
              {t["my.balance.visa"]}
            </Link>
          )}
          {needBalance && (
            <Link
              href="/pay?kind=welcomepack_balance"
              style={{
                background: "var(--coral)",
                color: "var(--white)",
                fontWeight: 700,
                padding: "0.7rem 1.4rem",
                borderRadius: 10,
              }}
            >
              {t["my.balance.final"]}
            </Link>
          )}
        </div>
      )}

      {/* 알림톡 수신동의 */}
      <form
        action={setKakaoConsent}
        className="card"
        style={{
          marginTop: "1.2rem",
          display: "flex",
          alignItems: "center",
          gap: "0.8rem",
          flexWrap: "wrap",
        }}
      >
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            fontSize: "0.9rem",
            color: "var(--ink)",
            flex: 1,
          }}
        >
          <input type="checkbox" name="consent" defaultChecked={kakaoConsent} />
          {t["my.consent.label"]}
        </label>
        <button
          type="submit"
          style={{
            background: "var(--coral-pale)",
            color: "var(--coral)",
            fontWeight: 700,
            padding: "0.5rem 1.2rem",
            borderRadius: 10,
            border: "none",
            cursor: "pointer",
          }}
        >
          {t["my.consent.save"]}
        </button>
      </form>
    </div>
  );
}
