/**
 * /center/students/[id]/documents — 서류 등록 탭.
 *   목록은 학생이 지원한 **모집요강(required_documents)** 에서 파생 + 자동분류:
 *   - 발급 서류(issued): 업로드 필수(우선순위 높음). 올리면 AI 가 정보입력을 도움.
 *   - 직접작성(form)  : 정보입력으로 시스템 작성 가능 → 업로드는 선택(필수 아님).
 *   업로드는 문서 key(doc_key) 로 식별 (발급서류 별도 등록 없이도 가능).
 */

import { notFound } from "next/navigation";

import { verifyCenterSession } from "@/lib/center/dal";
import { createCenterClient } from "@/lib/supabase/center";
import { getLocale, tr, type Locale } from "@/lib/i18n";
import {
  classifyRequiredDocs,
  docUploadKey,
  type ClassifiedDoc,
  type RequiredDoc,
} from "@/lib/admission/classify-documents";

import { SubmissionUploader } from "./submission-uploader";

const NOTARIZATION_LABEL: Record<string, { ko: string; vi: string }> = {
  translation_notarization: { ko: "번역 공증", vi: "Công chứng dịch" },
  consul: { ko: "영사확인", vi: "Xác nhận lãnh sự" },
  consul_for_vietnam: { ko: "베트남 영사확인", vi: "Xác nhận lãnh sự VN" },
  apostille: { ko: "아포스티유", vi: "Apostille" },
  apostille_or_consul: { ko: "아포스티유/영사확인", vi: "Apostille/lãnh sự" },
};

function notarizationLabel(locale: Locale, v: string | null): string | null {
  if (!v || v === "none") return null;
  const l = NOTARIZATION_LABEL[v];
  return l ? tr(locale, l.ko, l.vi) : v;
}

