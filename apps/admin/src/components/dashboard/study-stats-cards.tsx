import Link from "next/link";
import {
  BookOpen,
  Building2,
  Film,
  type LucideIcon,
  MessageCircle,
  School,
  ShieldCheck,
} from "lucide-react";

import { Card } from "@/components/ui/card";

type Stat = {
  href: string;
  label: string;
  icon: LucideIcon;
  count: number;
  /** 처리 대기 수 (있으면 우측 상단에 표시) */
  pending?: number;
};

export function StudyStatsCards({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {stats.map((s) => {
        const Icon = s.icon;
        return (
          <Link key={s.href} href={s.href} className="group">
            <Card className="p-4 hover:border-primary/40 hover:shadow-md transition-all relative">
              {s.pending != null && s.pending > 0 && (
                <span className="absolute top-2 right-2 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-warning text-[10px] font-bold text-white">
                  {s.pending}
                </span>
              )}
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <Icon className="size-3.5" />
                {s.label}
              </div>
              <div className="text-2xl font-bold">
                {s.count.toLocaleString()}
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}

export const STUDY_STAT_ICONS = {
  School,
  BookOpen,
  Building2,
  Film,
  MessageCircle,
  ShieldCheck,
} as const;
