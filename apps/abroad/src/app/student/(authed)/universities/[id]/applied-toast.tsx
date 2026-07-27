"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { tr, type Locale } from "@/lib/i18n";

/** 지원 등록 직후(?applied=1) 한 번만 성공 토스트. */
export function AppliedToast({ locale }: { locale: Locale }) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    toast.success(
      tr(
        locale,
        "지원이 등록되었습니다. '내 지원'에서 서류 작성을 이어가세요.",
        "Đã đăng ký. Tiếp tục soạn hồ sơ tại 'Hồ sơ của tôi'."
      )
    );
  }, [locale]);
  return null;
}
