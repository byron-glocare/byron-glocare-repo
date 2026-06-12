/**
 * /center/students/[id]/forms/[formFileId] — 학생 × 양식 작성 시트 (B4-6).
 *
 * 한 양식이 요구하는 모든 데이터를 학생의 입력값과 함께 한 페이지에 정리.
 * 인쇄/PDF 저장 친화. 유학센터 담당자가 보고 실제 양식에 옮겨 입력.
 */

import Link from "next/link";
import { notFound } from "next/navigation";

import { verifyCenterSession } from "@/lib/center/dal";
import { createCenterClient } from "@/lib/supabase/center";
import { getLocale, tr, type Locale } from "@/lib/i18n";
import type { EssayQuestion } from "@/types/study";
import type { Json } from "@/types/database";
import { PrintButton } from "./print-button";

function formKeyLabel(locale: Locale, key: string): string {
  switch (key) {
    case "application_form":
      return tr(locale, "입학 지원서", "Đơn đăng ký nhập học");
    case "self_intro":
      return tr(locale, "자기소개서", "Bản giới thiệu bản thân");
    case "study_plan":
      return tr(locale, "학업계획서", "Kế hoạch học tập");
    case "financial_pledge_form":
      return tr(locale, "재정보증서", "Cam kết tài chính");
    case "privacy_consent":
      return tr(locale, "개인정보 동의서", "Đồng ý bảo mật thông tin");
    case "academic_record_release":
      return tr(locale, "성적 제공 동의서", "Đồng ý cung cấp học bạ");
    case "recommendation_letter":
      return tr(locale, "추천서", "Thư giới thiệu");
    case "health_certificate":
      return tr(locale, "건강진단서 (양식)", "Giấy khám sức khỏe (mẫu)");
    case "other":
      return tr(locale, "기타", "Khác");
    default:
      return key;
  }
}

function categoryLabelOf(locale: Locale, category: string): string {
  switch (category) {
    case "identity":
      return tr(locale, "개인 정보", "Thông tin cá nhân");
    case "education":
      return tr(locale, "학력", "Học vấn");
    case "family":
      return tr(locale, "가족", "Gia đình");
    case "financial":
      return tr(locale, "재정", "Tài chính");
    case "language":
      return tr(locale, "어학", "Ngoại ngữ");
    case "contact":
      return tr(locale, "연락처", "Liên hệ");
    case "career":
      return tr(locale, "경력", "Kinh nghiệm");
    case "essay":
      return tr(locale, "작문 (기초자료)", "Văn viết (cơ sở)");
    case "document":
      return tr(locale, "발급 서류", "Giấy tờ phát hành");
    case "other":
      return tr(locale, "기타", "Khác");
    default:
      return category;
  }
}

