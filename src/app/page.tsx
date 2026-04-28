import { Apply } from "@/components/sections/apply";
import { Cases } from "@/components/sections/cases";
import { Centers } from "@/components/sections/centers";
import { Hero } from "@/components/sections/hero";
import { InsuranceInfo } from "@/components/sections/insurance-info";
import { InsuranceRefund } from "@/components/sections/insurance-refund";
import { Recruiting } from "@/components/sections/recruiting";
import { Universities, type UniversityCard } from "@/components/sections/universities";
import { FloatingButtons } from "@/components/floating-buttons";
import { InsurancePopup } from "@/components/insurance-popup";
import { createClient } from "@/lib/supabase/server";
import { getDict, getLocale } from "@/lib/i18n";
import { getSectionStrings } from "@/lib/section-strings";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();
  const t = await getDict();
  const locale = await getLocale();
  const ss = getSectionStrings(locale);

  const [
    { data: heroCasesPrimary },
    { data: cases },
    { data: universities },
    { data: departments },
    { data: centers },
  ] = await Promise.all([
    supabase
      .from("study_cases")
      .select("id, title_ko, title_vi, tiktok_thumb, tiktok_url, hero")
      .eq("hero", true)
      .limit(3),
    supabase
      .from("study_cases")
      .select(
        "id, title_ko, title_vi, category_ko, category_vi, tiktok_thumb, tiktok_url"
      )
      .order("id", { ascending: false })
      .limit(8),
    supabase
      .from("universities")
      .select(
        "id, name_ko, name_vi, region_ko, region_vi, emoji, tags_ko, tags_vi, strengths"
      )
      .order("id"),
    supabase
      .from("departments")
      .select(
        "id, university_id, icon, name_ko, name_vi, badge, course, sort_order, degree_years, tuition_ko, tuition_vi, scholarship_ko, scholarship_vi, dept_url"
      )
      .order("sort_order"),
    supabase
      .from("study_centers")
      .select(
        "id, flag, name_ko, name_vi, city_ko, city_vi, desc_ko, desc_vi, students_ko, students_vi, years_ko, years_vi"
      )
      .order("id"),
  ]);

  // study_cases.hero=true 인 사례만 Hero 우측에 노출 (admin 에서 큐레이션).
  const heroVideos = (heroCasesPrimary ?? []).map((c) => ({
    id: c.id,
    title:
      locale === "vi"
        ? (c.title_vi ?? c.title_ko ?? "")
        : (c.title_ko ?? ""),
    thumb: c.tiktok_thumb,
    url: c.tiktok_url,
  }));

  const caseCards = (cases ?? []).map((c) => ({
    id: c.id,
    title:
      locale === "vi"
        ? (c.title_vi ?? c.title_ko ?? "")
        : (c.title_ko ?? ""),
    category:
      locale === "vi"
        ? (c.category_vi ?? c.category_ko ?? "")
        : (c.category_ko ?? ""),
    thumb: c.tiktok_thumb,
    url: c.tiktok_url,
  }));

  const uniCards: UniversityCard[] = (universities ?? []).map((u) => {
    const uniDepts = (departments ?? [])
      .filter((d) => d.university_id === u.id)
      .map((d) => ({
        id: d.id,
        university_id: d.university_id,
        icon: d.icon ?? "",
        name:
          locale === "vi"
            ? (d.name_vi ?? d.name_ko ?? "")
            : (d.name_ko ?? ""),
        badge: d.badge,
        course: d.course,
        degree_years: d.degree_years,
        tuition:
          locale === "vi"
            ? (d.tuition_vi ?? d.tuition_ko ?? "")
            : (d.tuition_ko ?? ""),
        scholarship:
          locale === "vi"
            ? (d.scholarship_vi ?? d.scholarship_ko ?? "")
            : (d.scholarship_ko ?? ""),
        dept_url: d.dept_url,
      }));
    const tagsRaw = locale === "vi" ? u.tags_vi : u.tags_ko;
    const tags = tagsRaw
      ? tagsRaw.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
    return {
      id: u.id,
      emoji: u.emoji ?? "🎓",
      name: locale === "vi" ? (u.name_vi ?? u.name_ko) : u.name_ko,
      region:
        locale === "vi"
          ? (u.region_vi ?? u.region_ko ?? "")
          : (u.region_ko ?? ""),
      tags,
      strengths: u.strengths ?? "",
      departments: uniDepts,
    };
  });

  const centerCards = (centers ?? []).map((c) => ({
    id: c.id,
    flag: c.flag ?? "🇻🇳",
    name: locale === "vi" ? c.name_vi : (c.name_ko ?? c.name_vi),
    city:
      locale === "vi" ? (c.city_vi ?? c.city_ko ?? "") : (c.city_ko ?? ""),
    desc:
      locale === "vi" ? (c.desc_vi ?? c.desc_ko ?? "") : (c.desc_ko ?? ""),
    students:
      locale === "vi"
        ? (c.students_vi ?? c.students_ko ?? "")
        : (c.students_ko ?? ""),
    years:
      locale === "vi"
        ? (c.years_vi ?? c.years_ko ?? "")
        : (c.years_ko ?? ""),
  }));

  return (
    <>
      <Hero t={t} videos={heroVideos} />
      <Cases t={t} locale={locale} cases={caseCards} />
      <Universities universities={uniCards} strings={ss.universities} />
      <Apply strings={ss.apply} />
      <Recruiting strings={ss.recruiting} />
      <Centers t={t} centers={centerCards} />
      <InsuranceRefund strings={ss.insuranceRefund} />
      <InsuranceInfo strings={ss.insuranceInfo} />
      <FloatingButtons strings={ss.floating} />
      <InsurancePopup strings={ss.insurancePopup} />
    </>
  );
}
