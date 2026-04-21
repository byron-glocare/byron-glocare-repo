import Link from "next/link";
import { notFound } from "next/navigation";
import { Users } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { TrainingCenterForm } from "@/components/training-center-form";
import { TrainingClassesManager } from "@/components/training-classes-manager";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function TrainingCenterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: center, error } = await supabase
    .from("training_centers")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !center) notFound();

  const { data: classes } = await supabase
    .from("training_classes")
    .select("*")
    .eq("training_center_id", id);

  const { data: customers } = await supabase
    .from("customers")
    .select("id, code, name_kr, name_vi, phone, class_start_date, legacy_status")
    .eq("training_center_id", id)
    .order("created_at", { ascending: false });

  return (
    <>
      <PageHeader
        title={center.name}
        description={center.code ? `코드: ${center.code}` : undefined}
        breadcrumbs={[
          { href: "/training-centers", label: "교육원" },
          { label: center.name },
        ]}
      />
      <div className="p-6 space-y-6">
        <TrainingCenterForm
          mode="edit"
          centerId={center.id}
          defaultValues={center}
        />

        <TrainingClassesManager centerId={center.id} classes={classes ?? []} />

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="size-4" />
              소속 교육생 ({customers?.length ?? 0}명)
            </CardTitle>
            <CardDescription>
              이 교육원과 매칭된 교육생 목록입니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!customers || customers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border rounded-md">
                매칭된 교육생이 없습니다.
              </p>
            ) : (
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
                      <div className="text-xs text-muted-foreground font-mono">
                        {c.code}
                      </div>
                    </Link>
                    {c.legacy_status && (
                      <Badge variant="outline" className="text-xs shrink-0">
                        {c.legacy_status}
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
