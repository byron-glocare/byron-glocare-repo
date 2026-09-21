/**
 * /center/students/[id]/applications/[appId]/edit
 *   지원 의향 편집 (모집(대학·학과·학기) 변경 / target_department_label / next_action / next_deadline).
 *   status 변경은 학생 상세의 inline dropdown 으로 별도 처리.
 */

import Link from "next/link";
import { notFound } from "next/navigation";

import { verifyCenterSession } from "@/lib/center/dal";
import { createCenterClient } from "@/lib/supabase/center";
import { getLocale, tr } from "@/lib/i18n";

import { EditApplicationForm, type EditOfferingOption } from "./edit-application-form";

export default async function EditApplicationPage({
  params,
}: {
  params: Promise<{ id: string; appId: string }>;
}) {
  const { id, appId } = await params;
  await verifyCenterSession();
  const locale = await getLocale();
  const supabase = await createCenterClient();

  // 학생 + 지원 동시 조회 (RLS 가 본인 org 만 허용)
  const [studentRes, appRes, offeringRes] = await Promise.all([
    supabase
      .from("study_managed_students")
      .select("id, name")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("study_applications")
      .select(
        "id, admission_spec_id, offering_id, target_department_id, term, priority, status, target_department_label, next_action, next_deadline, student_id"
      )
      .eq("id", appId)
      .maybeSingle(),
    // 모집 중(published) offering — 지원을 다른 대학·학과·학기로 옮길 때
    supabase
      .from("study_offerings")
      .select("id, university_id, department_id, term, source_spec_id")
      .eq("status", "published")
      .not("source_spec_id", "is", null)
      .order("term", { ascending: false }),
  ]);

  const student = studentRes.data;
  const application = appRes.data;

  if (!student || !application || application.student_id !== id) {
    notFound();
  }

  const offerings = offeringRes.data ?? [];
  const uniIds = Array.from(new Set(offerings.map((o) => o.university_id)));
  const deptIds = Array.from(new Set(offerings.map((o) => o.department_id)));
  const [{ data: unis }, { data: depts }] = await Promise.all([
    uniIds.length > 0
      ? supabase.from("universities").select("id, name_ko, name_vi").in("id", uniIds)
      : Promise.resolve({ data: [] as Array<{ id: number; name_ko: string; name_vi: string | null }> }),
    deptIds.length > 0
      ? supabase.from("departments").select("id, name_ko, name_vi").in("id", deptIds)
      : Promise.resolve({ data: [] as Array<{ id: number; name_ko: string; name_vi: string | null }> }),
  ]);
  const uniName = new Map(
    (unis ?? []).map((u) => [u.id, locale === "vi" ? u.name_vi || u.name_ko : u.name_ko])
  );
  const deptName = new Map(
    (depts ?? []).map((d) => [d.id, locale === "vi" ? d.name_vi || d.name_ko : d.name_ko])
  );
  const offeringOptions: EditOfferingOption[] = offerings.map((o) => ({
    id: o.id,
    label: `${uniName.get(o.university_id) ?? "?"} · ${deptName.get(o.department_id) ?? `#${o.department_id}`} · ${o.term}`,
  }));

  return (
    <div className="max-w-2xl">
      <header className="mb-6">
        <Link
          href={`/center/students/${id}`}
          className="text-sm text-slate-500 hover:underline"
        >
          {tr(locale, "← 상세로 돌아가기", "← Quay lại chi tiết")}
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          {tr(locale, "지원 내역 수정", "Chỉnh sửa đơn tuyển sinh")}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {tr(locale, "학생", "Sinh viên")}: <strong>{student.name}</strong>
        </p>
      </header>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <EditApplicationForm
          locale={locale}
          application={application}
          offerings={offeringOptions}
          studentId={id}
        />
      </div>
    </div>
  );
}
