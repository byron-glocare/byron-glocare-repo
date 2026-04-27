import Link from "next/link";

import { LocaleSwitch } from "@/components/locale-switch";
import { getDict, getLocale } from "@/lib/i18n";

export async function SiteHeader() {
  const locale = await getLocale();
  const t = await getDict();

  return (
    <header className="sticky top-0 z-30 border-b border-border/40 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
        <Link href="/" className="font-bold text-lg">
          GLOCARE
        </Link>
        <nav className="hidden md:flex items-center gap-5 text-sm">
          <Link href="/" className="hover:text-primary transition-colors">
            {t["nav.home"]}
          </Link>
          <Link
            href="/universities"
            className="hover:text-primary transition-colors"
          >
            {t["nav.universities"]}
          </Link>
          <Link href="/cases" className="hover:text-primary transition-colors">
            {t["nav.cases"]}
          </Link>
          <Link
            href="/centers"
            className="hover:text-primary transition-colors"
          >
            {t["nav.centers"]}
          </Link>
          <Link href="/about" className="hover:text-primary transition-colors">
            {t["nav.about"]}
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <LocaleSwitch current={locale} />
          <Link
            href="/apply"
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {t["nav.apply"]}
          </Link>
        </div>
      </div>
    </header>
  );
}
