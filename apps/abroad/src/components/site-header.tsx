import { SiteNav } from "@/components/site-nav";
import { getDictByLocale, type Locale } from "@/lib/i18n";

export function SiteHeader({ locale }: { locale: Locale }) {
  const t = getDictByLocale(locale);

  return (
    <SiteNav
      locale={locale}
      strings={{
        cases: t["nav.cases"],
        applySection: t["nav.applySection"],
        universities: t["nav.universities"],
        recruiting: t["nav.recruiting"],
        centers: t["nav.centers"],
        about: t["nav.about"],
        student: t["nav.student"],
        studentShort: t["nav.student.short"],
      }}
    />
  );
}
