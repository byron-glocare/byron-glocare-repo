/**
 * /admissions/[id]/edit — 모집요강 편집.
 *   메타 6필드 + 7 JSON 영역 textarea + status 변경 + UPDATE.
 *   승인(approved) status 로 변경 시 approved_by/at 자동 stamping.
 */

import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
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

  const [{ data: spec }, { data: universities }] = await Promise.all([
    supabase.from("study_admission_specs").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("universities")
      .select("id, name_ko")
      .eq("active", true)
      .order("name_ko", { ascending: true }),
  ]);

  if (!spec) notFound();

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
        />
      </div>
    </>
  );
}
