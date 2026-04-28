import { Hero } from "@/components/sections/hero";
import { createClient } from "@/lib/supabase/server";
import { getDict, getLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();
  const t = await getDict();
  const locale = await getLocale();

  const [{ data: heroCases }] = await Promise.all([
    supabase
      .from("study_cases")
      .select("id, title_ko, title_vi, tiktok_thumb, tiktok_url, hero")
      .eq("hero", true)
      .limit(3),
  ]);

  const heroVideos = (heroCases ?? []).map((c) => ({
    id: c.id,
    title: locale === "vi" ? (c.title_vi ?? c.title_ko ?? "") : (c.title_ko ?? ""),
    thumb: c.tiktok_thumb,
    url: c.tiktok_url,
  }));

  return (
    <>
      <Hero t={t} videos={heroVideos} />
      {/* TODO: 다음 섹션 변환 — cases / universities / apply / recruiting / centers / insurance-refund / insurance-info */}
    </>
  );
}
