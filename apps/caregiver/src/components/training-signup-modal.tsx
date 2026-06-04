"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Modal } from "@/components/modal";
import { submitTrainingSignup } from "@/app/actions/contacts";

type Strings = {
  title: string;
  subtitle: string;
  name: string;
  namePh: string;
  phone: string;
  phonePh: string;
  email: string;
  emailPh: string;
  region: string;
  regionPh: string;
  topik: string;
  topikPh: string;
  visa: string;
  visaPh: string;
  message: string;
  messagePh: string;
  submit: string;
  success: string;
  needLogin: string;
};

const TOPIK_LEVELS = ["1급", "2급", "3급", "4급", "5급", "6급", "미응시"];
const VISA_TYPES = [
  "F-2 (거주)",
  "F-4 (재외동포)",
  "F-5 (영주)",
  "F-6 (결혼이민)",
  "D-2 (유학)",
  "D-4 (연수)",
  "D-10 (구직)",
  "기타",
];

export function TrainingSignupTrigger({
  label,
  className,
  strings,
}: {
  label: string;
  className?: string;
  strings: Strings;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={className ?? "btn-coral"}
        onClick={() => setOpen(true)}
      >
        {label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={strings.title}>
        <TrainingSignupForm strings={strings} onClose={() => setOpen(false)} />
      </Modal>
    </>
  );
}

function TrainingSignupForm({
  strings,
  onClose,
}: {
  strings: Strings;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [region, setRegion] = useState("");
  const [topik, setTopik] = useState("");
  const [visa, setVisa] = useState("");
  const [message, setMessage] = useState("");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const r = await submitTrainingSignup({
        name,
        phone,
        email,
        region,
        topik_level: topik,
        visa_type: visa,
        message,
      });
      if (!r.ok) {
        toast.error("오류", { description: r.error });
        return;
      }
      if (r.needsLogin) {
        toast.info(strings.needLogin);
        router.push(`/login?next=/`);
        return;
      }
      toast.success(strings.success);
      onClose();
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "0.9rem" }}>
      <p
        style={{
          fontSize: "0.85rem",
          color: "var(--ink-light)",
          marginBottom: "0.4rem",
        }}
      >
        {strings.subtitle}
      </p>

      <div style={{ display: "grid", gap: "0.4rem" }}>
        <label className="field-label">{strings.name} *</label>
        <input
          className="field-input"
          required
          placeholder={strings.namePh}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.7rem" }}>
        <div style={{ display: "grid", gap: "0.4rem" }}>
          <label className="field-label">{strings.phone} *</label>
          <input
            className="field-input"
            type="tel"
            required
            placeholder={strings.phonePh}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <div style={{ display: "grid", gap: "0.4rem" }}>
          <label className="field-label">{strings.email}</label>
          <input
            className="field-input"
            type="email"
            placeholder={strings.emailPh}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
      </div>

      <div style={{ display: "grid", gap: "0.4rem" }}>
        <label className="field-label">{strings.region}</label>
        <input
          className="field-input"
          placeholder={strings.regionPh}
          value={region}
          onChange={(e) => setRegion(e.target.value)}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.7rem" }}>
        <div style={{ display: "grid", gap: "0.4rem" }}>
          <label className="field-label">{strings.topik}</label>
          <select
            className="field-select"
            value={topik}
            onChange={(e) => setTopik(e.target.value)}
          >
            <option value="">{strings.topikPh}</option>
            {TOPIK_LEVELS.map((lvl) => (
              <option key={lvl} value={lvl}>
                {lvl}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: "grid", gap: "0.4rem" }}>
          <label className="field-label">{strings.visa}</label>
          <select
            className="field-select"
            value={visa}
            onChange={(e) => setVisa(e.target.value)}
          >
            <option value="">{strings.visaPh}</option>
            {VISA_TYPES.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: "grid", gap: "0.4rem" }}>
        <label className="field-label">{strings.message}</label>
        <textarea
          className="field-textarea"
          placeholder={strings.messagePh}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
        />
      </div>

      <button type="submit" className="btn-coral" disabled={pending}>
        {pending ? "..." : strings.submit}
      </button>
    </form>
  );
}
