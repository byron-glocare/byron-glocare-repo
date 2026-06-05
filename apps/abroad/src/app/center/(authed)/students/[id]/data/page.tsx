/**
 * /center/students/[id]/data — 학생별 표준 데이터 입력 (B4-4).
 *
 * 카테고리별 입력 + 학생의 지원 의향 → 필요한 양식 → 필요한 데이터 타입 자동 식별 → 부족 항목 highlight.
 */

import Link from "next/link";
import { notFound } from "next/navigation";

import { verifyCenterSession } from "@/lib/center/dal";
import { createCenterClient } from "@/lib/supabase/center";
import { getLocale, tr } from "@/lib/i18n";
import { StudentDataEditor } from "./student-data-editor";
import type { Json } from "@/types/database";

export default async function StudentDataPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await verifyCenterSession();
  const locale = await getLocale();
  const supabase = await createCenterClient();

  // 학생 (RLS 가 본인 org 만 허용)
  const { data: student } = await supabase
    .from("study_managed_students")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();
  if (!student) notFound();

  // 활성 카탈로그
  const { data: dataTypes } = await supabase
    .from("study_student_data_types")
    .select("*")
    .eq("is_active", true)
    .order("category")
    .order("sort_order");

  // 현재 입력된 값
  const { data: values } = await supabase
    .from("study_student_data_values")
    .select("data_type_key, value, updated_at")
    .eq("student_id", id);

  // 학생의 지원 의향 → 모집요강 → 대학 → 양식 → required_data_type_keys 수집
  const { data: apps } = await supabase
    .from("study_applications")
    .select("id, admission_spec_id, target_department_label")
    .eq("student_id", id);

  const specIds = (apps ?? []).map((a) => a.admission_spec_id);
  const requiredKeysWithSource: Array<{ key: string; sourceLabel: string }> = [];

  if (specIds.length > 0) {
    const { data: specs } = await supabase
      .from("study_admission_specs")
      .select("id, university_id")
      .in("id", specIds);
    const universityIds = Array.from(
      new Set((specs ?? []).map((s) => s.university_id))
    );

    if (universityIds.length > 0) {
      const { data: forms } = await supabase
        .from("study_admission_form_files")
        .select("university_id, department_name, name_ko, required_data_type_keys")
        .in("university_id", universityIds)
        .eq("is_current", true);

      // university_id 별 form 들
      const formsByUni = new Map<number, typeof forms>();
      for (const f of forms ?? []) {
        if (!formsByUni.has(f.university_id)) formsByUni.set(f.university_id, []);
        formsByUni.get(f.university_id)!.push(f);
      }

      // 각 app 의 spec → uni → 적용 가능한 forms (대학 전체 + 학과 매칭)
      const specToUni = new Map<string, number>();
      for (const s of specs ?? []) specToUni.set(s.id, s.university_id);

      for (const app of apps ?? []) {
        const uniId = specToUni.get(app.admission_spec_id);
        if (uniId == null) continue;
        const applicableForms = (formsByUni.get(uniId) ?? []).filter((f) => {
          if (f.department_name === null) return true;
          // 학과별 override 는 app.target_department_label 와 매칭
          return (
            app.target_department_label &&
            f.department_name === app.target_department_label
          );
        });
        for (const f of applicableForms) {
          for (const key of f.required_data_type_keys ?? []) {
            requiredKeysWithSource.push({
              key,
              sourceLabel: `${f.name_ko}${
                app.target_department_label ? ` · ${app.target_department_label}` : ""
              }`,
            });
          }
        }
      }
    }
  }

  // key 별 source 합치기
  const requiredMap = new Map<string, string[]>();
  for (const { key, sourceLabel } of requiredKeysWithSource) {
    if (!requiredMap.has(key)) requiredMap.set(key, []);
    const list = requiredMap.get(key)!;
    if (!list.includes(sourceLabel)) list.push(sourceLabel);
  }

  const valueMap = new Map<string, Json>(
    (values ?? []).map((v) => [v.data_type_key, v.value])
  );

  return (
    <div className="space-y-4">
      <header>
        <Link
          href={`/center/students/${id}`}
          className="text-sm text-slate-500 hover:underline"
        >
          ← {student.name}
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          {tr(locale, "학생 상세 정보", "Thông tin chi tiết sinh viên")}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {tr(
            locale,
            "지원 양식 작성에 필요한 정보입니다. 한 번 입력하면 여러 대학에 재사용됩니다.",
            "Thông tin cần thiết để điền vào mẫu hồ sơ tuyển sinh. Nhập một lần — dùng cho nhiều trường."
          )}
        </p>
      </header>

      <StudentDataEditor
        locale={locale}
        studentId={id}
        dataTypes={(dataTypes ?? []).map((d) => ({
          key: d.key,
          label_ko: d.label_ko,
          label_vi: d.label_vi,
          category: d.category,
          input_type: d.input_type,
          options: d.options,
          hint_ko: d.hint_ko,
          hint_vi: d.hint_vi,
          is_essay_basis: d.is_essay_basis,
        }))}
        existingValues={Object.fromEntries(valueMap)}
        requiredBySource={Object.fromEntries(requiredMap)}
      />
    </div>
  );
}
