import Link from "next/link";
import { Building2, Home, Search } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * 대표님 홈.
 *   위: 교육원 등록 / 요양원 등록 (크게)
 *   아래: 교육원 검색 / 요양원 검색 (작게)
 *   맨 아래: 교육원 발굴 필요 / 요양원 발굴 필요 리스트 (Phase 1 에서 데이터 연결)
 */
export default function CeoHomePage() {
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

      {/* 발굴 필요 리스트 자리 (Phase 1) */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">교육원 발굴 필요</h2>
        <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          곧 표시됩니다.
        </div>
      </section>
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">요양원 발굴 필요</h2>
        <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          곧 표시됩니다.
        </div>
      </section>
    </div>
  );
}
