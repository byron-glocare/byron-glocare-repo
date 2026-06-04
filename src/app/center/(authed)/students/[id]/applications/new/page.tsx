/**
 * /center/students/[id]/applications/new
 *   학생에게 신규 지원 의향(study_applications) 등록.
 *   approved 모집요강 list 를 dropdown 으로 노출.
 */

import Link from "next/link";
import { notFound } from "next/navigation";

import { verifyCenterSession } from "@/lib/center/dal";
import { createCenterClient } from "@/lib/supabase/center";

import { NewApplicationForm, type SpecOption } from "./new-application-form";

export default async function NewApplicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await verifyCenterSession();
  const supabase = await createCenterClient();

  // 1. 학생 존재·소유 확인 (RLS)
  const { data: student } = await supabase
    .from("study_managed_students")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();

  if (!student) {
    notFound();
  }

  // 2. approved 모집요강 list
  const { data: specs } = await supabase
    .from("study_admission_specs")
    .select(
      "id, university_id, term, admission_category, program_type, departments"
    )
    .eq("status", "approved")
    .order("updated_at", { ascending: false });

  // 3. universities 이름 join (지금 schema 의 FK 가 number 라 별도 query)
  const universityIds = Array.from(
    new Set((specs ?? []).map((s) => s.university_id))
  );
  const { data: universities } =
    universityIds.length > 0
      ? await supabase
          .from("universities")
          .select("id, name_ko")
          .in("id", universityIds)
      : { data: [] as Array<{ id: number; name_ko: string }> };

  const universityMap = new Map(
    (universities ?? []).map((u) => [u.id, u.name_ko])
  );

  const specOptions: SpecOption[] = (specs ?? []).map((s) => {
    const depts = Array.isArray(s.departments)
      ? (s.departments as Array<{
          name?: string;
          faculty?: string | null;
          track?: string | null;
        }>)
      : [];
    return {
      id: s.id,
      universityNameKo: universityMap.get(s.university_id) ?? null,
      term: s.term,
      admissionCategory: s.admission_category,
      programType: s.program_type,
      departments: depts
        .filter((d) => d && typeof d === "object" && typeof d.name === "string")
        .map((d) => ({
          name: d.name as string,
          faculty: d.faculty ?? null,
          track: d.track ?? null,
        })),
    };
  });

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
          Đăng ký nguyện vọng mới
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Sinh viên: <strong>{student.name}</strong>
        </p>
      </header>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <NewApplicationForm
          studentId={id}
          studentName={student.name}
          specs={specOptions}
        />
      </div>
    </div>
  );
}
