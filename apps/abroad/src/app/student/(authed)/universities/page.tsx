/**
 * /student/universities — B2C 셀프 학생 대학 탐색.
 *   universities.tier 로 3분류: partner(협약, 서류작성+컨설팅) / open(자유지원, 서류작성만).
 *   미등록 대학은 요청(study_university_requests) → 글로케어 승인 시 목록에 편입.
 *   지원 시작은 상세(/student/universities/[id])에서.
 */

import { verifyStudentSession } from "@/lib/student/dal";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n";

import { UniversitiesClient, type UniversityCard } from "./universities-client";

export const dynamic = "force-dynamic";

export default async function StudentUniversitiesPage() {
  await verifyStudentSession();
  const locale = await getLocale();
  const supabase = await createClient();

  const [{ data: universities }, { data: offerings }] = await Promise.all([
    supabase
      .from("universities")
      .select("id, name_ko, name_vi, region_ko, region_vi, emoji, logo_url, tier")
      .order("id"),
    supabase
      .from("study_offerings")
      .select("university_id")
      .eq("status", "published")
      .not("source_spec_id", "is", null),
  ]);

  // 대학별 모집(지원 가능) 과정 수
  const offeringCount = new Map<number, number>();
  for (const o of offerings ?? []) {
    offeringCount.set(
      o.university_id,
      (offeringCount.get(o.university_id) ?? 0) + 1
    );
  }

  const cards: UniversityCard[] = (universities ?? []).map((u) => ({
    id: u.id,
    name: (locale === "vi" ? u.name_vi ?? u.name_ko : u.name_ko) ?? "",
    region:
      (locale === "vi" ? u.region_vi ?? u.region_ko : u.region_ko) ?? null,
    emoji: u.emoji ?? null,
    logoUrl: u.logo_url ?? null,
    tier: u.tier === "partner" ? "partner" : "open",
    offeringCount: offeringCount.get(u.id) ?? 0,
  }));

  return <UniversitiesClient locale={locale} universities={cards} />;
}
