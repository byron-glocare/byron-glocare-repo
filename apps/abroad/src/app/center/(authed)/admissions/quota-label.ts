/**
 * 모집 인원 표시 (0069)
 *   intake_quota = 글로케어 모집 인원, total_quota = 학교 전체 정원.
 *   "글로케어 N명 / 전체 M명" (VI: "Glocare N / Toàn trường M"). null 인 쪽은 생략.
 *   지원자 수는 센터·학생에게 노출하지 않는다.
 *   센터 모집 조회 · 신규 지원 폼 · 학생 대학 페이지가 같이 쓴다 (클라이언트에서도 import 가능).
 */

import { tr, type Locale } from "@/lib/i18n";

export function formatOfferingQuota(
  locale: Locale,
  intakeQuota: number | null | undefined,
  totalQuota: number | null | undefined
): string | null {
  const parts: string[] = [];
  if (intakeQuota != null) {
    parts.push(tr(locale, `글로케어 ${intakeQuota}명`, `Glocare ${intakeQuota}`));
  }
  if (totalQuota != null) {
    parts.push(tr(locale, `전체 ${totalQuota}명`, `Toàn trường ${totalQuota}`));
  }
  return parts.length > 0 ? parts.join(" / ") : null;
}
