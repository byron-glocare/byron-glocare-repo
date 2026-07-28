/**
 * 테스트용 학생 실제 데이터 로더.
 *   study_managed_students(name) + study_student_data_values(data_type_key, value jsonb)
 *   → {name, values: {key: 문자열}} 로 강제변환(coerce). 양식 채움에서 더미 대신 사용.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/** JSONB 값 → 채움용 문자열. 파일/객체(사진·서명)는 이미지로 따로 처리하므로 "" */
export function coerceValue(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map((x) => coerceValue(x)).filter(Boolean).join(", ");
  return ""; // {path,file_name} 등
}

export type TestStudent = { id: string; name: string };

/** 이름에 "테스트"가 들어간 학생 목록 */
export async function listTestStudents(
  supabase: SupabaseClient
): Promise<TestStudent[]> {
  const { data } = await supabase
    .from("study_managed_students")
    .select("id, name")
    .ilike("name", "%테스트%")
    .order("name")
    .limit(50);
  return (data ?? []) as TestStudent[];
}

/** 특정 학생의 {key: 값} 로드 (+ 학생 이름) */
export async function loadStudentValues(
  supabase: SupabaseClient,
  studentId: string
): Promise<{ name: string; values: Record<string, string> }> {
  const [{ data: stu }, { data: rows }] = await Promise.all([
    supabase
      .from("study_managed_students")
      .select("name")
      .eq("id", studentId)
      .maybeSingle(),
    supabase
      .from("study_student_data_values")
      .select("data_type_key, value")
      .eq("student_id", studentId),
  ]);

  const values: Record<string, string> = {};
  for (const r of (rows ?? []) as { data_type_key: string; value: unknown }[]) {
    const s = coerceValue(r.value);
    if (s) values[r.data_type_key] = s;
  }
  const name = (stu as { name?: string } | null)?.name ?? "";
  // 이름 표준데이터가 비어 있으면 학생 레코드 이름으로 폴백
  if (!values.full_name_ko && name) values.full_name_ko = name;
  return { name, values };
}
