/**
 * /admissions/forms/[formFileId] — [작성서류] 상세.
 *   제목=서류명, 부제목=대학교명.
 *   기본정보(서류명·대학·적용학과·적용학기·업로드일·다운로드) + 상세정보(양식종류·필요데이터)
 *   + 미리보기 + 다운로드(원본 / AI 빈양식).
 *
 *   위치는 입학서류 메뉴지만 대학교 상세에서도 링크로 접근.
 *   (빈상태 업로드·파일교체 3버튼·AI 원본모사 빈양식은 후속 증분.)
 */

import { notFound, redirect } from "next/navigation";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { FormDocDetail } from "./form-doc-detail";

export const dynamic = "force-dynamic";

export default async function FormDocDetailPage({
  params,
}: {
  params: Promise<{ formFileId: string }>;
}) {
  const { formFileId } = await params;

  const supabaseUser = await createClient();
  const {
    data: { user },
  } = await supabaseUser.auth.getUser();
  if (!user) redirect(`/login?redirect=/admissions/forms/${formFileId}`);

  const supabase = createAdminClient();

  const { data: form } = await supabase
    .from("study_admission_form_files")
    .select(
      "id, university_id, key, name_ko, file_url, file_name, notes, uploaded_at, is_current, department_name, required_data_type_keys, applies_to_terms, applies_to_department_ids"
    )
    .eq("id", formFileId)
    .maybeSingle();
  if (!form) notFound();

  const [{ data: uni }, { data: depts }, { data: specs }, { data: catalogRows }] =
    await Promise.all([
      supabase
        .from("universities")
        .select("id, name_ko")
        .eq("id", form.university_id)
        .maybeSingle(),
      supabase
        .from("departments")
        .select("id, name_ko, active")
        .eq("university_id", form.university_id)
        .order("sort_order"),
      supabase
        .from("study_admission_specs")
        .select("required_documents, status, updated_at")
        .eq("university_id", form.university_id)
        .order("updated_at", { ascending: false }),
      supabase
        .from("study_student_data_types")
        .select("key, label_ko, category")
        .eq("is_active", true)
        .order("category")
        .order("sort_order"),
    ]);

  // 서류명 후보 = 최신 모집요강(승인 우선)의 required_documents 이름들
  const repSpec =
    (specs ?? []).find((s) => s.status === "approved") ?? (specs ?? [])[0];
  const docNameOptions = (() => {
    const out = new Set<string>();
    const reqs = Array.isArray(repSpec?.required_documents)
      ? (repSpec!.required_documents as Array<{ name_ko?: string }>)
      : [];
    for (const r of reqs) if (r?.name_ko) out.add(r.name_ko);
    return Array.from(out);
  })();

  return (
    <>
      <PageHeader
        title={form.name_ko || "작성서류"}
        description={uni?.name_ko ?? `대학 #${form.university_id}`}
        breadcrumbs={[
          { href: "/admissions", label: "입학서류" },
          { label: form.name_ko || "작성서류" },
        ]}
      />
      <div className="p-6">
        <FormDocDetail
          form={{
            id: form.id,
            university_id: form.university_id,
            university_name: uni?.name_ko ?? `대학 #${form.university_id}`,
            key: form.key,
            name_ko: form.name_ko,
            file_url: form.file_url,
            file_name: form.file_name,
            department_name: form.department_name,
            notes: form.notes,
            uploaded_at: form.uploaded_at,
            required_data_type_keys: form.required_data_type_keys ?? [],
            applies_to_terms: form.applies_to_terms ?? [],
            applies_to_department_ids: form.applies_to_department_ids ?? [],
          }}
          departments={(depts ?? []).map((d) => ({
            id: d.id,
            name_ko: d.name_ko,
            active: d.active,
          }))}
          docNameOptions={docNameOptions}
          catalog={(catalogRows ?? []).map((c) => ({
            key: c.key,
            label_ko: c.label_ko,
            category: c.category,
          }))}
        />
      </div>
    </>
  );
}
