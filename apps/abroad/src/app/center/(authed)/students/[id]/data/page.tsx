/**
 * /center/students/[id]/data — 학생별 표준 데이터 입력 (B4-4).
 *
 * 카테고리별 입력 + 학생의 지원 의향 → 필요한 양식 → 필요한 데이터 타입 자동 식별 → 부족 항목 highlight.
 */

import { notFound } from "next/navigation";

import { verifyCenterSession } from "@/lib/center/dal";
import { createCenterClient } from "@/lib/supabase/center";
import { getLocale, tr } from "@/lib/i18n";
import {
  loadStudentDataContext,
  toEditorDataType,
  pickRequired,
  isFormImageDataType,
} from "@/lib/center/student-data-context";
import { seedStudentDataFromRecords } from "@/lib/center/seed-student-data";
import { isFixedKey } from "@/lib/fixed-values";
import { FixedValuesCard } from "@/components/fixed-values-card";
import { StudentDataEditor } from "./student-data-editor";

export default async function StudentDataPage({
  params,
}: {
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

  // 학생 등록 때 받은 값·지원 대학에서 정해진 값을 빈 항목에만 미리 채운다(멱등).
  await seedStudentDataFromRecords(supabase, id);

  const { dataTypes, valueMap, inputMap, requiredMap } =
    await loadStudentDataContext(supabase, id);

  // 첨부파일(파일 타입)은 '서류 등록' 탭으로 이동 → 여기선 제외.
  // 단, 양식에 직접 박히는 이미지(증명사진·서명)는 정보 입력에 포함하되
  // 서명과 함께 '기타' 그룹으로 묶는다.
  // 고정값(추천인 등)은 입력칸으로 두지 않는다 — 아래 안내 카드로만 보여준다.
  const fixedLabels: Record<string, string> = {};
  for (const d of dataTypes) {
    if (isFixedKey(d.key)) {
      fixedLabels[d.key] = locale === "ko" ? d.label_ko : d.label_vi;
    }
  }

  const nonFile = dataTypes
    .filter((d) => d.input_type !== "file" || isFormImageDataType(d))
    .filter((d) => !isFixedKey(d.key))
    .map((d) => (isFormImageDataType(d) ? { ...d, category: "other" } : d));
  const nonFileKeys = new Set(nonFile.map((d) => d.key));

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold text-slate-900">
          {tr(locale, "정보 입력", "Nhập thông tin")}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {tr(
            locale,
            "지원 양식 작성에 필요한 정보입니다. 한 번 입력하면 여러 대학에 재사용됩니다. (첨부파일은 '서류 등록' 탭)",
            "Thông tin cần thiết để điền hồ sơ. Nhập một lần — dùng cho nhiều trường. (Tệp đính kèm ở tab 'Tải giấy tờ')"
          )}
        </p>
      </header>

      <FixedValuesCard locale={locale} labels={fixedLabels} />

      <StudentDataEditor
        locale={locale}
        studentId={id}
        dataTypes={nonFile.map(toEditorDataType)}
        existingValues={Object.fromEntries(valueMap)}
        existingInputs={Object.fromEntries(inputMap)}
        requiredBySource={pickRequired(requiredMap, nonFileKeys)}
      />
    </div>
  );
}
