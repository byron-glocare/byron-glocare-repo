"use client";

import { useTransition } from "react";

import { signOut } from "@/app/actions/auth";

export function SignOutButton({ label }: { label: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => startTransition(() => signOut())}
      disabled={pending}
      className="btn-ghost"
      style={{ fontSize: "0.85rem", padding: "10px 24px" }}
    >
      {pending ? "..." : label}
    </button>
  );
}
