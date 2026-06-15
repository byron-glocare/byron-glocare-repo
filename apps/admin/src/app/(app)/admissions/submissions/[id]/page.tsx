/**
 * /admissions/submissions/[id] — [발급 서류] 상세.
 *   샘플 이미지 + 상세정보(텍스트, 발급요건). 공용(university_id NULL) 또는 대학별.
 *   표준데이터 '발급 서류'(document 분류)와 1:1 매핑.
 *   학기 무관 — 최신 1개만 관리.
 *
 *   (대학별 신규 생성 시 공용 자동완성 흐름은 후속 증분.)
 */

import { notFound, redirect } from "next/navigation";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { SubmissionDocDetail } from "./submission-doc-detail";

export const dynamic = "force-dynamic";

export default async function SubmissionDocDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabaseUser = await createClient();
  const {
    data: { user },
  } = await supabaseUser.auth.getUser();
  if (!user) redirect(`/login?redirect=/admissions/submissions/${id}`);

  const supabase = createAdminClient();

  const { data: sub } = await supabase
    .from("study_required_submissions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!sub) notFound();

  const [{ data: uni }, { data: depts }, { data: docTypes }] = await Promise.all([
    sub.university_id != null
      ? supabase
          .from("universities")
          .select("id, name_ko")
          .eq("id", sub.university_id)
          .maybeSingle()
      : Promise.resolve({ data: null as { id: number; name_ko: string } | null }),
    sub.university_id != null
      ? supabase
          .from("departments")
          .select("id, name_ko, active")
          .eq("university_id", sub.university_id)
          .order("sort_order")
      : Promise.resolve({ data: [] as Array<{ id: number; name_ko: string; active: boolean }> }),
    // 표준데이터 '발급 서류'(document) 분류 — 1:1 매핑 후보
    supabase
      .from("study_student_data_types")
      .select("key, label_ko")
      .eq("is_active", true)
      .eq("category", "document")
      .order("sort_order"),
  ]);

  const isShared = sub.university_id == null;

  return (
    <>
      <PageHeader
        title={sub.name_ko || "발급 서류"}
        description={isShared ? "공용 (전체 대학 공통)" : uni?.name_ko ?? `대학 #${sub.university_id}`}
        breadcrumbs={[
          { href: "/admissions", label: "입학서류" },
          { label: sub.name_ko || "발급 서류" },
        ]}
      />
      <div className="p-6">
        <SubmissionDocDetail
          sub={{
            id: sub.id,
            university_id: sub.university_id,
            department_id: sub.department_id,
            base_submission_id: sub.base_submission_id,
            name_ko: sub.name_ko,
            name_vi: sub.name_vi,
            target_person: sub.target_person,
            target_person_note: sub.target_person_note,
            sample_image_url: sub.sample_image_url,
            issuance_requirements: sub.issuance_requirements ?? {},
            required_data_type_keys: sub.required_data_type_keys ?? [],
            aliases: sub.aliases ?? [],
            applies_to_languages: sub.applies_to_languages ?? [],
            applies_to_locations: sub.applies_to_locations ?? [],
            sort_order: sub.sort_order,
            is_active: sub.is_active,
            status: sub.status,
          }}
          isShared={isShared}
          universityName={uni?.name_ko ?? null}
          departments={(depts ?? []).map((d) => ({
            id: d.id,
            name_ko: d.name_ko,
            active: d.active,
          }))}
          docTypes={(docTypes ?? []).map((d) => ({ key: d.key, label_ko: d.label_ko }))}
        />
      </div>
    </>
  );
}
