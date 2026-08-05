"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { submitContact } from "@/app/actions/contacts";
import { VIETNAM_PROVINCES } from "@/lib/vietnam-provinces";

type Strings = {
  eyebrow: string;
  titlePrefix: string;
  titleEm: string;
  titleSuffix: string;
  desc: string;
  formTitle: string;
  formSub: string;
  fName: string;
  fNamePh: string;
  fPhone: string;
  fPhonePh: string;
  fEmail: string;
  fEmailPh: string;
  fAge: string;
  fDept: string;
  fDeptPh: string;
  deptOptions: { value: string; label: string }[];
  fCenter: string;
  fCenterPh: string;
  fMessage: string;
  fMessagePh: string;
  fRecruit: string;
  fAgree: string;
  submit: string;
  fnote: string;
  successTitle: string;
  successDesc: string;
  successEyebrow: string;
  procTitle: string;
  proc: { lbl: string; sub: string }[];
  contactLabel: string;
};

/**
 * 상담 신청 — 디자인 시스템 골격.
 *   폼이 섹션의 첫 요소(스텝 다이어그램은 옆 카드로 내림).
 *   필드 높이 48px · 간격 20px · 라벨은 항상 위 · 필수는 라벨 뒤 * 하나.
 *   제출 성공은 alert 이 아니라 폼을 대체하는 블록.
 */
export function Apply({ strings }: { strings: Strings }) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (!fd.get("agree")) {
      toast.error(strings.fAgree);
      return;
    }
    const input = {
      name: String(fd.get("name") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      email: String(fd.get("email") ?? ""),
      age: String(fd.get("age") ?? ""),
      dept: String(fd.get("dept") ?? ""),
      center: String(fd.get("center") ?? ""),
      recruiting: fd.get("recruiting") === "on" ? "Y" : "N",
      message: String(fd.get("message") ?? ""),
    };
    startTransition(async () => {
      const r = await submitContact(input);
      if (r.ok) {
        setDone(true);
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <section id="apply" className="section">
      <div className="sec-inner">
        <div className="sec-head">
          <div className="sec-eyebrow">{strings.eyebrow}</div>
          <h2 className="sec-title">
            {strings.titlePrefix}
            <em>{strings.titleEm}</em>
            {strings.titleSuffix}
          </h2>
          <p className="sec-desc">{strings.desc}</p>
        </div>

        <div className="apply-grid">
          <div className="form-wrap" id="apply-contact">
            {done ? (
              <div className="gc-success">
                <div className="gc-success-eyebrow">{strings.successEyebrow}</div>
                <div className="gc-success-title">{strings.successTitle}</div>
                <div className="gc-success-desc">{strings.successDesc}</div>
              </div>
            ) : (
              <>
                <div className="form-ttl">{strings.formTitle}</div>
                <div className="form-sub">{strings.formSub}</div>

                <form onSubmit={onSubmit}>
                  <div className="form-grid">
                    <div className="fg">
                      <label className="flbl" htmlFor="ap-name">
                        {strings.fName} <span className="gc-req">*</span>
                      </label>
                      <input
                        id="ap-name"
                        name="name"
                        className="finput"
                        required
                        placeholder={strings.fNamePh}
                      />
                    </div>
                    <div className="fg">
                      <label className="flbl" htmlFor="ap-phone">
                        {strings.fPhone} <span className="gc-req">*</span>
                      </label>
                      <input
                        id="ap-phone"
                        name="phone"
                        type="tel"
                        inputMode="tel"
                        className="finput gc-mono"
                        required
                        placeholder={strings.fPhonePh}
                      />
                    </div>
                    <div className="fg">
                      <label className="flbl" htmlFor="ap-email">
                        {strings.fEmail}
                      </label>
                      <input
                        id="ap-email"
                        name="email"
                        className="finput"
                        placeholder={strings.fEmailPh}
                      />
                    </div>
                    <div className="fg">
                      <label className="flbl" htmlFor="ap-age">
                        {strings.fAge}
                      </label>
                      <input
                        id="ap-age"
                        name="age"
                        type="number"
                        inputMode="numeric"
                        className="finput gc-mono"
                        placeholder="22"
                      />
                    </div>
                    <div className="fg">
                      <label className="flbl" htmlFor="ap-dept">
                        {strings.fDept}
                      </label>
                      <select
                        id="ap-dept"
                        name="dept"
                        className="fsel"
                        defaultValue=""
                      >
                        <option value="">{strings.fDeptPh}</option>
                        {strings.deptOptions.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="fg">
                      <label className="flbl" htmlFor="ap-center">
                        {strings.fCenter}
                      </label>
                      <select
                        id="ap-center"
                        name="center"
                        className="fsel"
                        defaultValue=""
                      >
                        <option value="">{strings.fCenterPh}</option>
                        {VIETNAM_PROVINCES.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="fg full">
                      <label className="flbl" htmlFor="ap-msg">
                        {strings.fMessage}
                      </label>
                      <textarea
                        id="ap-msg"
                        name="message"
                        rows={3}
                        className="ftxt"
                        placeholder={strings.fMessagePh}
                      />
                    </div>
                  </div>

                  <div className="form-consent">
                    <label className="fcheck">
                      <input type="checkbox" name="recruiting" />
                      <span>{strings.fRecruit}</span>
                    </label>
                    <label className="fcheck">
                      <input type="checkbox" name="agree" required />
                      <span>
                        {strings.fAgree} <span className="gc-req">*</span>
                      </span>
                    </label>
                  </div>

                  <button type="submit" className="fsub" disabled={pending}>
                    {strings.submit}
                  </button>
                  <p className="fnote">{strings.fnote}</p>
                </form>
              </>
            )}
          </div>

          {/* 절차 — 번호 원 1..N. 이모지 아이콘은 순서 정보를 담지 못한다. */}
          <aside className="process-card">
            <div className="process-card-ttl">{strings.procTitle}</div>
            <div className="gc-steps">
              {strings.proc.map((p, i) => (
                <div key={i} className="gc-step">
                  <div className="gc-step-rail">
                    <span className="gc-step-num">{i + 1}</span>
                    {i < strings.proc.length - 1 && (
                      <span className="gc-step-line" />
                    )}
                  </div>
                  <div className="gc-step-body">
                    <div className="gc-step-title">{p.lbl}</div>
                    <div className="gc-step-desc">{p.sub}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="process-contact">
              <div className="process-contact-l">{strings.contactLabel}</div>
              <div className="process-contact-v">0977.456.324</div>
              <div className="process-contact-v sub">Zalo +82-10-2256-8724</div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
