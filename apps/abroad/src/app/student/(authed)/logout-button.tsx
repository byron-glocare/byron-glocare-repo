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
      className="gc-btn gc-btn-secondary gc-btn-md"
    >
      {tr(locale, "로그아웃", "Đăng xuất")}
    </button>
  );
}
