/**
 * /center/students/[id]/applications/[appId]/edit
 *   지원 의향 편집 (target_department_label / next_action / next_deadline).
 *   status 변경은 학생 상세의 inline dropdown 으로 별도 처리.
 */

import Link from "next/link";
import { notFound } from "next/navigation";

import { verifyCenterSession } from "@/lib/center/dal";
import { createCenterClient } from "@/lib/supabase/center";

import { EditApplicationForm } from "./edit-application-form";

export default async function EditApplicationPage({
  params,
}: {
  params: Promise<{ id: string; appId: string }>;
}) {
  const { id, appId } = await params;
  await verifyCenterSession();
  const supabase = await createCenterClient();

  // 학생 + 지원 동시 조회 (RLS 가 본인 org 만 허용)
  const [studentRes, appRes] = await Promise.all([
    supabase
      .from("study_managed_students")
      .select("id, name")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("study_applications")
      .select(
        "id, target_department_label, next_action, next_deadline, student_id"
      )
      .eq("id", appId)
      .maybeSingle(),
  ]);

  const student = studentRes.data;
  const application = appRes.data;

  if (!student || !application || application.student_id !== id) {
    notFound();
  }

  return (
    <div className="max-w-2xl">
      <header className="mb-6">
        <Link
          href={`/center/students/${id}`}
          className="text-sm text-slate-500 hover:underline"
        >
          ← Quay lại chi tiết
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          Chỉnh sửa đơn tuyển sinh
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Sinh viên: <strong>{student.name}</strong>
        </p>
      </header>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <EditApplicationForm application={application} studentId={id} />
      </div>
    </div>
  );
}
