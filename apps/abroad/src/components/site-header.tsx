import { LangBar } from "@/components/lang-bar";
import { SiteNav } from "@/components/site-nav";
import { getDictByLocale, type Locale } from "@/lib/i18n";

export function SiteHeader({ locale }: { locale: Locale }) {
  const t = getDictByLocale(locale);

  return (
    <>
      <LangBar locale={locale} />
      <SiteNav
        strings={{
          cases: t["nav.cases"],
          universities: t["nav.universities"],
          recruiting: t["nav.recruiting"],
          centers: t["nav.centers"],
          insurance: t["nav.insurance"],
          about: t["nav.about"],
          apply: t["nav.apply"],
        }}
      />
    </>
  );
}
