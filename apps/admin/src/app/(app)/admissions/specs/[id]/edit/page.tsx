/**
 * /admissions/[id]/edit — 모집요강 편집.
 *   메타 6필드 + 7 JSON 영역 textarea + status 변경 + UPDATE.
 *   승인(approved) status 로 변경 시 approved_by/at 자동 stamping.
 */

import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { loadFormDocKeys } from "@/lib/admission/form-doc-keys";
import { loadDocCatalog, loadSpecDocItemRows, splitLegacyDocs, type LegacyDoc } from "@/lib/admission/spec-doc-items";
import { PageHeader } from "@/components/page-header";

import {
  EditSpecForm,
  type EditableSpec,
  type UniversityOption,
} from "./edit-form";

export const dynamic = "force-dynamic";

export default async function EditAdmissionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: spec }, { data: universities }, { data: docTypes }] =
    await Promise.all([
      supabase.from("study_admission_specs").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("universities")
        .select("id, name_ko")
        .eq("active", true)
        .order("name_ko", { ascending: true }),
      supabase
        .from("study_student_data_types")
        .select("key, label_ko, label_vi, aliases, is_form_doc")
        .eq("is_active", true)
        .eq("category", "document")
        .order("sort_order"),
    ]);

  if (!spec) notFound();

  // 제출서류 정본은 요강↔항목 행. 옛 JSONB 는 작성서류·미연결 줄만 옛 필드로 보낸다.
  const [docItemRows, docCatalog, formDocKeys] = await Promise.all([
    loadSpecDocItemRows(supabase, id),
    loadDocCatalog(supabase),
    loadFormDocKeys(supabase),
  ]);
  const legacyAll = (Array.isArray(spec.required_documents) ? spec.required_documents : []) as LegacyDoc[];
  const { keep: legacyDocs } = splitLegacyDocs(legacyAll, formDocKeys);
  // 옛 필드의 "서류 종류" 선택지: 작성서류(데이터 탭) + 발급서류(서류 카탈로그)
  const docTypesMerged = [
    ...(docTypes ?? []).filter((t) => t.is_form_doc),
    ...docCatalog.standards
      .filter((s) => s.is_active)
      .map((s) => ({ key: s.key, label_ko: s.name_ko, label_vi: s.name_vi, aliases: [] as string[], is_form_doc: false })),
  ];

  return (
    <>
      <PageHeader
        title="모집요강 편집"
        description="메타 정보 + 7 JSON 영역 + 상태"
        breadcrumbs={[
          { label: "입학서류", href: "/admissions" },
          {
            label: spec.admission_category ?? "상세",
            href: `/admissions/specs/${id}`,
          },
          { label: "편집" },
        ]}
      />
      <div className="p-6">
        <EditSpecForm
          spec={spec as EditableSpec}
          universities={(universities ?? []) as UniversityOption[]}
          docTypes={docTypesMerged}
          docItemRows={docItemRows}
          docCatalog={docCatalog}
          legacyDocs={legacyDocs as never}
        />
      </div>
    </>
  );
}
