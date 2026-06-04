import Link from "next/link";
import { Building2, DollarSign, FileText, TrendingDown } from "lucide-react";

import { Card } from "@/components/ui/card";

export type StudyB2BStats = {
  /** 이번 달 청구액 (KRW 합) */
  monthBilledAmount: number;
  /** 이번 달 수금액 (KRW 합) */
  monthSettledAmount: number;
  /** 누적 미수금 (sent 상태 - 매칭된 settlement) */
  outstandingAmount: number;
  /** 활성 유학센터 회사 수 */
  activeOrgsCount: number;
  /** draft + sent 인보이스 수 */
  pendingInvoicesCount: number;
};

const fmt = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
      ? `${(n / 1_000).toFixed(0)}K`
      : n.toLocaleString();

export function StudyB2BStatsCards({ stats }: { stats: StudyB2BStats }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Link href="/study-invoices" className="group">
        <Card className="p-4 transition-all hover:border-primary/40 hover:shadow-md">
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <DollarSign className="size-3.5" />
            이번 달 청구
          </div>
          <div className="text-2xl font-bold">{fmt(stats.monthBilledAmount)}</div>
          <div className="text-[10px] text-muted-foreground">KRW</div>
        </Card>
      </Link>

      <Link href="/study-invoices" className="group">
        <Card className="p-4 transition-all hover:border-primary/40 hover:shadow-md">
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <DollarSign className="size-3.5 text-emerald-600" />
            이번 달 수금
          </div>
          <div className="text-2xl font-bold text-emerald-700">
            {fmt(stats.monthSettledAmount)}
          </div>
          <div className="text-[10px] text-muted-foreground">KRW</div>
        </Card>
      </Link>

      <Link href="/study-invoices" className="group">
        <Card className="relative p-4 transition-all hover:border-primary/40 hover:shadow-md">
          {stats.pendingInvoicesCount > 0 ? (
            <span className="absolute right-2 top-2 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-warning px-1.5 text-[10px] font-bold text-white">
              {stats.pendingInvoicesCount}
            </span>
          ) : null}
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <TrendingDown className="size-3.5 text-rose-600" />
            누적 미수금
          </div>
          <div
            className={`text-2xl font-bold ${
              stats.outstandingAmount > 0 ? "text-rose-700" : ""
            }`}
          >
            {fmt(stats.outstandingAmount)}
          </div>
          <div className="text-[10px] text-muted-foreground">KRW</div>
        </Card>
      </Link>

      <Link href="/center-orgs" className="group">
        <Card className="p-4 transition-all hover:border-primary/40 hover:shadow-md">
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Building2 className="size-3.5" />
            활성 유학센터
          </div>
          <div className="text-2xl font-bold">{stats.activeOrgsCount}</div>
          <div className="text-[10px] text-muted-foreground">organizations</div>
        </Card>
      </Link>
    </div>
  );
}
