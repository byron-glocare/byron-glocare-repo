import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { OfferingsManager } from "./offerings-manager";

export const dynamic = "force-dynamic";

export default async function OfferingsPage() {
  const supabase = await createClient();

  const [
    { data: universities },
    { data: departments },
    { data: specs },
    { data: offerings, error },
  ] = await Promise.all([
    supabase
      .from("universities")
      .select("id, name_ko")
      .order("name_ko", { ascending: true }),
    supabase
      .from("departments")
      .select("id, university_id, name_ko, active")
      .order("sort_order", { ascending: true }),
    supabase
      .from("study_admission_specs")
      .select("id, university_id, term, status")
      .order("term", { ascending: false }),
    supabase
      .from("study_offerings")
      .select(
        "id, university_id, department_id, term, intake_quota, status, source_spec_id, sort_order, notes"
      )
      .order("created_at", { ascending: false }),
  ]);

  return (
    <>
      <PageHeader
        title="모집"
        description="현재 유학센터 및 학생들이 지원할 수 있는 대학/학과/학기를 설정"
        breadcrumbs={[{ label: "모집" }]}
      />
      <div className="p-6">
        {error ? (
          <Card className="p-6 text-sm text-destructive">
            데이터를 불러오지 못했습니다: {error.message}
          </Card>
        ) : (
          <OfferingsManager
            universities={universities ?? []}
            departments={(departments ?? []).filter((d) => d.active)}
            specs={specs ?? []}
            offerings={offerings ?? []}
          />
        )}
      </div>
    </>
  );
}
