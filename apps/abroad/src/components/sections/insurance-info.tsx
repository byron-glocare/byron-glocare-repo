type Strings = {
  banner: string;
  s1Title: string;
  s1Items: { label: string; value: string }[];
  s2Title: string;
  s2Cases: string[];
  s2Notice: string;
  s3Title: string;
  s3Methods: { h: string; p: string }[];
  s4Title: string;
  s4Warning: string;
};

export function InsuranceInfo({ strings }: { strings: Strings }) {
  return (
    <section id="insurance-info" className="section">
      <div className="sec-inner">
        <div className="ins-hero-banner">
          <h2 dangerouslySetInnerHTML={{ __html: strings.banner }} />
        </div>

        <div className="ins-section">
          <div className="ins-section-title">{strings.s1Title}</div>
          <div className="ins-detail-list">
            {strings.s1Items.map((item, i) => (
              <div key={i} className="ins-detail-item">
                <div className="ins-detail-label">{item.label}</div>
                <div className="ins-detail-value">{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="ins-section">
          <div className="ins-section-title">{strings.s2Title}</div>
          <div className="ins-case-list">
            {strings.s2Cases.map((c, i) => (
              <div key={i} className="ins-case-item">
                <div className="ins-case-num">{i + 1}</div>
                <div className="ins-case-text">{c}</div>
              </div>
            ))}
          </div>
          <div className="ins-notice">{strings.s2Notice}</div>
        </div>

        <div className="ins-section">
          <div className="ins-section-title">{strings.s3Title}</div>
          <div className="ins-method-grid">
            {strings.s3Methods.map((m, i) => (
              <div key={i} className="ins-method-card">
                <h4>{m.h}</h4>
                <p>{m.p}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="ins-section" style={{ marginBottom: 0 }}>
          <div className="ins-section-title">{strings.s4Title}</div>
          <div
            className="ins-warning"
            dangerouslySetInnerHTML={{ __html: strings.s4Warning }}
          />
        </div>
      </div>
    </section>
  );
}
