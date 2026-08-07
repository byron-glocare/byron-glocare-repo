import Link from "next/link";

type RecruitingStrings = {
  eyebrow: string;
  title: string;
  desc: string;
  steps: { num: number; title: string; desc: string }[];
  programs: { title: string; desc: string }[];
  rewards: { prefix: string; amount: string; unit: string; lbl: string }[];
  giftHeader: string;
  giftList: string;
  ctaJoin: string;
  ctaDetails: string;
  footnote: string;
};

/**
 * 리크루팅(추천 프로그램) — 디자인 시스템 골격.
 *   배경은 흰 면으로 되돌리고, 금액 카드는 같은 흰 카드 + 1px 선으로 통일.
 *   금액만 mono 28px/700, 라벨은 small neutral-500. 이모지 아이콘은 쓰지 않는다.
 */
export function Recruiting({ strings }: { strings: RecruitingStrings }) {
  return (
    <section id="recruiting" className="section">
      <div className="sec-inner">
        <div className="recruit-inner">
          <div>
            <div className="recruit-eyebrow">{strings.eyebrow}</div>
            <h2
              className="recruit-title"
              dangerouslySetInnerHTML={{ __html: strings.title }}
            />
            <p className="recruit-desc">{strings.desc}</p>

            <div className="gc-steps">
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

            <div className="gc-grid gc-grid-2" style={{ marginTop: 32 }}>
              {strings.programs.map((p, i) => (
                <div key={i} className="gc-card">
                  <div className="gc-step-title">{p.title}</div>
                  <div className="gc-step-desc">{p.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="reward-grid">
              {strings.rewards.map((r, i) => (
                <div key={i} className="reward-box">
                  <div className="reward-amt">
                    {r.prefix && <span className="reward-pre">{r.prefix}</span>}
                    <span className="reward-num">{r.amount}</span>
                    <span className="reward-unit">{r.unit}</span>
                  </div>
                  <div className="reward-lbl">{r.lbl}</div>
                </div>
              ))}
            </div>

            <div className="gc-card" style={{ marginTop: 16 }}>
              <div className="gc-step-title">{strings.giftHeader}</div>
              <div className="gc-step-desc">{strings.giftList}</div>
            </div>

            <Link
              href="/#apply"
              className="btn-coral"
              style={{ marginTop: 24, width: "100%" }}
            >
              {strings.ctaJoin}
              <span className="arrow" aria-hidden>
                →
              </span>
            </Link>

            <p
              className="gc-hint"
              style={{ marginTop: 14 }}
              dangerouslySetInnerHTML={{ __html: strings.footnote }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
