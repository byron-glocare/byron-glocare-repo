import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { TrainingCenterForm } from "@/components/training-center-form";
import { TrainingClassesManager } from "@/components/training-classes-manager";
import {
  CustomerListPanel,
  type CustomerListFilters,
} from "@/components/customer-list-panel";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

const VALID_TABS = ["basic", "students"] as const;
type TabKey = (typeof VALID_TABS)[number];

type SearchParams = CustomerListFilters & { tab?: string };

export default async function TrainingCenterDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const tab: TabKey = VALID_TABS.includes(sp.tab as TabKey)
    ? (sp.tab as TabKey)
    : "basic";

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

  return (
    <>
      <PageHeader
        title={center.name}
        breadcrumbs={[
          { href: "/training-centers", label: "교육원" },
          { label: center.name },
        ]}
        description={
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <Badge variant="outline" className="font-mono text-xs">
              {center.code}
            </Badge>
            {center.region && (
              <span className="text-xs text-muted-foreground">
                · {center.region}
              </span>
            )}
            {center.contract_active && (
              <Badge className="bg-success/10 text-success border-success/20 text-xs">
                계약 ON
              </Badge>
            )}
          </div>
        }
      />
      <div className="p-6">
        <Tabs defaultValue={tab} className="w-full">
          <TabsList className="grid grid-cols-2 w-full h-10">
            <TabsTrigger
              value="basic"
              className="text-sm data-active:bg-primary data-active:text-primary-foreground data-active:font-semibold"
            >
              기본 정보
            </TabsTrigger>
            <TabsTrigger
              value="students"
              className="text-sm data-active:bg-primary data-active:text-primary-foreground data-active:font-semibold"
            >
              소속 교육생
            </TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="mt-6">
            <TrainingCenterForm
              mode="edit"
              centerId={center.id}
              defaultValues={center}
              extraContent={
                <TrainingClassesManager
                  centerId={center.id}
                  classes={classes ?? []}
                />
              }
            />
          </TabsContent>

          <TabsContent value="students" className="mt-6">
            <CustomerListPanel
              filters={sp}
              basePath={`/training-centers/${center.id}`}
              preservedParams={{ tab: "students" }}
              fixed={{ trainingCenterId: center.id }}
            />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
