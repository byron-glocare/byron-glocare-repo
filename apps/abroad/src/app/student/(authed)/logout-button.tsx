"use client";

import { useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { tr, type Locale } from "@/lib/i18n";

export function StudentLogout({ locale }: { locale: Locale }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await createClient().auth.signOut();
        window.location.href = "/student/login";
      }}
      className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-60"
    >
      {tr(locale, "로그아웃", "Đăng xuất")}
    </button>
  );
}
