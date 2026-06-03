/**
 * /admissions/new — 모집요강 신규 등록.
 *   B2-3B: PDF 업로드 + AI 추출 + ExtractResult JSON 표시.
 *   후속(B2-3C): 결과 → 폼 자동 채움 + 검수.
 *   후속(B2-3D): 승인 → study_admission_specs INSERT.
 */

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";

import { ExtractForm, type UniversityOption } from "./extract-form";

export const dynamic = "force-dynamic";

export default async function NewAdmissionPage() {
  const supabase = await createClient();

  const { data: universities, error } = await supabase
    .from("universities")
    .select("id, name_ko, name_vi")
    .eq("active", true)
    .order("name_ko", { ascending: true });

  return (
    <>
      <PageHeader
        title="모집요강 추가"
        description="PDF 업로드 + Claude Sonnet vision 자동 추출 + 검수"
        breadcrumbs={[
          { label: "모집요강", href: "/admissions" },
          { label: "추가" },
        ]}
      />
      <div className="p-6">
        {error ? (
          <Card className="p-6 text-sm text-destructive">
            대학 목록을 불러오지 못했습니다: {error.message}
          </Card>
        ) : (
          <ExtractForm
            universities={(universities ?? []) as UniversityOption[]}
          />
        )}
      </div>
    </>
  );
}
