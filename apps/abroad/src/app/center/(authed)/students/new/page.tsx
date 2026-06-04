/**
 * /center/students/new — 학생 개별 등록.
 *   서버 컴포넌트 → NewStudentForm (client).
 */

import Link from "next/link";

import { verifyCenterSession } from "@/lib/center/dal";

import { NewStudentForm } from "./new-student-form";

export default async function NewStudentPage() {
  await verifyCenterSession(); // 인증 + org 검증

  return (
    <div className="max-w-3xl">
      <header className="mb-6">
        <Link
          href="/center/students"
          className="text-sm text-slate-500 hover:underline"
        >
          ← Quay lại danh sách
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          Đăng ký sinh viên mới
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Nhập thông tin cơ bản. Đơn tuyển sinh cụ thể (trường, ngành) có thể
          thêm sau ở trang chi tiết.
        </p>
      </header>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <NewStudentForm />
      </div>
    </div>
  );
}
