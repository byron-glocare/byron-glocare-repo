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

export default async function NewAdmissionPage({
  searchParams,
}: {
  searchParams: Promise<{ university_id?: string }>;
}) {
  const { university_id } = await searchParams;
  const supabase = await createClient();

  const [{ data: universities, error }, { data: docTypes }] = await Promise.all([
    supabase
      .from("universities")
      .select("id, name_ko, name_vi")
      .eq("active", true)
      .order("name_ko", { ascending: true }),
    supabase
      .from("study_student_data_types")
      .select("key, label_ko")
      .eq("is_active", true)
      .eq("category", "document")
      .order("sort_order"),
  ]);

  // 대학교 상세에서 진입 시 해당 대학 자동완성
  const presetId = university_id ? Number(university_id) : null;
  const defaultUniversityNameKo =
    presetId != null && Number.isFinite(presetId)
      ? ((universities ?? []).find((u) => u.id === presetId)?.name_ko ?? "")
      : "";

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
            defaultUniversityNameKo={defaultUniversityNameKo}
            docTypes={docTypes ?? []}
          />
        )}
      </div>
    </>
  );
}
