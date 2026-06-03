/**
 * /admissions/forms — 양식 파일 통합 관리 (B4-12).
 *   모든 대학의 양식을 한 진입점에서 관리.
 *   URL query: ?univ=1 (대학 선택. 기본: 첫 대학)
 *
 * 기존 /universities/[id]/forms 의 코드를 재사용하되, 진입을 모집요강 메뉴 아래로 통합.
 */

import { redirect } from "next/navigation";
import Link from "next/link";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { AdmissionTabs } from "@/components/admission/admission-tabs";
import { Card } from "@/components/ui/card";
import { FormFilesManager } from "@/app/(app)/universities/[id]/forms/forms-manager";

export const dynamic = "force-dynamic";

export default async function AdmissionFormsPage({
  searchParams,
}: {
  searchParams: Promise<{ univ?: string }>;
}) {
  const { univ } = await searchParams;

  // 어드민 인증 확인
  const supabaseUser = await createClient();
  const {
    data: { user },
  } = await supabaseUser.auth.getUser();
  if (!user) redirect("/login?redirect=/admissions/forms");

  // service role 로 데이터 조회
  const supabase = createAdminClient();

  // 모든 대학 목록 (dropdown)
  const { data: universities } = await supabase
    .from("universities")
    .select("id, name_ko")
    .eq("active", true)
    .order("name_ko", { ascending: true });

  const selectedUnivId = univ
    ? Number(univ)
    : (universities?.[0]?.id ?? null);

  // 선택된 대학의 양식 + 학과 + 카탈로그
  type DataTypeRow = {
    key: string;
    label_ko: string;
    category: string;
    is_essay_basis: boolean;
  };
  type FormFileRow = {
    id: string;
    department_name: string | null;
    key: string;
    name_ko: string;
    file_url: string;
    file_name: string;
    size_bytes: number | null;
    uploaded_at: string;
    notes: string | null;
    required_data_type_keys: string[] | null;
    essay_questions: unknown;
  };
  type DeptRow = { id: number; name_ko: string };
  type ArchivedRow = {
    id: string;
    department_name: string | null;
    key: string;
    name_ko: string;
    file_url: string;
    file_name: string;
    uploaded_at: string;
  };

  let depts: DeptRow[] = [];
  let currentFiles: FormFileRow[] = [];
  let archivedFiles: ArchivedRow[] = [];
  let dataTypes: DataTypeRow[] = [];

  if (selectedUnivId != null && Number.isFinite(selectedUnivId)) {
    const [
      { data: deptRows },
      { data: cur },
      { data: arch },
      { data: dt },
    ] = await Promise.all([
      supabase
        .from("departments")
        .select("id, name_ko, active")
        .eq("university_id", selectedUnivId)
        .eq("active", true)
        .order("sort_order"),
      supabase
        .from("study_admission_form_files")
        .select("*")
        .eq("university_id", selectedUnivId)
        .eq("is_current", true)
        .order("department_name", { ascending: true, nullsFirst: true })
        .order("key"),
      supabase
        .from("study_admission_form_files")
        .select("*")
        .eq("university_id", selectedUnivId)
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

    depts = (deptRows ?? []).map((d) => ({ id: d.id, name_ko: d.name_ko }));
    currentFiles = (cur ?? []) as FormFileRow[];
    archivedFiles = (arch ?? []) as ArchivedRow[];
    dataTypes = (dt ?? []) as DataTypeRow[];
  }

  return (
    <>
      <PageHeader
        title="양식 파일"
        description="모든 대학의 입학 양식 통합 관리 — 대학 선택 후 학과별 override 가능"
        breadcrumbs={[
          { label: "모집요강", href: "/admissions" },
          { label: "양식 파일" },
        ]}
      />
      <AdmissionTabs active="forms" />
      <div className="p-6 space-y-4">
        {/* 대학 선택 */}
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">대학교 선택:</span>
            <form method="GET" className="flex items-center gap-2">
              <select
                name="univ"
                defaultValue={selectedUnivId ?? ""}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              >
                {(universities ?? []).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name_ko}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="rounded-md border border-input px-3 py-1.5 text-xs hover:bg-muted"
              >
                전환
              </button>
            </form>
            {selectedUnivId != null ? (
              <Link
                href={`/universities/${selectedUnivId}`}
                className="ml-2 text-xs text-muted-foreground hover:underline"
              >
                ↗ 대학 마스터 데이터 보기
              </Link>
            ) : null}
          </div>
        </Card>

        {selectedUnivId != null && Number.isFinite(selectedUnivId) ? (
          <FormFilesManager
            universityId={selectedUnivId}
            departments={depts}
            dataTypes={dataTypes}
            currentFiles={currentFiles.map((f) => ({
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
            archivedFiles={archivedFiles.map((f) => ({
              id: f.id,
              department_name: f.department_name,
              key: f.key,
              name_ko: f.name_ko,
              file_url: f.file_url,
              file_name: f.file_name,
              uploaded_at: f.uploaded_at,
            }))}
          />
        ) : (
          <Card className="p-12 text-center">
            <p className="text-sm text-muted-foreground">
              등록된 대학교가 없습니다.{" "}
              <Link
                href="/universities/new"
                className="text-primary hover:underline"
              >
                대학교 추가
              </Link>{" "}
              먼저.
            </p>
          </Card>
        )}
      </div>
    </>
  );
}
