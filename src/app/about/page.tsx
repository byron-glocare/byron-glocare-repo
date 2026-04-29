import { TrainingSignupTrigger } from "@/components/training-signup-modal";
import { PartnershipTrigger } from "@/components/partnership-modal";
import { getDict } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function AboutPage() {
  const t = await getDict();

  return (
    <>
      {/* HERO */}
      <section
        style={{
          background: "var(--peach)",
          padding: "4rem 20px 3.5rem",
          textAlign: "center",
        }}
      >
        <div className="page-wrap" style={{ padding: 0, maxWidth: 760 }}>
          <div className="eyebrow">{t["about.eyebrow"]}</div>
          <h1
            className="page-title"
            style={{ whiteSpace: "pre-line" }}
          >
            {t["about.headline"].split("\n").map((line, i) => (
              <span key={i} style={{ display: "block" }}>
                {i === 1 ? <em>{line}</em> : line}
              </span>
            ))}
          </h1>
          <p className="page-desc" style={{ margin: "0.8rem auto 0" }}>
            {t["about.intro"]}
          </p>
        </div>
      </section>

      {/* AUDIENCE — 결혼이민자 / 유학생 */}
      <section className="page-wrap">
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <h2
            style={{
              fontFamily: "var(--font-noto-serif-kr), serif",
              fontSize: "1.6rem",
              fontWeight: 800,
              color: "var(--ink)",
            }}
          >
            {t["about.audience.title"]}
          </h2>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "1.5rem",
          }}
        >
          <div className="card" style={{ textAlign: "center", padding: "2rem" }}>
            <div
              style={{
                width: 88,
                height: 88,
                borderRadius: "50%",
                background: "var(--coral-pale)",
                margin: "0 auto 1rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "2.4rem",
              }}
              aria-hidden
            >
              👩‍👧
            </div>
            <h3
              style={{
                color: "var(--coral)",
                fontWeight: 800,
                fontSize: "1.05rem",
                marginBottom: "0.7rem",
              }}
            >
              {t["about.audience.marriage.title"]}
            </h3>
            <p
              style={{
                fontSize: "0.88rem",
                color: "var(--ink-light)",
                lineHeight: 1.7,
              }}
            >
              {t["about.audience.marriage.desc"]}
            </p>
          </div>

          <div className="card" style={{ textAlign: "center", padding: "2rem" }}>
            <div
              style={{
                width: 88,
                height: 88,
                borderRadius: "50%",
                background: "var(--coral-pale)",
                margin: "0 auto 1rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "2.4rem",
              }}
              aria-hidden
            >
              🎓
            </div>
            <h3
              style={{
                color: "var(--coral)",
                fontWeight: 800,
                fontSize: "1.05rem",
                marginBottom: "0.7rem",
              }}
            >
              {t["about.audience.student.title"]}
            </h3>
            <p
              style={{
                fontSize: "0.88rem",
                color: "var(--ink-light)",
                lineHeight: 1.7,
              }}
            >
              {t["about.audience.student.desc"]}
            </p>
          </div>
        </div>
      </section>

      {/* CEO 인사말 */}
      <section
        style={{
          background: "#FFF8E1",
          padding: "4rem 20px",
        }}
      >
        <div className="page-wrap" style={{ padding: 0, maxWidth: 720 }}>
          <div className="eyebrow">{t["about.ceo.eyebrow"]}</div>
          <h2
            style={{
              fontFamily: "var(--font-noto-serif-kr), serif",
              fontSize: "1.6rem",
              fontWeight: 900,
              color: "var(--ink)",
              marginBottom: "1.4rem",
            }}
          >
            {t["about.ceo.title"]}
          </h2>
          <div
            style={{
              fontSize: "0.95rem",
              color: "var(--ink-mid)",
              lineHeight: 1.85,
              whiteSpace: "pre-line",
            }}
          >
            {t["about.ceo.body"]}
          </div>
          <div
            style={{
              marginTop: "1.6rem",
              paddingTop: "1.4rem",
              borderTop: "2px solid var(--coral)",
              display: "inline-block",
              fontSize: "0.85rem",
              color: "var(--ink-mid)",
              fontWeight: 700,
            }}
          >
            {t["about.ceo.signature"]}
          </div>
        </div>
      </section>

      {/* CTA — 교육 신청 / 제휴 문의 */}
      <section
        id="training"
        className="page-wrap"
        style={{ textAlign: "center" }}
      >
        <h2
          style={{
            fontFamily: "var(--font-noto-serif-kr), serif",
            fontSize: "1.5rem",
            fontWeight: 900,
            marginBottom: "0.7rem",
          }}
        >
          시작하기 / Bắt đầu
        </h2>
        <p
          style={{
            color: "var(--ink-light)",
            fontSize: "0.92rem",
            marginBottom: "2rem",
          }}
        >
          글로케어와 함께 다음 단계로 / Bước tiếp theo cùng GLOCARE
        </p>

        <div
          style={{
            display: "flex",
            gap: "0.8rem",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          <TrainingSignupTrigger
            label={t["home.cta.training"]}
            strings={{
              title: t["modal.training.title"],
              subtitle: t["modal.training.subtitle"],
              name: t["modal.training.name"],
              namePh: t["modal.training.namePh"],
              phone: t["modal.training.phone"],
              phonePh: t["modal.training.phonePh"],
              email: t["modal.training.email"],
              emailPh: t["modal.training.emailPh"],
              region: t["modal.training.region"],
              regionPh: t["modal.training.regionPh"],
              topik: t["modal.training.topik"],
              topikPh: t["modal.training.topikPh"],
              visa: t["modal.training.visa"],
              visaPh: t["modal.training.visaPh"],
              message: t["modal.training.message"],
              messagePh: t["modal.training.messagePh"],
              submit: t["modal.training.submit"],
              success: t["modal.training.success"],
              needLogin: t["modal.training.needLogin"],
            }}
          />
          <span id="partner" />
          <PartnershipTrigger
            label={t["home.cta.partner"]}
            strings={{
              title: t["modal.partnership.title"],
              subtitle: t["modal.partnership.subtitle"],
              name: t["modal.partnership.name"],
              company: t["modal.partnership.company"],
              companyPh: t["modal.partnership.companyPh"],
              phone: t["modal.partnership.phone"],
              email: t["modal.partnership.email"],
              emailPh: t["modal.partnership.emailPh"],
              message: t["modal.partnership.message"],
              messagePh: t["modal.partnership.messagePh"],
              submit: t["modal.partnership.submit"],
              success: t["modal.partnership.success"],
            }}
          />
        </div>
      </section>
    </>
  );
}
