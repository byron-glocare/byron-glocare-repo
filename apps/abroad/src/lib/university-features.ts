/**
 * 대학 '특징/강점' 체크 4종 → 화면 라벨.
 *
 *   어드민 '홈페이지 노출 정보'에서 체크하는 값(0025 의 feature_* 4컬럼)인데,
 *   정작 홈페이지가 이 값을 읽지 않아 체크해도 아무 데도 안 나왔다.
 *
 *   ※ 대학 상세의 기존 dormitory(불리언)와 feature_dormitory 는 별개다.
 *     앞은 내부 사실, 뒤는 홈페이지 강점 표시용(운영자 결정, 0025 주석 참고).
 *   ※ 어드민 라벨에는 이모지가 붙지만 공개 화면에는 쓰지 않는다(디자인 시스템).
 */

import { tr, type Locale } from "@/lib/i18n";

export type UniversityFeatureFlags = {
  feature_transport?: boolean | null;
  feature_parttime?: boolean | null;
  feature_housing?: boolean | null;
  feature_dormitory?: boolean | null;
};

/** 체크된 것만, 어드민 표시 순서 그대로 */
export function universityFeatures(
  u: UniversityFeatureFlags | null | undefined,
  locale: Locale
): string[] {
  if (!u) return [];
  const out: string[] = [];
  if (u.feature_transport)
    out.push(tr(locale, "편리한 교통", "Giao thông thuận tiện"));
  if (u.feature_parttime)
    out.push(tr(locale, "많은 알바 자리", "Nhiều việc làm thêm"));
  if (u.feature_housing) out.push(tr(locale, "많은 숙소", "Nhiều nhà trọ"));
  if (u.feature_dormitory) out.push(tr(locale, "기숙사", "Ký túc xá"));
  return out;
}
