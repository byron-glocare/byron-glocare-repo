"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Modal } from "@/components/modal";
import { submitPartnership } from "@/app/actions/contacts";

type Strings = {
  title: string;
  subtitle: string;
  name: string;
  company: string;
  companyPh: string;
  phone: string;
  email: string;
  emailPh: string;
  message: string;
  messagePh: string;
  submit: string;
  success: string;
};

export function PartnershipTrigger({
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
        className={className ?? "btn-ghost"}
        onClick={() => setOpen(true)}
      >
        {label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={strings.title}>
        <PartnershipForm strings={strings} onClose={() => setOpen(false)} />
      </Modal>
    </>
  );
}

function PartnershipForm({
  strings,
  onClose,
}: {
  strings: Strings;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const r = await submitPartnership({
        name,
        company,
        phone,
        email,
        message,
      });
      if (!r.ok) {
        toast.error("오류", { description: r.error });
        return;
      }
      toast.success(strings.success);
      onClose();
    });
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "0.9rem" }}>
      <p style={{ fontSize: "0.85rem", color: "var(--ink-light)", marginBottom: "0.4rem" }}>
        {strings.subtitle}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.7rem" }}>
        <div style={{ display: "grid", gap: "0.4rem" }}>
          <label className="field-label">{strings.name} *</label>
          <input
            className="field-input"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div style={{ display: "grid", gap: "0.4rem" }}>
          <label className="field-label">{strings.company} *</label>
          <input
            className="field-input"
            required
            placeholder={strings.companyPh}
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.7rem" }}>
        <div style={{ display: "grid", gap: "0.4rem" }}>
          <label className="field-label">{strings.email} *</label>
          <input
            className="field-input"
            type="email"
            required
            placeholder={strings.emailPh}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div style={{ display: "grid", gap: "0.4rem" }}>
          <label className="field-label">{strings.phone}</label>
          <input
            className="field-input"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
      </div>

      <div style={{ display: "grid", gap: "0.4rem" }}>
        <label className="field-label">{strings.message}</label>
        <textarea
          className="field-textarea"
          placeholder={strings.messagePh}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
        />
      </div>

      <button type="submit" className="btn-coral" disabled={pending}>
        {pending ? "..." : strings.submit}
      </button>
    </form>
  );
}
