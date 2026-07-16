"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { tr, type Locale } from "@/lib/i18n";

export function StudentLoginButtons({ locale }: { locale: Locale }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const sp = useSearchParams();
  const nextParam = sp.get("next") || "/student";
  const errorParam = sp.get("error");

  async function google() {
    setBusy(true);
    setErr(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
          nextParam
        )}`,
      },
    });
    if (error) {
      setBusy(false);
      setErr(error.message);
    }
    // 성공 시 구글로 리다이렉트 — 이 컴포넌트는 언마운트됨
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={google}
        disabled={busy}
        className="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
      >
        <GoogleIcon />
        {busy
          ? tr(locale, "이동 중...", "Đang chuyển...")
          : tr(locale, "구글로 계속하기", "Tiếp tục với Google")}
      </button>

      {errorParam === "no_student" ? (
        <p className="text-xs text-amber-600">
          {tr(
            locale,
            "계정 정보를 준비 중입니다. 다시 시도해 주세요.",
            "Đang chuẩn bị tài khoản. Vui lòng thử lại."
          )}
        </p>
      ) : errorParam ? (
        <p className="text-xs text-rose-600">
          {tr(locale, "로그인에 실패했습니다.", "Đăng nhập thất bại.")} ({errorParam})
        </p>
      ) : null}
      {err ? <p className="text-xs text-rose-600">{err}</p> : null}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35 24 35c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.5 0 20-7.6 20-21 0-1.2-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 5.1 29.6 3 24 3 16 3 9.1 7.6 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 45c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 36 26.7 37 24 37c-5.3 0-9.6-3.4-11.3-8.1l-6.5 5C9.1 40.3 16 45 24 45z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.3 5.5l6.3 5.3C41.9 36 44 30.6 44 24c0-1.2-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}