export default async function StudentFormSheetPage({
  params,
}: {
  params: Promise<{ id: string; formFileId: string }>;
}) {
  const { id, formFileId } = await params;
  await verifyCenterSession();
  const locale = await getLocale();
  const supabase = await createCenterClient();

  const [{ data: student }, { data: form }] = await Promise.all([
    supabase
      .from("study_managed_students")
      .select("id, name")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("study_admission_form_files")
      .select("*")
      .eq("id", formFileId)
      .maybeSingle(),
  ]);

  if (!student || !form) notFound();

  const { data: uni } = await supabase
    .from("universities")
    .select("id, name_ko, name_vi")
    .eq("id", form.university_id)
    .maybeSingle();

  // 양식이 요구하는 데이터 타입 + 학생 값
  const requiredKeys = form.required_data_type_keys ?? [];
  const allKeys = new Set<string>(requiredKeys);
  const essayQuestions = (form.essay_questions ?? []) as EssayQuestion[];
  for (const q of essayQuestions) {
    for (const k of q.basis_data_type_keys ?? []) allKeys.add(k);
  }

  const keysArr = Array.from(allKeys);
  const [{ data: dataTypes }, { data: values }, { data: drafts }] =
    await Promise.all([
      keysArr.length > 0
        ? supabase
            .from("study_student_data_types")
            .select("key, label_ko, label_vi, category, input_type, is_essay_basis")
            .in("key", keysArr)
        : Promise.resolve({ data: [] as Array<{ key: string; label_ko: string; label_vi: string; category: string; input_type: string; is_essay_basis: boolean }> }),
      keysArr.length > 0
        ? supabase
            .from("study_student_data_values")
            .select("data_type_key, value")
            .eq("student_id", id)
            .in("data_type_key", keysArr)
        : Promise.resolve({ data: [] as Array<{ data_type_key: string; value: Json }> }),
      essayQuestions.length > 0
        ? supabase
            .from("study_student_essay_drafts")
            .select("question_index, generated_text, edited_text")
            .eq("student_id", id)
            .eq("form_file_id", formFileId)
        : Promise.resolve({ data: [] as Array<{ question_index: number; generated_text: string | null; edited_text: string | null }> }),
    ]);

  const valueMap = new Map<string, Json>(
    (values ?? []).map((v) => [v.data_type_key, v.value])
  );
  const dtMap = new Map((dataTypes ?? []).map((d) => [d.key, d]));
  const draftMap = new Map(
    (drafts ?? []).map((d) => [d.question_index, d])
  );

  // 카테고리별 그룹
  const byCategory = new Map<
    string,
    Array<{
      key: string;
      label_ko: string;
      label_vi: string;
      input_type: string;
      value: Json | undefined;
      is_essay_basis: boolean;
    }>
  >();
  for (const k of requiredKeys) {
    const dt = dtMap.get(k);
    if (!dt) continue;
    if (!byCategory.has(dt.category)) byCategory.set(dt.category, []);
    byCategory.get(dt.category)!.push({
      key: k,
      label_ko: dt.label_ko,
      label_vi: dt.label_vi,
      input_type: dt.input_type,
      value: valueMap.get(k),
      is_essay_basis: dt.is_essay_basis,
    });
  }

  const categoryOrder = [
    "identity",
    "education",
    "family",
    "financial",
    "language",
    "contact",
    "career",
    "essay",
    "document",
    "other",
  ];
  const totalFields = requiredKeys.length;
  const filledFields = requiredKeys.filter((k) => {
    const v = valueMap.get(k);
    return v !== null && v !== undefined && v !== "";
  }).length;

  return (
    <div className="space-y-4">
      {/* 인쇄 제외 헤더 */}
      <header className="print:hidden">
        <Link
          href={`/center/students/${id}/forms`}
          className="text-sm text-slate-500 hover:underline"
        >
          {tr(locale, "← 양식 목록", "← Danh sách mẫu")}
        </Link>
      </header>

      <div className="rounded-lg border border-slate-200 bg-white print:border-0 print:shadow-none">
        {/* 시트 헤더 */}
        <div className="border-b border-slate-200 p-6 print:border-b-2">
          <div className="flex items-start justify-between gap-4 print:block">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                {form.name_ko}
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                {formKeyLabel(locale, form.key)} ·{" "}
                {(locale === "ko" ? uni?.name_ko : uni?.name_vi) ??
                  uni?.name_ko ??
                  "?"}
                {(locale === "ko" ? uni?.name_vi : uni?.name_ko)
                  ? ` · ${locale === "ko" ? uni?.name_vi : uni?.name_ko}`
                  : ""}
                {form.department_name ? ` · ${form.department_name}` : ""}
              </p>
            </div>
            <div className="text-right text-sm print:text-left print:mt-2">
              <div className="font-semibold">{student.name}</div>
              <div className="text-xs text-slate-500">
                {tr(
                  locale,
                  `${filledFields} / ${totalFields} 입력 · 서술 ${essayQuestions.length}문항`,
                  `${filledFields} / ${totalFields} điền · ${essayQuestions.length} câu viết`
                )}
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 print:hidden">
            <PrintButton locale={locale} />
            <a
              href={`/center/students/${id}/forms/${formFileId}/hwpx`}
              download
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
            >
              {tr(locale, "⬇ HWPX 다운로드", "⬇ Tải HWPX")}
            </a>
            <Link
              href={`/center/students/${id}/data`}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50"
            >
              {tr(locale, "✎ 데이터 수정", "✎ Sửa dữ liệu")}
            </Link>
            <Link
              href={`/center/students/${id}/essays`}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50"
            >
              {tr(locale, "✎ AI 자기소개서 수정", "✎ Sửa bài luận AI")}
            </Link>
          </div>
        </div>

        {/* 데이터 필드 */}
        <div className="divide-y divide-slate-100 p-6 print:p-4">
          {totalFields === 0 ? (
            <p className="text-sm text-slate-500">
              {tr(
                locale,
                "이 양식에 필요한 데이터 항목이 아직 정의되지 않았습니다.",
                "Mẫu này chưa được định nghĩa trường dữ liệu cần thiết."
              )}
            </p>
          ) : (
            categoryOrder
              .filter((c) => byCategory.has(c))
              .map((cat) => (
                <section key={cat} className="py-3 print:py-2 first:pt-0">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 print:text-black">
                    {categoryLabelOf(locale, cat)}
                  </h3>
                  <dl className="grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2 print:grid-cols-2">
                    {byCategory.get(cat)!.map((f) => (
                      <DataRow
                        key={f.key}
                        locale={locale}
                        label_ko={f.label_ko}
                        label_vi={f.label_vi}
                        value={f.value}
                        input_type={f.input_type}
                      />
                    ))}
                  </dl>
                </section>
              ))
          )}
        </div>

        {/* 작문 결과 */}
        {essayQuestions.length > 0 ? (
          <div className="border-t-2 border-slate-200 p-6 print:p-4">
            <h2 className="mb-4 text-base font-semibold text-slate-900">
              {tr(locale, "서술형 문항", "Câu hỏi tự luận")}
            </h2>
            <div className="space-y-4">
              {essayQuestions.map((q, idx) => {
                const draft = draftMap.get(idx);
                const text = draft?.edited_text ?? draft?.generated_text ?? null;
                return (
                  <section
                    key={idx}
                    className="rounded-md border border-slate-200 p-4 print:break-inside-avoid"
                  >
                    <div className="text-sm font-semibold text-slate-900">
                      {idx + 1}.{" "}
                      {locale === "ko"
                        ? q.question_ko
                        : (q.question_vi ?? q.question_ko)}
                    </div>
                    {(locale === "ko" ? q.question_vi : q.question_ko) ? (
                      <div className="mt-0.5 text-xs text-slate-500">
                        {locale === "ko" ? q.question_vi : q.question_ko}
                      </div>
                    ) : null}
                    {q.max_chars ? (
                      <div className="mt-0.5 text-xs text-slate-400">
                        ≤ {tr(locale, `${q.max_chars}자`, `${q.max_chars} ký tự`)}
                      </div>
                    ) : null}
                    <div className="mt-2">
                      {text ? (
                        <div className="whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm leading-relaxed text-slate-800 print:bg-white print:border print:border-slate-300">
                          {text}
                          <div className="mt-2 text-xs text-slate-400 print:hidden">
                            (
                            {tr(locale, `${text.length}자`, `${text.length} ký tự`)}
                            {draft?.edited_text
                              ? tr(locale, " · 수정본", " · đã hiệu đính")
                              : tr(locale, " · AI 원본", " · bản AI gốc")}
                            )
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-md border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 print:border-slate-300 print:bg-white">
                          {tr(locale, "작성된 글이 없습니다. ", "Chưa có bài luận. Truy cập ")}
                          <Link
                            href={`/center/students/${id}/essays`}
                            className="underline"
                          >
                            {tr(locale, "AI 자기소개서", "Bài luận AI")}
                          </Link>
                          {tr(locale, " 에서 생성하세요.", " để tạo.")}
                        </div>
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DataRow({
  locale,
  label_ko,
  label_vi,
  value,
  input_type,
}: {
  locale: Locale;
  label_ko: string;
  label_vi: string;
  value: Json | undefined;
  input_type: string;
}) {
  const display = formatValue(locale, value, input_type);
  const isEmpty = display === "—" || display === "";

  const primaryLabel = locale === "ko" ? label_ko : label_vi;
  const secondaryLabel = locale === "ko" ? label_vi : label_ko;

  return (
    <div className="border-b border-slate-100 py-1.5 print:py-1">
      <dt className="text-xs text-slate-500">
        {primaryLabel}
        <span className="ml-1 text-slate-400">/ {secondaryLabel}</span>
      </dt>
      <dd
        className={`mt-0.5 text-sm ${
          isEmpty ? "text-amber-700 print:text-slate-400" : "text-slate-900"
        }`}
      >
        {isEmpty ? tr(locale, "⚠ 미입력", "⚠ Chưa nhập") : display}
      </dd>
    </div>
  );
}

function formatValue(
  locale: Locale,
  value: Json | undefined,
  input_type: string
): string {
  if (value === null || value === undefined || value === "") return "—";
  if (input_type === "boolean") return value === true ? "✓" : "—";
  if (input_type === "multi_select" && Array.isArray(value))
    return value.join(", ");
  if (input_type === "file" && typeof value === "object" && value !== null) {
    const v = value as { url?: string; file_name?: string };
    return (
      v.file_name ??
      v.url ??
      tr(locale, "(첨부 파일)", "(tệp đính kèm)")
    );
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
