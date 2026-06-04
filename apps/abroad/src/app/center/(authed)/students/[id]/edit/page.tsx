/**
 * /center/students/[id]/edit — 학생 정보 편집.
 */

import Link from "next/link";
import { notFound } from "next/navigation";

import { verifyCenterSession } from "@/lib/center/dal";
import { createCenterClient } from "@/lib/supabase/center";

import { EditStudentForm } from "./edit-student-form";

export default async function EditStudentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await verifyCenterSession();
  const supabase = await createCenterClient();

  const { data: student, error } = await supabase
    .from("study_managed_students")
    .select(
      "id, name, dob, passport_no_encrypted, phone, email, topik_level, current_visa, location, notes"
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !student) {
    notFound();
  }

  return (
    <div className="max-w-3xl">
      <header className="mb-6">
        <Link
          href={`/center/students/${id}`}
          className="text-sm text-slate-500 hover:underline"
        >
          ← Quay lại chi tiết
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          Chỉnh sửa thông tin sinh viên
        </h1>
        <p className="mt-1 text-sm text-slate-600">{student.name}</p>
      </header>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <EditStudentForm student={student} />
      </div>
    </div>
  );
}
