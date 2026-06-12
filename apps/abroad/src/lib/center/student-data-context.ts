/**
 * 학생 표준데이터 입력 컨텍스트 로더 (정보 입력 / 서류 등록 공용).
 *   - 활성 카탈로그(dataTypes)
 *   - 현재 값(valueMap)
 *   - 지원 → 모집요강 → 대학 → 양식 → 필요 데이터 키(requiredMap: key→출처라벨[])
 *
 * 정보 입력은 파일 외 항목을, 서류 등록은 파일(첨부) 항목을 골라 쓴다.
 */

import type { createCenterClient } from "@/lib/supabase/center";
import type { Json } from "@/types/database";

type CenterClient = Awaited<ReturnType<typeof createCenterClient>>;

export type StudentDataTypeRow = {
  key: string;
  label_ko: string;
  label_vi: string;
  category: string;
  input_type: string;
  options: Array<{ value: string; label_ko: string; label_vi: string }> | null;
  hint_ko: string | null;
  hint_vi: string | null;
  is_essay_basis: boolean;
  is_derived: boolean | null;
  derived_from: { selector: string; map: Record<string, string> } | null;
};

export async function loadStudentDataContext(
  supabase: CenterClient,
  studentId: string
): Promise<{
  dataTypes: StudentDataTypeRow[];
  valueMap: Map<string, Json>;
  requiredMap: Map<string, string[]>;
}> {
  const [{ data: dataTypes }, { data: values }, { data: apps }] =
    await Promise.all([
      supabase
        .from("study_student_data_types")
        .select("*")
        .eq("is_active", true)
        .order("category")
        .order("sort_order"),
      supabase
        .from("study_student_data_values")
        .select("data_type_key, value")
        .eq("student_id", studentId),
      supabase
        .from("study_applications")
        .select("id, admission_spec_id, target_department_label")
        .eq("student_id", studentId),
    ]);

  const valueMap = new Map<string, Json>(
    (values ?? []).map((v) => [v.data_type_key, v.value])
  );

  // 필요 데이터 키 수집
  const requiredMap = new Map<string, string[]>();
  const specIds = (apps ?? []).map((a) => a.admission_spec_id);
  if (specIds.length > 0) {
    const { data: specs } = await supabase
      .from("study_admission_specs")
      .select("id, university_id")
      .in("id", specIds);
    const specToUni = new Map<string, number>(
      (specs ?? []).map((s) => [s.id, s.university_id])
    );
    const universityIds = Array.from(new Set((specs ?? []).map((s) => s.university_id)));

    if (universityIds.length > 0) {
      const { data: forms } = await supabase
        .from("study_admission_form_files")
        .select("university_id, department_name, name_ko, required_data_type_keys")
        .in("university_id", universityIds)
        .eq("is_current", true);

      const formsByUni = new Map<number, NonNullable<typeof forms>>();
      for (const f of forms ?? []) {
        if (!formsByUni.has(f.university_id)) formsByUni.set(f.university_id, []);
        formsByUni.get(f.university_id)!.push(f);
      }

      for (const app of apps ?? []) {
        const uniId = specToUni.get(app.admission_spec_id);
        if (uniId == null) continue;
        const applicable = (formsByUni.get(uniId) ?? []).filter(
          (f) =>
            f.department_name === null ||
            (app.target_department_label &&
              f.department_name === app.target_department_label)
        );
        for (const f of applicable) {
          const sourceLabel = `${f.name_ko}${
            app.target_department_label ? ` · ${app.target_department_label}` : ""
          }`;
          for (const key of f.required_data_type_keys ?? []) {
            if (!requiredMap.has(key)) requiredMap.set(key, []);
            const list = requiredMap.get(key)!;
            if (!list.includes(sourceLabel)) list.push(sourceLabel);
          }
        }
      }
    }
  }

  return {
    dataTypes: (dataTypes ?? []) as StudentDataTypeRow[],
    valueMap,
    requiredMap,
  };
}

/** editor 가 기대하는 DataTypeMeta 형태로 변환 */
export function toEditorDataType(d: StudentDataTypeRow) {
  return {
    key: d.key,
    label_ko: d.label_ko,
    label_vi: d.label_vi,
    category: d.category,
    input_type: d.input_type,
    options: d.options,
    hint_ko: d.hint_ko,
    hint_vi: d.hint_vi,
    is_essay_basis: d.is_essay_basis,
    is_derived: d.is_derived ?? false,
    derived_from: d.derived_from,
  };
}

/** requiredMap 에서 특정 key 집합만 남기기 */
export function pickRequired(
  requiredMap: Map<string, string[]>,
  keys: Set<string>
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [k, v] of requiredMap) if (keys.has(k)) out[k] = v;
  return out;
}
