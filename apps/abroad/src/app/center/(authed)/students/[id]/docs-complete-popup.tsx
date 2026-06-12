"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { tr, type Locale } from "@/lib/i18n";

import { updateApplicationStatusAction } from "./applications/actions";

/**
 * 모든 작성서류 준비 시 단계를 '서류 작성 완료'로 바꿀지 1회 팝업으로 묻는다.
 *   세션당 지원별 1회만 (sessionStorage). 거절하면 수동 변경.
 */
export function DocsCompletePopup({
  locale,
  applicationId,
  studentId,
}: {
  locale: Locale;
  applicationId: string;
  studentId: string;
}) {
  const router = useRouter();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    const key = `dcp-${applicationId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");

    const ok = window.confirm(
      tr(
        locale,
        "작성서류가 모두 준비되었습니다. 단계를 '서류 작성 완료'로 변경할까요?",
        "Hồ sơ đã sẵn sàng. Đổi giai đoạn sang 'Hoàn tất hồ sơ'?"
      )
    );
    if (!ok) return;
    const fd = new FormData();
    fd.set("status", "docs_complete");
    void updateApplicationStatusAction(applicationId, studentId, fd).then(() =>
      router.refresh()
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
