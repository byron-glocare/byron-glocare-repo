"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { verifyAndMap } from "@/app/actions/verify";

export function VerifyForm({
  labels,
}: {
  labels: {
    name: string;
    namePh: string;
    phone: string;
    phonePh: string;
    submit: string;
    successMatched: string;
    errorNoMatch: string;
    skipLabel: string;
  };
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const fromPath = sp.get("from") || "/";
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const r = await verifyAndMap({ name, phone });
      if (!r.ok) {
        toast.error("오류", { description: r.error });
        return;
      }
      if (r.mapped) {
        toast.success(labels.successMatched);
        router.push(fromPath);
        router.refresh();
      } else {
        toast.warning(labels.errorNoMatch);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "1rem" }}>
      <div>
        <label className="field-label">{labels.name}</label>
        <input
          type="text"
          className="field-input"
          placeholder={labels.namePh}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div>
        <label className="field-label">{labels.phone}</label>
        <input
          type="tel"
          className="field-input"
          placeholder={labels.phonePh}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />
      </div>
      <button type="submit" className="btn-coral" disabled={pending}>
        {pending ? "..." : labels.submit}
      </button>
      <button
        type="button"
        onClick={() => router.push(fromPath)}
        style={{
          background: "none",
          border: "none",
          color: "var(--ink-light)",
          fontSize: "0.82rem",
          cursor: "pointer",
          padding: "0.4rem",
          textDecoration: "underline",
        }}
      >
        {labels.skipLabel}
      </button>
    </form>
  );
}
