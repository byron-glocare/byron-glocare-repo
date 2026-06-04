"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { signInWithSns, type SnsProvider } from "@/app/actions/auth";

export function SnsLoginButtons({
  next,
  labels,
}: {
  next: string;
  labels: { google: string; facebook: string };
}) {
  const [pending, startTransition] = useTransition();

  function go(provider: SnsProvider) {
    if (pending) return;
    startTransition(async () => {
      const r = await signInWithSns(provider, next);
      if (r && !r.ok) {
        toast.error("로그인 실패", { description: r.error });
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.7rem" }}>
      <button
        type="button"
        onClick={() => go("google")}
        disabled={pending}
        className="sns-btn sns-google"
      >
        <GoogleIcon />
        <span>{labels.google}</span>
      </button>
      <button
        type="button"
        onClick={() => go("facebook")}
        disabled={pending}
        className="sns-btn sns-facebook"
      >
        <FacebookIcon />
        <span>{labels.facebook}</span>
      </button>

      <style>{`
        .sns-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          width: 100%;
          padding: 14px 18px;
          border-radius: 10px;
          font-family: inherit;
          font-weight: 600;
          font-size: 0.95rem;
          cursor: pointer;
          transition: all 0.2s;
          border: 1.5px solid transparent;
        }
        .sns-btn:hover { transform: translateY(-1px); }
        .sns-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
        .sns-google {
          background: #fff;
          color: #1c1c1e;
          border-color: #e0e0e0;
        }
        .sns-google:hover { box-shadow: 0 4px 14px rgba(0,0,0,0.08); }
        .sns-facebook {
          background: #1877f2;
          color: #fff;
        }
        .sns-facebook:hover { box-shadow: 0 4px 14px rgba(24,119,242,0.3); background: #1264cf; }
      `}</style>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}
