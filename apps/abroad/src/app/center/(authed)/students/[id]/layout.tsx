/**
 * /center/students/[id] 공통 레이아웃.
 *   상단 고정(sticky) 학생 헤더 + 단계 탭 바.
 *   각 탭(개요/대학 선택/서류 등록/정보 입력/최종 서류)은 하위 라우트로 전환된다.
 */

import Link from "next/link";
import { notFound } from "next/navigation";

import { verifyCenterSession } from "@/lib/center/dal";
import { createCenterClient } from "@/lib/supabase/center";
import { getLocale, tr } from "@/lib/i18n";

import { DeleteStudentButton } from "./delete-student-button";
import { StudentTabs } from "./student-tabs";

export default async function StudentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await verifyCenterSession();
  const locale = await getLocale();
  const supabase = await createCenterClient();

  const { data: student } = await supabase
    .from("study_managed_students")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();
  if (!student) notFound();

  const { count: appCount } = await supabase
    .from("study_applications")
    .select("id", { count: "exact", head: true })
    .eq("student_id", id);

  return (
    <div className="mx-auto max-w-4xl">
      {/* 이름·삭제 — 일반 흐름(스크롤 시 위로 사라짐) */}
      <div className="flex items-center justify-between gap-3 pb-2 pt-2">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/center/students"
            className="shrink-0 text-sm text-slate-500 hover:underline"
          >
            {tr(locale, "← 목록", "← Danh sách")}
          </Link>
          <h1 className="truncate text-lg font-bold text-slate-900">
            {student.name}
          </h1>
        </div>
        <DeleteStudentButton
          locale={locale}
          studentId={id}
          studentName={student.name}
          applicationCount={appCount ?? 0}
          small
        />
      </div>

      {/* 단계 탭 — 스크롤 시 상단 고정(불투명 배경으로 내용 비침 없음) */}
      <div className="sticky top-[3.25rem] z-10 -mx-6 border-b border-slate-200 bg-slate-50 px-6 py-2 shadow-[0_1px_0_rgba(0,0,0,0.04)] lg:-mx-8 lg:px-8">
        <StudentTabs studentId={id} locale={locale} />
      </div>

      <div className="py-6">{children}</div>
    </div>
  );
}
