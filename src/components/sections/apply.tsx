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
  proc: { ico: string; lbl: string; sub: string }[];
};

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
        toast.success(strings.successTitle);
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <section id="apply" className="section">
      <div className="sec-inner">
        <div style={{ textAlign: "center", marginBottom: "3.5rem" }}>
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

        <div className="form-wrap" id="apply-contact">
          <div className="form-ttl">{strings.formTitle}</div>
          <div className="form-sub">{strings.formSub}</div>

          {done ? (
            <div className="ins-success">
              <div className="ins-success-ico">✓</div>
              <div className="ins-success-title">{strings.successTitle}</div>
              <div className="ins-success-desc">{strings.successDesc}</div>
            </div>
          ) : (
            <form onSubmit={onSubmit}>
              <div className="form-grid">
                <div className="fg">
                  <label className="flbl">{strings.fName} *</label>
                  <input
                    name="name"
                    className="finput"
                    required
                    placeholder={strings.fNamePh}
                  />
                </div>
                <div className="fg">
                  <label className="flbl">{strings.fPhone} *</label>
                  <input
                    name="phone"
                    type="tel"
                    className="finput"
                    required
                    placeholder={strings.fPhonePh}
                  />
                </div>
                <div className="fg">
                  <label className="flbl">{strings.fEmail}</label>
                  <input
                    name="email"
                    className="finput"
                    placeholder={strings.fEmailPh}
                  />
                </div>
                <div className="fg">
                  <label className="flbl">{strings.fAge}</label>
                  <input
                    name="age"
                    type="number"
                    className="finput"
                    placeholder="22"
                  />
                </div>
                <div className="fg">
                  <label className="flbl">{strings.fDept}</label>
                  <select name="dept" className="fsel" defaultValue="">
                    <option value="">{strings.fDeptPh}</option>
                    {strings.deptOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="fg full">
                  <label className="flbl">{strings.fCenter}</label>
                  <select name="center" className="fsel" defaultValue="">
                    <option value="">{strings.fCenterPh}</option>
                    {VIETNAM_PROVINCES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="fg full">
                  <label className="flbl">{strings.fMessage}</label>
                  <textarea
                    name="message"
                    className="ftxt"
                    placeholder={strings.fMessagePh}
                  />
                </div>
                <div className="fg full">
                  <label className="fcheck">
                    <input type="checkbox" name="recruiting" />
                    <span>{strings.fRecruit}</span>
                  </label>
                </div>
                <div className="fg full">
                  <label className="fcheck">
                    <input type="checkbox" name="agree" required />
                    <span>{strings.fAgree} *</span>
                  </label>
                </div>
              </div>
              <button type="submit" className="fsub" disabled={pending}>
                {pending ? "..." : strings.submit}
              </button>
              <p className="fnote">{strings.fnote}</p>
            </form>
          )}
        </div>

        <div className="process-strip">
          {strings.proc.map((p, i) => (
            <div key={i} className="proc-step">
              <div className="proc-ico">{p.ico}</div>
              <div className="proc-lbl">{p.lbl}</div>
              <div
                className="proc-sub"
                dangerouslySetInnerHTML={{ __html: p.sub }}
              />
              {i < strings.proc.length - 1 && (
                <div className="proc-arr">›</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
