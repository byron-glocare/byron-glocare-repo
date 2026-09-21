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
import { REG_FIELDS, REQUIRED_FIELD_IDS } from "@/lib/center/students/registration";

import { ImportForm } from "./import-form";

export default async function StudentImportPage() {
  await verifyCenterSession();
  const locale = await getLocale();
  const requiredLabels = REQUIRED_FIELD_IDS.map((id) =>
    tr(locale, REG_FIELDS[id].ko, REG_FIELDS[id].vi)
  ).join(", ");

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
            "운영 엑셀(지원자 명단)과 같은 양식입니다 — 머리글 2줄, 3행부터 입력. 비자·성별·최종학력·TOPIK·지원 학기 등은 드롭다운이 있습니다. 빨간 머리글이 필수 칸입니다.",
            "Cùng mẫu với danh sách ứng viên — tiêu đề 2 dòng, nhập từ dòng 3. Visa, giới tính, học lực, TOPIK, kỳ đăng ký có dropdown. Cột tiêu đề màu đỏ là bắt buộc."
          )}
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
            <strong>{tr(locale, "필수 칸", "Cột bắt buộc")}</strong>: {requiredLabels}.{" "}
            {tr(
              locale,
              "하나라도 비면 그 행은 등록되지 않고 오류로 표시됩니다.",
              "Thiếu một mục thì dòng đó không được đăng ký và báo lỗi."
            )}
          </li>
          <li>
            <strong>{tr(locale, "날짜", "Ngày")}</strong>:{" "}
            <code>YYYY-MM-DD</code> {tr(locale, "또는", "hoặc")} <code>DD/MM/YYYY</code>
          </li>
          <li>
            <strong>{tr(locale, "최종 졸업학교 · 입학일자 · 졸업일자", "Trường tốt nghiệp · Ngày nhập học · Ngày tốt nghiệp")}</strong>:{" "}
            {tr(
              locale,
              "최종학력이 고졸이면 고등학교, 전문대·대학 졸업이면 대학 정보로 저장됩니다.",
              "THPT → lưu là thông tin cấp 3; CĐ/ĐH → lưu là thông tin trường CĐ/ĐH."
            )}
          </li>
          <li>
            {tr(
              locale,
              "결석 합계·월수입 합계 칸은 자동 계산이라 입력하지 않아도 됩니다.",
              "Cột tổng số buổi nghỉ và tổng thu nhập được tự động tính, không cần nhập."
            )}
          </li>
          <li>
            <strong>{tr(locale, "여권번호", "Số hộ chiếu")}</strong>:{" "}
            {tr(locale, "4–20자, 영문·숫자만.", "4–20 ký tự, chỉ chữ và số.")}
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
              "입력한 값은 '정보 입력'과 작성서류에 그대로 쓰입니다. 학생에게 이메일을 보내지 않습니다.",
              "Giá trị nhập được dùng luôn cho 'Nhập thông tin' và hồ sơ. Hệ thống không gửi email cho sinh viên."
            )}
          </li>
        </ul>
      </section>
    </div>
  );
}
