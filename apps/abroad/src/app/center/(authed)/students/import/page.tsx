/**
 * /center/students/import — 학생 일괄 등록 (엑셀).
 *
 * 2단계 흐름: 양식 다운로드 → 작성 → 업로드 → 검증·결과.
 * 이번 라운드 = 1단계 (다운로드) + 업로드 placeholder.
 * 후속 라운드 = 업로드 파싱 + 행별 zod 검증 + 결과 표시.
 */

import Link from "next/link";

import { verifyCenterSession } from "@/lib/center/dal";

import { ImportForm } from "./import-form";

export default async function StudentImportPage() {
  await verifyCenterSession();

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
          Tải danh sách sinh viên (Excel)
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Quy trình 2 bước: tải mẫu → điền → tải lên hệ thống.
        </p>
      </header>

      {/* Bước 1 — 양식 다운로드 */}
      <section className="mb-6 rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="rounded-full bg-slate-900 px-2 py-0.5 text-xs font-bold text-white">
            1
          </span>
          Tải mẫu
        </h2>
        <p className="mb-4 text-sm text-slate-600">
          Mẫu Excel có sẵn dropdown cho TOPIK · Visa · Vị trí.
          <br />
          <span className="text-slate-500">
            Dòng <code className="rounded bg-slate-100 px-1 text-xs">[VÍ DỤ]</code>{" "}
            sẽ được hệ thống tự động bỏ qua — không cần xóa.
          </span>
        </p>
        <a
          href="/api/center/students/template"
          className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          ⬇ Tải mẫu (.xlsx)
        </a>
      </section>

      {/* Bước 2 — 업로드 */}
      <section className="mb-6 rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="rounded-full bg-slate-900 px-2 py-0.5 text-xs font-bold text-white">
            2
          </span>
          Tải file đã điền lên
        </h2>
        <p className="mb-4 text-sm text-slate-600">
          Tối đa 500 dòng / 5MB. Mỗi dòng được kiểm tra độc lập — dòng lỗi
          không ảnh hưởng dòng đúng.
        </p>
        <ImportForm />
      </section>

      {/* Hướng dẫn nhanh */}
      <section className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-700">
        <h2 className="mb-3 font-semibold text-slate-900">Hướng dẫn nhanh</h2>
        <ul className="ml-5 list-disc space-y-1.5">
          <li>
            Dòng bắt đầu bằng{" "}
            <code className="rounded bg-slate-100 px-1 text-xs">[VÍ DỤ]</code>{" "}
            sẽ tự động bị bỏ qua. Có thể xóa hoặc giữ nguyên.
          </li>
          <li>
            Cột <strong>Họ và tên</strong> bắt buộc, các cột khác có thể để
            trống.
          </li>
          <li>
            <strong>Ngày sinh</strong> dạng <code>YYYY-MM-DD</code> (ví dụ:
            2005-03-15)
          </li>
          <li>
            <strong>Số hộ chiếu</strong>: 4–20 ký tự, chỉ chữ và số.
          </li>
          <li>
            <strong>TOPIK · Visa · Vị trí</strong> chọn từ dropdown trong mẫu.
          </li>
          <li>
            Tối đa khoảng <strong>500 dòng</strong> mỗi lần tải lên. File lớn
            hơn nên chia thành nhiều lần.
          </li>
          <li>
            Hệ thống không gửi email cho sinh viên — chỉ lưu thông tin.
          </li>
        </ul>
      </section>
    </div>
  );
}
