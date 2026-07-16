/**
 * 학생(B2C 셀프가입) 세션 검증.
 *   - Supabase auth 사용자 → study_managed_students(auth_user_id) 매핑
 *   - 학생 행이 없으면 로그인으로 (행 생성은 /auth/callback 에서 수행)
 *   유학센터(/center) 와 별개의 인증 축.
 */

import "server-only";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type StudentSession = {
  authUserId: string;
  email: string | null;
  student: {
    id: string;
    name: string | null;
    phone: string | null;
    email: string | null;
    source: string;
  };
};

export async function verifyStudentSession(
  redirectTo = "/student/login"
): Promise<StudentSession> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(redirectTo);

  const { data: student } = await supabase
    .from("study_managed_students")
    .select("id, name, phone, email, source")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!student) redirect(`${redirectTo}?error=no_student`);

  return {
    authUserId: user.id,
    email: user.email ?? null,
    student: {
      id: student.id,
      name: student.name ?? null,
      phone: student.phone ?? null,
      email: student.email ?? null,
      source: (student as { source?: string }).source ?? "self",
    },
  };
}

/** 로그인 여부만 확인(리다이렉트 없이). 학생 행이 아직 없으면 null. */
export async function getStudentSession(): Promise<StudentSession | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: student } = await supabase
    .from("study_managed_students")
    .select("id, name, phone, email, source")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!student) return null;
  return {
    authUserId: user.id,
    email: user.email ?? null,
    student: {
      id: student.id,
      name: student.name ?? null,
      phone: student.phone ?? null,
      email: student.email ?? null,
      source: (student as { source?: string }).source ?? "self",
    },
  };
}
