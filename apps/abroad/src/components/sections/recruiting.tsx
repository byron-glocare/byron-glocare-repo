import Link from "next/link";

type RecruitingStrings = {
  eyebrow: string;
  title: string;
  desc: string;
  steps: { num: number; title: string; desc: string }[];
  programs: { ico: string; title: string; desc: string }[];
  rewards: { ico: string; val: string; lbl: string }[];
  giftHeader: string;
  giftList: string;
  ctaJoin: string;
  ctaDetails: string;
  footnote: string;
};

export function Recruiting({ strings }: { strings: RecruitingStrings }) {
  return (
    <section id="recruiting" className="section">
      <div className="sec-inner recruit-inner">
        <div>
          <div className="recruit-eyebrow">{strings.eyebrow}</div>
          <h2
            className="recruit-title"
            dangerouslySetInnerHTML={{ __html: strings.title }}
          />
          <p className="recruit-desc">{strings.desc}</p>
          <div>
            {strings.steps.map((s) => (
              <div key={s.num} className="r-step">
                <div className="r-num">{s.num}</div>
                <div>
                  <div className="r-step-title">{s.title}</div>
                  <div className="r-step-desc">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <div
            style={{
              display: "flex",
              gap: "0.8rem",
              marginTop: "2rem",
              flexWrap: "wrap",
            }}
          >
            {strings.programs.map((p, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  minWidth: "200px",
                  background: "rgba(255,255,255,0.12)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: "12px",
                  padding: "1.2rem",
                }}
              >
                <div style={{ fontSize: "1.1rem", marginBottom: "0.3rem" }}>
                  {p.ico}
                </div>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: "0.9rem",
                    marginBottom: "0.4rem",
                    color: "var(--white)",
                  }}
                >
                  {p.title}
                </div>
                <div
                  style={{
                    fontSize: "0.78rem",
                    color: "rgba(255,255,255,0.75)",
                    lineHeight: 1.6,
                  }}
                >
                  {p.desc}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="reward-grid">
            {strings.rewards.map((r, i) => (
              <div key={i} className="reward-box">
                <div className="reward-ico">{r.ico}</div>
                <div className="reward-val">{r.val}</div>
                <div
                  className="reward-lbl"
                  dangerouslySetInnerHTML={{ __html: r.lbl }}
                />
              </div>
            ))}
          </div>

          <div
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: "10px",
              padding: "1rem 1.2rem",
              marginTop: "1rem",
            }}
          >
            <div
              style={{
                fontSize: "0.78rem",
                fontWeight: 700,
                color: "rgba(255,255,255,0.9)",
                marginBottom: "0.5rem",
              }}
            >
              {strings.giftHeader}
            </div>
            <div
              style={{
                fontSize: "0.72rem",
                color: "rgba(255,255,255,0.6)",
                lineHeight: 1.7,
              }}
            >
              {strings.giftList}
            </div>
          </div>

          <div
            style={{
              textAlign: "center",
              marginTop: "2rem",
              display: "flex",
              gap: "0.8rem",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <Link
              href="/#apply"
              className="btn-coral"
              style={{ background: "var(--white)", color: "var(--coral)" }}
            >
              {strings.ctaJoin}
            </Link>
          </div>

          <p
            style={{
              textAlign: "center",
              fontSize: "0.7rem",
              color: "rgba(255,255,255,0.5)",
              marginTop: "1rem",
              lineHeight: 1.6,
            }}
            dangerouslySetInnerHTML={{ __html: strings.footnote }}
          />
        </div>
      </div>
    </section>
  );
}