export default async function DocumentsPage({
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

  // 학생이 지원한 모집요강 → required_documents 파생
  const { data: apps } = await supabase
    .from("study_applications")
    .select("admission_spec_id")
    .eq("student_id", id);
  const specIds = Array.from(
    new Set((apps ?? []).map((a) => a.admission_spec_id).filter(Boolean))
  );

  const [{ data: specs }, { data: files }] = await Promise.all([
    specIds.length > 0
      ? supabase
          .from("study_admission_specs")
          .select("id, required_documents")
          .in("id", specIds)
      : Promise.resolve({
          data: [] as Array<{ id: string; required_documents: unknown }>,
        }),
    supabase
      .from("study_student_submission_files")
      .select("doc_key, file_name, file_path")
      .eq("student_id", id),
  ]);

  // 여러 지원(spec) 의 문서를 합쳐 분류 + 중복 제거(uploadKey 기준)
  const formMap = new Map<string, ClassifiedDoc>();
  const issuedMap = new Map<string, ClassifiedDoc>();
  for (const s of specs ?? []) {
    const { forms, issued } = classifyRequiredDocs(
      (s.required_documents as RequiredDoc[]) ?? []
    );
    for (const f of forms) formMap.set(docUploadKey(f), f);
    for (const it of issued) issuedMap.set(docUploadKey(it), it);
  }
  const forms = Array.from(formMap.values());
  const issued = Array.from(issuedMap.values());

  const fileByDocKey = new Map(
    (files ?? [])
      .filter((f) => f.doc_key)
      .map((f) => [
        f.doc_key as string,
        { file_name: f.file_name, file_path: f.file_path },
      ])
  );

  const hasAnyDoc = forms.length > 0 || issued.length > 0;
  const issuedUploaded = issued.filter((d) =>
    fileByDocKey.has(docUploadKey(d))
  ).length;

  const renderDoc = (d: ClassifiedDoc) => {
    const uploadKey = docUploadKey(d);
    const nota = notarizationLabel(locale, d.notarization);
    return (
      <li
        key={uploadKey}
        className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-slate-900">{d.name_ko}</span>
            {d.name_vi ? (
              <span className="text-xs text-slate-500">{d.name_vi}</span>
            ) : null}
            {!d.required ? (
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">
                {tr(locale, "선택", "Tùy chọn")}
              </span>
            ) : null}
          </div>
          {nota ? (
            <div className="mt-1 text-xs text-amber-700">
              {tr(locale, "인증", "Chứng thực")}: {nota}
            </div>
          ) : null}
          {d.notes ? (
            <p className="mt-1 whitespace-pre-wrap text-xs text-slate-400">
              {d.notes}
            </p>
          ) : null}
        </div>
        <SubmissionUploader
          locale={locale}
          studentId={id}
          docKey={uploadKey}
          existing={fileByDocKey.get(uploadKey) ?? null}
        />
      </li>
    );
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-bold text-slate-900">
          {tr(locale, "서류 등록", "Tải giấy tờ")}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {tr(
            locale,
            "지원한 모집요강 기준으로 필요한 서류 목록입니다.",
            "Danh sách giấy tờ theo hồ sơ tuyển sinh đã đăng ký."
          )}
        </p>
        <p className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">
          {tr(
            locale,
            "업로드 형식: PDF · 이미지(JPG·PNG·HEIC) / 최대 20MB",
            "Định dạng: PDF · ảnh (JPG·PNG·HEIC) / tối đa 20MB"
          )}
        </p>
      </header>

      {!hasAnyDoc ? (
        <div className="rounded-md border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-400">
          {specIds.length === 0
            ? tr(
                locale,
                "먼저 '지원 등록'에서 대학·학과를 연결하면 필요한 서류가 표시됩니다.",
                "Hãy đăng ký nguyện vọng (trường·ngành) để xem giấy tờ cần thiết."
              )
            : tr(
                locale,
                "모집요강에 등록된 서류가 없습니다.",
                "Hồ sơ tuyển sinh chưa có giấy tờ."
              )}
        </div>
      ) : (
        <>
          {/* 1) 발급 서류 — 우선순위 높음, 업로드 필수 */}
          <section className="rounded-lg border border-slate-200 bg-white p-6">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">
                {tr(locale, "발급 서류", "Giấy tờ cần xin cấp")}
                <span className="ml-2 rounded bg-rose-50 px-1.5 py-0.5 text-[11px] font-medium text-rose-600">
                  {tr(locale, "우선", "Ưu tiên")}
                </span>
              </h2>
              {issued.length > 0 ? (
                <span className="shrink-0 text-xs text-slate-500">
                  {tr(locale, "업로드", "Đã tải")} {issuedUploaded}/{issued.length}
                </span>
              ) : null}
            </div>
            <div className="mb-3 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
              {tr(
                locale,
                "💡 이 파일들을 올리면 AI가 내용을 읽어 다음 단계 '정보 입력'을 자동으로 채워 드립니다. 먼저 올려 주세요.",
                "💡 Khi tải các tệp này lên, AI sẽ đọc nội dung và tự điền sẵn bước 'Nhập thông tin'. Hãy tải lên trước."
              )}
            </div>
            {issued.length === 0 ? (
              <p className="text-sm text-slate-400">
                {tr(locale, "발급 서류가 없습니다.", "Không có giấy tờ cần xin cấp.")}
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">{issued.map(renderDoc)}</ul>
            )}
          </section>

          {/* 2) 직접작성 서류 — 정보입력으로 작성 가능, 업로드 선택 */}
          <section className="rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="text-base font-semibold text-slate-900">
              {tr(locale, "직접작성 서류 (학교 양식)", "Giấy tờ tự điền (mẫu trường)")}
            </h2>
            <div className="mb-3 mt-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              {tr(
                locale,
                "이 서류들은 '정보 입력'을 채우면 시스템이 자동으로 만들어 줍니다. 업로드는 선택이며 필수가 아닙니다.",
                "Các giấy tờ này sẽ được hệ thống tạo tự động khi bạn điền 'Nhập thông tin'. Tải lên là tùy chọn, không bắt buộc."
              )}
            </div>
            {forms.length === 0 ? (
              <p className="text-sm text-slate-400">
                {tr(locale, "직접작성 서류가 없습니다.", "Không có giấy tờ tự điền.")}
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">{forms.map(renderDoc)}</ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
