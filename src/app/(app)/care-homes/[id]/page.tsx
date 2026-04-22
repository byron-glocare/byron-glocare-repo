import Link from "next/link";
import { notFound } from "next/navigation";
import { Users } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { CareHomeForm } from "@/components/care-home-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CareHomeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: home, error } = await supabase
    .from("care_homes")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !home) notFound();

  // 매칭된 교육생 — 단계별 분류
  const { data: customers } = await supabase
    .from("customers")
    .select(
      "id, code, name_kr, name_vi, interview_date, work_start_date, work_end_date, visa_change_date"
    )
    .eq("care_home_id", id)
    .order("created_at", { ascending: false });

  // 분류 (KST 기준 today)
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const interviewing: CustomerRow[] = [];
  const working: CustomerRow[] = [];
  const completed: CustomerRow[] = [];

  for (const c of customers ?? []) {
    if (c.work_end_date) {
      completed.push(c);
    } else if (c.work_start_date && c.work_start_date <= today) {
      working.push(c);
    } else {
      interviewing.push(c);
    }
  }

  return (
    <>
      <PageHeader
        title={home.name}
        description={home.code ? `코드: ${home.code}` : undefined}
        breadcrumbs={[
          { href: "/care-homes", label: "요양원" },
          { label: home.name },
        ]}
      />
      <div className="p-6 space-y-6">
        <CareHomeForm mode="edit" homeId={home.id} defaultValues={home} />

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="size-4" />
              매칭된 교육생 ({customers?.length ?? 0}명)
            </CardTitle>
            <CardDescription>
              근무 일자를 기준으로 면접/근무중/근무종료로 분류됩니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <CustomerGroup label="면접/취업 대기" badge="info" customers={interviewing} />
            <CustomerGroup label="근무 중" badge="success" customers={working} />
            <CustomerGroup label="근무 종료" badge="muted" customers={completed} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

type CustomerRow = {
  id: string;
  code: string;
  name_kr: string | null;
  name_vi: string | null;
  interview_date: string | null;
  work_start_date: string | null;
  work_end_date: string | null;
};

function CustomerGroup({
  label,
  badge,
  customers,
}: {
  label: string;
  badge: "info" | "success" | "muted";
  customers: CustomerRow[];
}) {
  if (customers.length === 0) return null;

  const className =
    badge === "info"
      ? "bg-info/10 text-info border-info/20"
      : badge === "success"
        ? "bg-success/10 text-success border-success/20"
        : "bg-muted text-muted-foreground border-border";

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-sm font-medium">{label}</h3>
        <Badge variant="outline" className={className}>
          {customers.length}명
        </Badge>
      </div>
      <ul className="grid sm:grid-cols-2 gap-2">
        {customers.map((c) => (
          <li
            key={c.id}
            className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2"
          >
            <Link
              href={`/customers/${c.id}`}
              className="flex-1 min-w-0 hover:text-primary"
            >
              <div className="text-sm font-medium truncate">
                {c.name_kr || c.name_vi || "(이름 없음)"}
              </div>
              <div className="text-xs text-muted-foreground font-mono">{c.code}</div>
            </Link>
            <div className="text-xs text-muted-foreground shrink-0 text-right">
              {c.work_end_date
                ? `종료 ${formatDate(c.work_end_date)}`
                : c.work_start_date
                  ? `시작 ${formatDate(c.work_start_date)}`
                  : c.interview_date
                    ? `면접 ${formatDate(c.interview_date)}`
                    : ""}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
