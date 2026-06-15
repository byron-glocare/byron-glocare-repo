"use client";

import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

type Labels = {
  label: string;
  ph: string;
  send: string;
  sending: string;
  codeLabel: string;
  codePh: string;
  verify: string;
  verifying: string;
  sent: string;
  resend: string;
  error: string;
};

/** 한국 휴대폰 입력 → E.164 (+82) */
function toE164(raw: string): string {
  const d = raw.replace(/[^0-9]/g, "");
  if (d.startsWith("82")) return "+" + d;
  if (d.startsWith("0")) return "+82" + d.slice(1);
  return "+" + d;
}

export function PhoneLogin({
  next,
  labels,
}: {
  next: string;
  labels: Labels;
}) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.7rem 0.9rem",
    borderRadius: 10,
    border: "1px solid var(--coral-soft)",
    fontSize: "0.95rem",
    marginTop: "0.3rem",
  };
  const btnStyle: React.CSSProperties = {
    width: "100%",
    background: "var(--coral)",
    color: "var(--white)",
    fontWeight: 700,
    padding: "0.8rem",
    borderRadius: 10,
    border: "none",
    cursor: "pointer",
    marginTop: "0.6rem",
  };

  async function sendOtp() {
    if (!phone.trim()) return;
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      phone: toE164(phone),
    });
    setLoading(false);
    if (error) {
      setError(labels.error);
      return;
    }
    setStep("code");
  }

  async function verifyOtp() {
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({
      phone: toE164(phone),
      token: code.trim(),
      type: "sms",
    });
    setLoading(false);
    if (error) {
      setError(labels.error);
      return;
    }
    window.location.href = next;
  }

  return (
    <div>
      <label style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--ink)" }}>
        {labels.label}
        <input
          type="tel"
          inputMode="numeric"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder={labels.ph}
          disabled={step === "code"}
          style={inputStyle}
        />
      </label>

      {step === "phone" && (
        <button type="button" onClick={sendOtp} disabled={loading} style={btnStyle}>
          {loading ? labels.sending : labels.send}
        </button>
      )}

      {step === "code" && (
        <>
          <p
            style={{
              fontSize: "0.82rem",
              color: "var(--ink-light)",
              marginTop: "0.6rem",
            }}
          >
            {labels.sent}
          </p>
          <label
            style={{
              fontSize: "0.85rem",
              fontWeight: 700,
              color: "var(--ink)",
              display: "block",
              marginTop: "0.4rem",
            }}
          >
            {labels.codeLabel}
            <input
              type="text"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={labels.codePh}
              style={inputStyle}
            />
          </label>
          <button
            type="button"
            onClick={verifyOtp}
            disabled={loading}
            style={btnStyle}
          >
            {loading ? labels.verifying : labels.verify}
          </button>
          <button
            type="button"
            onClick={sendOtp}
            disabled={loading}
            style={{
              background: "none",
              border: "none",
              color: "var(--coral)",
              fontSize: "0.82rem",
              cursor: "pointer",
              marginTop: "0.5rem",
            }}
          >
            {labels.resend}
          </button>
        </>
      )}

      {error && (
        <p style={{ color: "var(--coral-d)", fontSize: "0.82rem", marginTop: "0.5rem" }}>
          {error}
        </p>
      )}
    </div>
  );
}
