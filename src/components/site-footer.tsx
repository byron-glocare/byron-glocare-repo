import Link from "next/link";

import { getDict } from "@/lib/i18n";

export async function SiteFooter() {
  const t = await getDict();
  return (
    <footer className="border-t border-border/40 mt-12">
      <div className="mx-auto max-w-6xl px-4 py-8 grid gap-6 md:grid-cols-3 text-sm text-muted-foreground">
        <div>
          <div className="font-bold text-foreground mb-2">GLOCARE</div>
          <p className="leading-relaxed">
            Du học Hàn Quốc · 베트남 학생 한국 유학
          </p>
        </div>
        <div>
          <div className="font-medium text-foreground mb-2">
            {t["nav.universities"]} · {t["nav.cases"]} · {t["nav.centers"]}
          </div>
          <ul className="space-y-1">
            <li>
              <Link href="/universities" className="hover:text-primary">
                {t["nav.universities"]}
              </Link>
            </li>
            <li>
              <Link href="/cases" className="hover:text-primary">
                {t["nav.cases"]}
              </Link>
            </li>
            <li>
              <Link href="/centers" className="hover:text-primary">
                {t["nav.centers"]}
              </Link>
            </li>
            <li>
              <Link href="/insurance" className="hover:text-primary">
                {t["nav.insurance"]}
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <div className="font-medium text-foreground mb-2">Contact</div>
          <p>
            <a href="mailto:help@glocare.co.kr" className="hover:text-primary">
              help@glocare.co.kr
            </a>
          </p>
        </div>
      </div>
      <div className="border-t border-border/40 px-4 py-4 text-xs text-muted-foreground/70 text-center">
        © {new Date().getFullYear()} Glocare. All rights reserved.
      </div>
    </footer>
  );
}
