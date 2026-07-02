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
  link_type: "independent" | "reference" | null;
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
      .select("id, university_id, term")
      .in("id", specIds);
    const specToUni = new Map<string, number>(
      (specs ?? []).map((s) => [s.id, s.university_id])
    );
    const specToTerm = new Map<string, string>(
      (specs ?? []).map((s) => [s.id, s.term])
    );
    const universityIds = Array.from(new Set((specs ?? []).map((s) => s.university_id)));

    if (universityIds.length > 0) {
      const { data: forms } = await supabase
        .from("study_admission_form_files")
        .select(
          "university_id, department_name, name_ko, required_data_type_keys, applies_to_terms"
        )
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
        const term = specToTerm.get(app.admission_spec_id);
        // 적용 양식 = (학과: 전체 or 일치) AND (학기: 전체 or 일치)
        const applicable = (formsByUni.get(uniId) ?? []).filter((f) => {
          const deptOk =
            f.department_name === null ||
            (!!app.target_department_label &&
              f.department_name === app.target_department_label);
          const terms = (f.applies_to_terms ?? []) as string[];
          const termOk = terms.length === 0 || (!!term && terms.includes(term));
          return deptOk && termOk;
        });
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

/**
 * 파일 타입 중 "양식에 직접 박히는 이미지"(증명사진·서명 등) 판별.
 *   이런 항목만 '정보 입력'에 남기고, 나머지 파일(졸업증명서 등 발급서류)은
 *   '서류 등록' 탭에서 처리한다.
 *   주의: "증명"을 매칭하면 졸업/성적/잔고**증명서**가 전부 걸리므로 금지 —
 *   사진·서명 계열 단어만 본다. (증명사진은 '사진'으로 매칭됨)
 */
export function isFormImageDataType(d: {
  key: string;
  label_ko: string;
  input_type: string;
}): boolean {
  return (
    d.input_type === "file" &&
    /사진|photo|서명|signature|도장|stamp/i.test(`${d.key} ${d.label_ko}`)
  );
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
    // 연결(참조/파생) 기능 폐지 — 모든 항목을 일반 입력으로. (보호자 이름 등도 직접 입력)
    is_derived: false,
    derived_from: null,
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
