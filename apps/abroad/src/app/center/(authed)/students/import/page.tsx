/**
 * /center/students/import — 학생 일괄 등록 (엑셀).
 *
 * 2단계 흐름: 양식 다운로드 → 작성 → 업로드 → 검증·결과.
 * 이번 라운드 = 1단계 (다운로드) + 업로드 placeholder.
 * 후속 라운드 = 업로드 파싱 + 행별 zod 검증 + 결과 표시.
 */

import Link from "next/link";

import { verifyCenterSession } from "@/lib/center/dal";
import { getLocale, tr } from "@/lib/i18n";

import { ImportForm } from "./import-form";

export default async function StudentImportPage() {
  await verifyCenterSession();
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
          {tr(locale, "학생 일괄 등록 (엑셀)", "Tải danh sách sinh viên (Excel)")}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {tr(
            locale,
            "2단계 절차: 양식 다운로드 → 작성 → 시스템에 업로드.",
            "Quy trình 2 bước: tải mẫu → điền → tải lên hệ thống."
          )}
        </p>
      </header>

      {/* Bước 1 — 양식 다운로드 */}
      <section className="mb-6 rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="rounded-full bg-slate-900 px-2 py-0.5 text-xs font-bold text-white">
            1
          </span>
          {tr(locale, "양식 다운로드", "Tải mẫu")}
        </h2>
        <p className="mb-4 text-sm text-slate-600">
          {tr(
            locale,
            "엑셀 양식에는 TOPIK · Visa · 위치 드롭다운이 포함되어 있습니다.",
            "Mẫu Excel có sẵn dropdown cho TOPIK · Visa · Vị trí."
          )}
          <br />
          <span className="text-slate-500">
            {tr(locale, "행", "Dòng")}{" "}
            <code className="rounded bg-slate-100 px-1 text-xs">[VÍ DỤ]</code>{" "}
            {tr(
              locale,
              "은 시스템이 자동으로 건너뜁니다 — 삭제하지 않아도 됩니다.",
              "sẽ được hệ thống tự động bỏ qua — không cần xóa."
            )}
          </span>
        </p>
        <a
          href="/api/center/students/template"
          className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          {tr(locale, "⬇ 양식 다운로드 (.xlsx)", "⬇ Tải mẫu (.xlsx)")}
        </a>
      </section>

      {/* Bước 2 — 업로드 */}
      <section className="mb-6 rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="rounded-full bg-slate-900 px-2 py-0.5 text-xs font-bold text-white">
            2
          </span>
          {tr(locale, "작성한 파일 업로드", "Tải file đã điền lên")}
        </h2>
        <p className="mb-4 text-sm text-slate-600">
          {tr(
            locale,
            "최대 500행 / 5MB. 각 행은 독립적으로 검증됩니다 — 오류 행이 정상 행에 영향을 주지 않습니다.",
            "Tối đa 500 dòng / 5MB. Mỗi dòng được kiểm tra độc lập — dòng lỗi không ảnh hưởng dòng đúng."
          )}
        </p>
        <ImportForm locale={locale} />
      </section>

      {/* Hướng dẫn nhanh */}
      <section className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-700">
        <h2 className="mb-3 font-semibold text-slate-900">
          {tr(locale, "빠른 안내", "Hướng dẫn nhanh")}
        </h2>
        <ul className="ml-5 list-disc space-y-1.5">
          <li>
            {tr(locale, "다음으로 시작하는 행 ", "Dòng bắt đầu bằng ")}
            <code className="rounded bg-slate-100 px-1 text-xs">[VÍ DỤ]</code>{" "}
            {tr(
              locale,
              "은 자동으로 건너뜁니다. 삭제하거나 그대로 두어도 됩니다.",
              "sẽ tự động bị bỏ qua. Có thể xóa hoặc giữ nguyên."
            )}
          </li>
          <li>
            <strong>{tr(locale, "이름", "Họ và tên")}</strong>{" "}
            {tr(
              locale,
              "열은 필수이며, 나머지 열은 비워둘 수 있습니다.",
              "cột bắt buộc, các cột khác có thể để trống."
            )}
          </li>
          <li>
            <strong>{tr(locale, "생년월일", "Ngày sinh")}</strong>{" "}
            {tr(locale, "형식 ", "dạng ")}
            <code>YYYY-MM-DD</code>{" "}
            {tr(locale, "(예: 2005-03-15)", "(ví dụ: 2005-03-15)")}
          </li>
          <li>
            <strong>{tr(locale, "여권번호", "Số hộ chiếu")}</strong>:{" "}
            {tr(locale, "4–20자, 영문·숫자만.", "4–20 ký tự, chỉ chữ và số.")}
          </li>
          <li>
            <strong>{tr(locale, "TOPIK · Visa · 위치", "TOPIK · Visa · Vị trí")}</strong>{" "}
            {tr(
              locale,
              "는 양식의 드롭다운에서 선택하세요.",
              "chọn từ dropdown trong mẫu."
            )}
          </li>
          <li>
            {tr(locale, "한 번에 약 ", "Tối đa khoảng ")}
            <strong>{tr(locale, "500행", "500 dòng")}</strong>{" "}
            {tr(
              locale,
              "까지 업로드하세요. 더 큰 파일은 여러 번으로 나누세요.",
              "mỗi lần tải lên. File lớn hơn nên chia thành nhiều lần."
            )}
          </li>
          <li>
            {tr(
              locale,
              "학생에게 이메일을 보내지 않습니다 — 정보 저장용입니다.",
              "Hệ thống không gửi email cho sinh viên — chỉ lưu thông tin."
            )}
          </li>
        </ul>
      </section>
    </div>
  );
}
