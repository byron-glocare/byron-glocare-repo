import Link from "next/link";
import { Building2, Home, Search } from "lucide-react";

import { requireCeo } from "@/lib/ceo/guard";
import { loadFindingCustomers, type FindingCustomer } from "@/lib/ceo/findings";

export const dynamic = "force-dynamic";

/**
 * 대표님 홈.
 *   위: 교육원 등록 / 요양원 등록 (크게)
 *   아래: 교육원 검색 / 요양원 검색 (작게)
 *   맨 아래: 교육원 발굴 필요 / 요양원 발굴 필요 리스트
 */
export default async function CeoHomePage() {
  const { admin } = await requireCeo();
  const [centerFindings, homeFindings] = await Promise.all([
    loadFindingCustomers(admin, "training_center"),
    loadFindingCustomers(admin, "care_home"),
  ]);

  return (
    <div className="space-y-5">
      {/* 등록 — 크게, 좌우 */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/ceo/centers/new"
          className="flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card py-8 text-center shadow-sm active:scale-[0.98]"
        >
          <Building2 className="size-8 text-primary" />
          <span className="text-base font-semibold">교육원 등록</span>
        </Link>
        <Link
          href="/ceo/homes/new"
          className="flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card py-8 text-center shadow-sm active:scale-[0.98]"
        >
          <Home className="size-8 text-primary" />
          <span className="text-base font-semibold">요양원 등록</span>
        </Link>
      </div>

      {/* 검색 — 작게, 좌우 */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/ceo/centers"
          className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background py-3 text-sm font-medium text-muted-foreground active:scale-[0.98]"
        >
          <Search className="size-4" />
          교육원 검색
        </Link>
        <Link
          href="/ceo/homes"
          className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background py-3 text-sm font-medium text-muted-foreground active:scale-[0.98]"
        >
          <Search className="size-4" />
          요양원 검색
        </Link>
      </div>

      <FindingSection title="교육원 발굴 필요" customers={centerFindings} />
      <FindingSection title="요양원 발굴 필요" customers={homeFindings} />
    </div>
  );
}

function FindingSection({
  title,
  customers,
}: {
  title: string;
  customers: FindingCustomer[];
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="text-xs text-muted-foreground">{customers.length}명</span>
      </div>
      {customers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          발굴 필요 고객이 없습니다.
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {customers.map((c) => {
            const name =
              [c.name_vi, c.name_kr].filter(Boolean).join(" / ") || "(이름 없음)";
            return (
              <li key={c.id} className="px-3 py-2.5">
                <div className="truncate text-sm font-medium">{name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {c.desired_region || "희망지역 미입력"}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
