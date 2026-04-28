"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { submitInsurance } from "@/app/actions/contacts";

type Strings = {
  eyebrow: string;
  titlePrefix: string;
  titleEm: string;
  titleSuffix: string;
  desc: string;
  fName: string;
  fNamePh: string;
  fAlien: string;
  fAlienPh: string;
  fAlienHint: string;
  fZalo: string;
  fZaloPh: string;
  fZaloHint: string;
  agreeAll: string;
  agreeRequired: string;
  agreeMarketing: string;
  viewTerms: string;
  termsRequired: string;
  termsMarketing: string;
  contactTitle: string;
  contactIntro: string;
  contactKr: string;
  contactVn: string;
  fnote: string;
  submit: string;
  successTitle: string;
  successDesc: string;
};

export function InsuranceRefund({ strings }: { strings: Strings }) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [agreeReq, setAgreeReq] = useState(false);
  const [agreeMkt, setAgreeMkt] = useState(false);
  const [showTerms1, setShowTerms1] = useState(false);
  const [showTerms2, setShowTerms2] = useState(false);

  const allChecked = agreeReq && agreeMkt;

  function toggleAll(v: boolean) {
    setAgreeReq(v);
    setAgreeMkt(v);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!agreeReq) {
      toast.error(strings.agreeRequired);
      return;
    }
    const fd = new FormData(e.currentTarget);
    const input = {
      name: String(fd.get("name") ?? ""),
      alien_no: String(fd.get("alien_no") ?? ""),
      zalo: String(fd.get("zalo") ?? ""),
      marketing: agreeMkt ? "Y" : "N",
    };
    startTransition(async () => {
      const r = await submitInsurance(input);
      if (r.ok) {
        setDone(true);
        toast.success(strings.successTitle);
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <section id="insurance-refund" className="section">
      <div className="sec-inner">
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <div
            className="sec-eyebrow"
            style={{ margin: "0 auto 1rem" }}
          >
            {strings.eyebrow}
          </div>
          <h2 className="sec-title" style={{ marginBottom: "0.5rem" }}>
            {strings.titlePrefix}
            <em>{strings.titleEm}</em>
            {strings.titleSuffix}
          </h2>
          <p
            className="sec-desc"
            style={{ margin: "0 auto", textAlign: "center" }}
          >
            {strings.desc}
          </p>
        </div>

        <div className="ins-form-wrap" id="apply-form">
          {done ? (
            <div className="ins-success">
              <div className="ins-success-ico">✓</div>
              <div className="ins-success-title">{strings.successTitle}</div>
              <div className="ins-success-desc">{strings.successDesc}</div>
            </div>
          ) : (
            <form onSubmit={onSubmit}>
              <div className="ins-form-grid">
                <div className="ins-fg">
                  <label className="flbl">{strings.fName} *</label>
                  <input
                    name="name"
                    className="finput"
                    required
                    placeholder={strings.fNamePh}
                  />
                </div>
                <div className="ins-fg">
                  <label className="flbl">{strings.fAlien} *</label>
                  <input
                    name="alien_no"
                    className="finput"
                    required
                    placeholder={strings.fAlienPh}
                  />
                  <div className="ins-hint">{strings.fAlienHint}</div>
                </div>
                <div className="ins-fg">
                  <label className="flbl">{strings.fZalo} *</label>
                  <input
                    name="zalo"
                    className="finput"
                    required
                    placeholder={strings.fZaloPh}
                  />
                  <div className="ins-hint">{strings.fZaloHint}</div>
                </div>

                <div className="ins-consent">
                  <label className="ins-consent-all">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      onChange={(e) => toggleAll(e.target.checked)}
                    />
                    <span>{strings.agreeAll}</span>
                  </label>
                  <label className="ins-consent-item">
                    <input
                      type="checkbox"
                      checked={agreeReq}
                      onChange={(e) => setAgreeReq(e.target.checked)}
                    />
                    <span>{strings.agreeRequired}</span>
                    <button
                      type="button"
                      className="ins-view-terms"
                      onClick={() => setShowTerms1((v) => !v)}
                    >
                      {strings.viewTerms}
                    </button>
                  </label>
                  <div
                    className={`ins-terms-content${showTerms1 ? " open" : ""}`}
                    dangerouslySetInnerHTML={{ __html: strings.termsRequired }}
                  />
                  <label className="ins-consent-item">
                    <input
                      type="checkbox"
                      checked={agreeMkt}
                      onChange={(e) => setAgreeMkt(e.target.checked)}
                    />
                    <span>{strings.agreeMarketing}</span>
                    <button
                      type="button"
                      className="ins-view-terms"
                      onClick={() => setShowTerms2((v) => !v)}
                    >
                      {strings.viewTerms}
                    </button>
                  </label>
                  <div
                    className={`ins-terms-content${showTerms2 ? " open" : ""}`}
                    dangerouslySetInnerHTML={{ __html: strings.termsMarketing }}
                  />
                </div>

                <button
                  type="submit"
                  className="ins-submit"
                  disabled={!agreeReq || pending}
                >
                  {pending ? "..." : strings.submit}
                </button>
              </div>

              <div className="ins-contact-box">
                <div className="ins-contact-title">{strings.contactTitle}</div>
                <div className="ins-contact-links">
                  <span>{strings.contactIntro}</span>
                </div>
                <div
                  className="ins-contact-links"
                  style={{ marginTop: "0.4rem" }}
                >
                  <a
                    href="https://www.hikorea.go.kr"
                    target="_blank"
                    rel="noopener"
                  >
                    hikorea.go.kr
                  </a>
                  <span>{strings.contactKr}</span>
                  <span>{strings.contactVn}</span>
                </div>
              </div>

              <div className="fnote">{strings.fnote}</div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
