/**
 * /student/data — 셀프 학생 정보 입력.
 *   유학센터 정보 입력과 동일 UI(StudentDataEditor) 재사용. 세션만 학생.
 *   센터 전용 도구(외부 입력 링크·AI 자동채움)는 숨김.
 */

import Link from "next/link";

import { verifyStudentSession } from "@/lib/student/dal";
import { createClient } from "@/lib/supabase/server";
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
import { StudentDataEditor } from "@/app/center/(authed)/students/[id]/data/student-data-editor";

export const dynamic = "force-dynamic";

export default async function StudentDataPage() {
  const session = await verifyStudentSession();
  const locale = await getLocale();
  const supabase = await createClient();
  const studentId = session.student.id;

  // 가입 때 받은 값·지원 대학에서 정해진 값을 빈 항목에만 미리 채운다(멱등).
  await seedStudentDataFromRecords(supabase, studentId);

  const { dataTypes, valueMap, inputMap, requiredMap } =
    await loadStudentDataContext(supabase, studentId);

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
      <div>
        <Link
          href="/student/applications"
          className="text-sm text-ink-light hover:underline"
        >
          {tr(locale, "← 내 지원", "← Hồ sơ của tôi")}
        </Link>
        <h1 className="mt-2 gc-page-title">
          {tr(locale, "정보 입력", "Nhập thông tin")}
        </h1>
        <p className="gc-page-desc">
          {tr(
            locale,
            "지원 서류에 필요한 정보입니다. 한 번 입력하면 여러 대학에 재사용됩니다. (첨부파일은 '서류 등록')",
            "Thông tin cần cho hồ sơ. Nhập một lần — dùng cho nhiều trường. (Tệp đính kèm ở 'Tải giấy tờ')"
          )}
        </p>
      </div>

      <FixedValuesCard locale={locale} labels={fixedLabels} />

      <StudentDataEditor
        locale={locale}
        studentId={studentId}
        dataTypes={nonFile.map(toEditorDataType)}
        existingValues={Object.fromEntries(valueMap)}
        existingInputs={Object.fromEntries(inputMap)}
        requiredBySource={pickRequired(requiredMap, nonFileKeys)}
        showCenterTools={false}
      />
    </div>
  );
}
