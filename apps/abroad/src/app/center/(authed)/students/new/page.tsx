/**
 * /center/students/new — 학생 개별 등록.
 *   서버 컴포넌트 → NewStudentForm (client).
 */

import Link from "next/link";

import { verifyCenterSession } from "@/lib/center/dal";
import { getLocale, tr } from "@/lib/i18n";

import { NewStudentForm } from "./new-student-form";

export default async function NewStudentPage() {
  await verifyCenterSession(); // 인증 + org 검증
  const locale = await getLocale();

  return (
    <div className="max-w-3xl">
      <header className="mb-6">
        <Link
          href="/center/students"
          className="text-sm text-slate-500 hover:underline"
        >
          {tr(locale, "← 목록으로 돌아가기", "← Quay lại danh sách")}
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          {tr(locale, "신규 학생 등록", "Đăng ký sinh viên mới")}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {tr(
            locale,
            "기본 정보를 입력하세요. 구체적인 지원 내역(대학·학과)은 상세 페이지에서 나중에 추가할 수 있습니다.",
            "Nhập thông tin cơ bản. Đơn tuyển sinh cụ thể (trường, ngành) có thể thêm sau ở trang chi tiết."
          )}
        </p>
      </header>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <NewStudentForm locale={locale} />
      </div>
    </div>
  );
}
