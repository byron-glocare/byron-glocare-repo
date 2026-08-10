/**
 * 이미 받은 값을 정보입력에 자동으로 넘겨준다.
 *
 * 두 갈래:
 *   1) 학생 등록 시 받은 값 — 이름·전화·이메일·생년월일·TOPIK
 *   2) 지원 대학을 고르는 것으로 이미 정해진 값 — 지원 학과·년도·학기·월
 *
 * 원칙: **빈 항목만 채운다.** 이미 값이 있으면 절대 덮어쓰지 않으므로
 * 유학센터·학생이 고친 내용이 페이지를 다시 열어도 되돌아가지 않는다.
 * 멱등이라 몇 번 호출해도 결과가 같다.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";

type Client = SupabaseClient<Database>;

/** "2026-Fall" → 학기 라벨. 봄=1학기, 가을=2학기. */
function semesterLabel(term: string | null | undefined): string | null {
  if (!term) return null;
  const t = term.toLowerCase();
  if (t.includes("spring") || t.includes("1학기")) return "1학기";
  if (t.includes("fall") || t.includes("autumn") || t.includes("2학기"))
    return "2학기";
  return null;
}

/** "2026-Fall" → "2026" */
function yearOf(term: string | null | undefined): string | null {
  const m = /(20\d{2})/.exec(term ?? "");
  return m ? m[1] : null;
}

/**
 * 입학(개강) 월. 모집요강의 실제 개강일을 우선 쓰고,
 * 없으면 학기에서 관례값(1학기=3월, 2학기=9월)으로 떨어뜨린다.
 */
function monthOf(
  semesterStart: string | null | undefined,
  term: string | null | undefined
): string | null {
  const m = /^\d{4}-(\d{2})/.exec(semesterStart ?? "");
  if (m) return `${Number(m[1])}월`;
  const sem = semesterLabel(term);
  if (sem === "1학기") return "3월";
  if (sem === "2학기") return "9월";
  return null;
}

export type SeedResult = { filled: string[] };

export async function seedStudentDataFromRecords(
  supabase: Client,
  studentId: string
): Promise<SeedResult> {
  const [{ data: student }, { data: values }, { data: apps }] =
    await Promise.all([
      supabase
        .from("study_managed_students")
        .select("id, name, phone, email, dob, topik_level")
        .eq("id", studentId)
        .maybeSingle(),
      supabase
        .from("study_student_data_values")
        .select("data_type_key, value")
        .eq("student_id", studentId),
      supabase
        .from("study_applications")
        .select("id, admission_spec_id, target_department_label, created_at")
        .eq("student_id", studentId)
        .order("created_at", { ascending: true }),
    ]);

  if (!student) return { filled: [] };

  // 이미 값이 있는 키 — 건드리지 않는다. 빈 문자열은 "없음"으로 본다.
  const filled = new Set<string>();
  for (const v of values ?? []) {
    const raw = v.value;
    const empty =
      raw == null || (typeof raw === "string" && raw.trim() === "");
    if (!empty) filled.add(v.data_type_key);
  }

  const candidates: Array<[string, string | null]> = [
    // 1) 학생 등록 시 받은 값
    ["full_name_vi", student.name],
    ["student_phone", student.phone],
    ["student_email", student.email],
    ["birth_date", student.dob],
    ["topik_level", student.topik_level],
  ];

  // 2) 지원 정보 — 가장 먼저 등록한 지원 기준(복수 지원이면 정보입력에서 수정).
  const firstApp = (apps ?? [])[0];
  if (firstApp) {
    const { data: spec } = await supabase
      .from("study_admission_specs")
      .select("id, term, schedule")
      .eq("id", firstApp.admission_spec_id)
      .maybeSingle();

    const term = spec?.term ?? null;
    const schedule = (spec?.schedule ?? {}) as { semester_start?: string | null };

    candidates.push(
      ["part_class_name", firstApp.target_department_label],
      ["apply_year", yearOf(term)],
      ["apply_semester", semesterLabel(term)],
      ["apply_month", monthOf(schedule.semester_start, term)]
    );
  }

  const rows = candidates
    .filter(([key, val]) => !filled.has(key) && !!val && String(val).trim())
    .map(([key, val]) => ({
      student_id: studentId,
      data_type_key: key,
      value: String(val).trim() as unknown as Json,
    }));

  if (rows.length === 0) return { filled: [] };

  // 카탈로그에 없는 키(마이그레이션 미실행 등)는 FK/무의미 행을 만들지 않도록 걸러낸다.
  const { data: types } = await supabase
    .from("study_student_data_types")
    .select("key")
    .in(
      "key",
      rows.map((r) => r.data_type_key)
    );
  const known = new Set((types ?? []).map((t) => t.key));
  const insertable = rows.filter((r) => known.has(r.data_type_key));
  if (insertable.length === 0) return { filled: [] };

  const { error } = await supabase
    .from("study_student_data_values")
    .upsert(insertable, { onConflict: "student_id,data_type_key" });

  // 실패해도 화면은 그대로 떠야 한다 — 자동 채움은 부가 기능.
  if (error) return { filled: [] };
  return { filled: insertable.map((r) => r.data_type_key) };
}
