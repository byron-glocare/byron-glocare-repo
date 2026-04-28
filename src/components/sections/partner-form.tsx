"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { submitContact } from "@/app/actions/contacts";

type PartnerType = {
  ico: string;
  name: string;
  desc: string;
  value: string;
};

type Strings = {
  types: PartnerType[];
  fName: string;
  fNamePh: string;
  fCompany: string;
  fCompanyPh: string;
  fPhone: string;
  fPhonePh: string;
  fEmail: string;
  fEmailPh: string;
  fType: string;
  fRegion: string;
  fRegionPh: string;
  fMessage: string;
  fMessagePh: string;
  submit: string;
  successTitle: string;
  successDesc: string;
  errEmpty: string;
};

export function PartnerForm({ strings }: { strings: Strings }) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [type, setType] = useState(strings.types[0].value);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "").trim();
    const company = String(fd.get("company") ?? "").trim();
    const email = String(fd.get("email") ?? "").trim();
    if (!name || !company || !email) {
      toast.error(strings.errEmpty);
      return;
    }
    const message =
      `[파트너십] ${company} / ` + String(fd.get("message") ?? "");
    const input = {
      name,
      phone: String(fd.get("phone") ?? ""),
      email,
      dept: type,
      center: String(fd.get("region") ?? ""),
      recruiting: "partner",
      message,
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

  if (done) {
    return (
      <div className="partner-form">
        <div style={{ textAlign: "center", padding: "2.5rem" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🎉</div>
          <div
            style={{
              fontSize: "1.2rem",
              fontWeight: 700,
              marginBottom: ".5rem",
            }}
          >
            {strings.successTitle}
          </div>
          <div style={{ color: "var(--ink-light)", fontSize: ".9rem" }}>
            {strings.successDesc}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="partner-types">
        {strings.types.map((tp) => (
          <div
            key={tp.value}
            className={`ptype-card${type === tp.value ? " on" : ""}`}
            onClick={() => setType(tp.value)}
          >
            <div className="ptype-ico">{tp.ico}</div>
            <div className="ptype-name">{tp.name}</div>
            <div className="ptype-desc">{tp.desc}</div>
          </div>
        ))}
      </div>

      <form className="partner-form" onSubmit={onSubmit}>
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
            <label className="flbl">{strings.fCompany} *</label>
            <input
              name="company"
              className="finput"
              required
              placeholder={strings.fCompanyPh}
            />
          </div>
          <div className="fg">
            <label className="flbl">{strings.fPhone}</label>
            <input
              name="phone"
              className="finput"
              placeholder={strings.fPhonePh}
            />
          </div>
          <div className="fg">
            <label className="flbl">{strings.fEmail} *</label>
            <input
              name="email"
              type="email"
              className="finput"
              required
              placeholder={strings.fEmailPh}
            />
          </div>
          <div className="fg">
            <label className="flbl">{strings.fType}</label>
            <input className="finput" value={type} readOnly />
          </div>
          <div className="fg">
            <label className="flbl">{strings.fRegion}</label>
            <input
              name="region"
              className="finput"
              placeholder={strings.fRegionPh}
            />
          </div>
          <div className="fg full">
            <label className="flbl">{strings.fMessage}</label>
            <textarea
              name="message"
              className="ftxt"
              placeholder={strings.fMessagePh}
            />
          </div>
        </div>
        <button type="submit" className="submit-btn" disabled={pending}>
          {pending ? "..." : strings.submit}
        </button>
      </form>
    </>
  );
}
