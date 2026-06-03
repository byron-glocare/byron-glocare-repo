/**
 * 모집요강 섹션 서브탭.
 *   대학교 메뉴(마스터 데이터: 대학·학과 추가/편집)와 역할을 분리하고,
 *   모집요강 관리 + 양식 파일 관리를 한 섹션으로 묶는다.
 */

import Link from "next/link";

const TABS = [
  { key: "specs", href: "/admissions", label: "모집요강" },
  { key: "forms", href: "/admissions/forms", label: "양식 파일" },
] as const;

export function AdmissionTabs({ active }: { active: "specs" | "forms" }) {
  return (
    <div className="border-b border-border bg-card px-6">
      <nav className="flex items-center gap-1">
        {TABS.map((t) => {
          const isActive = t.key === active;
          return (
            <Link
              key={t.key}
              href={t.href}
              className={`-mb-px border-b-2 px-3 py-2.5 text-sm transition-colors ${
                isActive
                  ? "border-primary font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
