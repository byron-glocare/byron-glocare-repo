import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { CareHomeForm } from "@/components/care-home-form";
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

export default async function CareHomeDetailPage({
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

  const { data: home, error } = await supabase
    .from("care_homes")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !home) notFound();

  return (
    <>
      <PageHeader
        title={home.name}
        breadcrumbs={[
          { href: "/care-homes", label: "요양원" },
          { label: home.name },
        ]}
        description={
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <Badge variant="outline" className="font-mono text-xs">
              {home.code}
            </Badge>
            {home.region && (
              <span className="text-xs text-muted-foreground">
                · {home.region}
              </span>
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
            <CareHomeForm mode="edit" homeId={home.id} defaultValues={home} />
          </TabsContent>

          <TabsContent value="students" className="mt-6">
            <CustomerListPanel
              filters={sp}
              basePath={`/care-homes/${home.id}`}
              preservedParams={{ tab: "students" }}
              fixed={{ careHomeId: home.id }}
            />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
