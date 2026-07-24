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
import { StudentDataEditor } from "@/app/center/(authed)/students/[id]/data/student-data-editor";

export const dynamic = "force-dynamic";

export default async function StudentDataPage() {
  const session = await verifyStudentSession();
  const locale = await getLocale();
  const supabase = await createClient();
  const studentId = session.student.id;

  const { dataTypes, valueMap, inputMap, requiredMap } =
    await loadStudentDataContext(supabase, studentId);

  const nonFile = dataTypes
    .filter((d) => d.input_type !== "file" || isFormImageDataType(d))
    .map((d) => (isFormImageDataType(d) ? { ...d, category: "other" } : d));
  const nonFileKeys = new Set(nonFile.map((d) => d.key));

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/student/applications"
          className="text-sm text-slate-500 hover:underline"
        >
          {tr(locale, "← 내 지원", "← Hồ sơ của tôi")}
        </Link>
        <h1 className="mt-2 text-xl font-bold text-slate-900">
          {tr(locale, "정보 입력", "Nhập thông tin")}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {tr(
            locale,
            "지원 서류에 필요한 정보입니다. 한 번 입력하면 여러 대학에 재사용됩니다. (첨부파일은 '서류 등록')",
            "Thông tin cần cho hồ sơ. Nhập một lần — dùng cho nhiều trường. (Tệp đính kèm ở 'Tải giấy tờ')"
          )}
        </p>
      </div>

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
