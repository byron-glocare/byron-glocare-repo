import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  GraduationCap,
  Hospital,
  MessageSquare,
  Phone,
  Receipt,
  Search,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { TaskBucket } from "@/lib/dashboard";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const ICONS: Record<TaskBucket["key"], LucideIcon> = {
  center_finding: Search,
  center_matching: GraduationCap,
  class_matching: Calendar,
  reservation_payment: Receipt,
  intro_sms: MessageSquare,
  care_home_finding: Hospital,
  visa_change: AlertCircle,
  recontact_needed: Phone,
};

const ACCENT: Record<TaskBucket["key"], string> = {
  center_finding: "bg-info/10 text-info",
  center_matching: "bg-info/10 text-info",
  class_matching: "bg-info/10 text-info",
  reservation_payment: "bg-warning/10 text-warning",
  intro_sms: "bg-warning/10 text-warning",
  care_home_finding: "bg-info/10 text-info",
  visa_change: "bg-warning/10 text-warning",
  recontact_needed: "bg-destructive/10 text-destructive",
};

export function TaskCards({ buckets }: { buckets: TaskBucket[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {buckets.map((b) => (
        <TaskCard key={b.key} bucket={b} />
      ))}
    </div>
  );
}

function TaskCard({ bucket }: { bucket: TaskBucket }) {
  const Icon = ICONS[bucket.key];
  const accent = ACCENT[bucket.key];
  const previewCount = 3;
  const preview = bucket.customers.slice(0, previewCount);
  const href = hrefFor(bucket.key);

  return (
    <Link href={href} className="block">
      <Card className="transition-colors hover:border-primary/50 hover:bg-accent/30 h-full">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className={`size-8 rounded-md ${accent} flex items-center justify-center`}>
              <Icon className="size-4" />
            </div>
            <ArrowRight className="size-3 text-muted-foreground" />
          </div>
          <CardTitle className="text-sm text-muted-foreground font-normal mt-2">
            {bucket.label}
          </CardTitle>
          <div className="text-2xl font-semibold">{bucket.count}</div>
        </CardHeader>
        {preview.length > 0 && (
          <CardContent className="pt-0 space-y-1">
            {preview.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-1 text-xs text-muted-foreground truncate"
              >
                <Users className="size-3 shrink-0" />
                <span className="truncate">
                  {c.name_vi || c.name_kr || c.code}
                </span>
              </div>
            ))}
            {bucket.customers.length > previewCount && (
              <Badge variant="outline" className="text-xs">
                외 {bucket.customers.length - previewCount}명
              </Badge>
            )}
          </CardContent>
        )}
      </Card>
    </Link>
  );
}

function hrefFor(key: TaskBucket["key"]): string {
  // 필터가 Phase 5 에서 교육원/요양원만 구현되어 있어, 일단 목록으로 이동.
  // 추후 각 버킷 전용 필터 파라미터로 딥링크 가능.
  switch (key) {
    case "center_finding":
    case "center_matching":
    case "class_matching":
    case "reservation_payment":
    case "intro_sms":
    case "care_home_finding":
    case "visa_change":
    case "recontact_needed":
    default:
      return "/customers";
  }
}
