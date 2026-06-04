/**
 * /universities/[id]/forms — 대학교 양식 파일 관리 (B4-1).
 *   대학 단위 + 학과별 override + 버전 관리.
 *
 * 운영자가 .hwp / .pdf / .docx 양식 업로드 → Supabase Storage 저장 → URL DB 기록.
 * 같은 (대학, 학과, 양식종류) 의 새 업로드는 이전 row 를 is_current=false 로 archive.
 */

import { notFound } from "next/navigation";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { FormFilesManager } from "./forms-manager";

export const dynamic = "force-dynamic";

export default async function UniversityFormFilesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) notFound();

  const supabaseUser = await createClient();
  const {
    data: { user },
  } = await supabaseUser.auth.getUser();
  if (!user) notFound();
  const supabase = createAdminClient();

  const [
    { data: uni },
    { data: depts },
    { data: currentFiles },
    { data: archivedFiles },
    { data: dataTypes },
  ] = await Promise.all([
    supabase
      .from("universities")
      .select("id, name_ko, name_vi")
      .eq("id", numericId)
      .maybeSingle(),
    supabase
      .from("departments")
      .select("id, name_ko, active")
      .eq("university_id", numericId)
      .eq("active", true)
      .order("sort_order"),
    supabase
      .from("study_admission_form_files")
      .select("*")
      .eq("university_id", numericId)
      .eq("is_current", true)
      .order("department_name", { ascending: true, nullsFirst: true })
      .order("key"),
    supabase
      .from("study_admission_form_files")
      .select("*")
      .eq("university_id", numericId)
      .eq("is_current", false)
      .order("uploaded_at", { ascending: false })
      .limit(50),
    supabase
      .from("study_student_data_types")
      .select("key, label_ko, category, is_essay_basis")
      .eq("is_active", true)
      .order("category")
      .order("sort_order"),
  ]);

  if (!uni) notFound();

  return (
    <>
      <PageHeader
        title={`${uni.name_ko} — 양식 파일`}
        description="입학원서·자기소개서·학업계획서 등 양식 파일 관리"
        breadcrumbs={[
          { label: "대학교", href: "/universities" },
          { label: uni.name_ko, href: `/universities/${numericId}` },
          { label: "양식 파일" },
        ]}
      />
      <div className="p-6">
        <FormFilesManager
          universityId={numericId}
          departments={(depts ?? []).map((d) => ({
            id: d.id,
            name_ko: d.name_ko,
          }))}
          dataTypes={(dataTypes ?? []).map((d) => ({
            key: d.key,
            label_ko: d.label_ko,
            category: d.category,
            is_essay_basis: d.is_essay_basis,
          }))}
          currentFiles={(currentFiles ?? []).map((f) => ({
            id: f.id,
            department_name: f.department_name,
            key: f.key,
            name_ko: f.name_ko,
            file_url: f.file_url,
            file_name: f.file_name,
            size_bytes: f.size_bytes,
            uploaded_at: f.uploaded_at,
            notes: f.notes,
            required_data_type_keys: f.required_data_type_keys ?? [],
            essay_questions_count: Array.isArray(f.essay_questions)
              ? f.essay_questions.length
              : 0,
          }))}
          archivedFiles={(archivedFiles ?? []).map((f) => ({
            id: f.id,
            department_name: f.department_name,
            key: f.key,
            name_ko: f.name_ko,
            file_url: f.file_url,
            file_name: f.file_name,
            uploaded_at: f.uploaded_at,
          }))}
        />
      </div>
    </>
  );
}
