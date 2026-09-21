/**
 * /center/students/[id]/documents — 서류 등록 탭 (지원별 분리).
 *   그룹 로딩·dedup·파일해소는 lib/admission/student-documents(공용). 여기선 렌더만.
 */

import Link from "next/link";
import { notFound } from "next/navigation";

import { verifyCenterSession } from "@/lib/center/dal";
import { createCenterClient } from "@/lib/supabase/center";
import { getLocale, tr, type Locale } from "@/lib/i18n";
import { docUploadKey } from "@/lib/admission/classify-documents";
import { loadDocumentGroups } from "@/lib/admission/student-documents";

import { SubmissionUploader } from "./submission-uploader";
import { ImportFileButton } from "./import-file-button";

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

  const { groups, hasAnyApp } = await loadDocumentGroups(supabase, id, locale);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-bold text-slate-900">
          {tr(locale, "서류 등록", "Tải giấy tờ")}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {tr(
            locale,
            "지원한 대학별 필요 서류입니다. 여러 대학에서 요구하는 공용 서류는 한 번만 올리면 모두 등록됩니다.",
            "Giấy tờ theo từng trường. Giấy tờ dùng chung chỉ cần tải một lần."
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

      {!hasAnyApp ? (
        <div className="rounded-md border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-400">
          {tr(
            locale,
            "먼저 '지원 등록'에서 대학·학과를 연결하면 필요한 서류가 표시됩니다.",
            "Hãy đăng ký nguyện vọng (trường·ngành) để xem giấy tờ cần thiết."
          )}
        </div>
      ) : (
        groups.map((g) => (
          <section
            key={g.appId}
            className="rounded-lg border border-slate-200 bg-white p-6"
          >
            <div className="mb-3">
              <h2 className="text-base font-semibold text-slate-900">{g.label}</h2>
              <p className="text-xs text-slate-500">{g.term}</p>
            </div>

            {/* 1) 발급 서류 */}
            <div className="mb-4">
              <div className="mb-1 flex items-center justify-between">
                <h3 className="text-sm font-medium text-slate-700">
                  {tr(locale, "발급 서류", "Giấy tờ cần xin cấp")}
                  <span className="ml-2 rounded bg-rose-50 px-1.5 py-0.5 text-[11px] font-medium text-rose-600">
                    {tr(locale, "우선", "Ưu tiên")}
                  </span>
                </h3>
                {g.issued.length > 0 ? (
                  <span className="shrink-0 text-xs text-slate-500">
                    {tr(locale, "업로드", "Đã tải")} {g.uploadedCount}/{g.issued.length}
                  </span>
                ) : null}
              </div>
              <div className="mb-3 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
                {tr(
                  locale,
                  "💡 이 파일들을 올리면 AI가 내용을 읽어 '정보 입력'을 자동으로 채워 드립니다.",
                  "💡 Khi tải các tệp này lên, AI sẽ đọc nội dung và tự điền sẵn bước 'Nhập thông tin'."
                )}
              </div>
              {g.issued.length === 0 ? (
                <p className="text-sm text-slate-400">
                  {tr(locale, "발급 서류가 없습니다.", "Không có giấy tờ cần xin cấp.")}
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {g.issued.map((it) => {
                    const nota = notarizationLabel(locale, it.notarization);
                    return (
                      <li
                        key={it.shareKey}
                        className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-slate-900">
                              {it.name_ko}
                            </span>
                            {it.name_vi ? (
                              <span className="text-xs text-slate-500">
                                {it.name_vi}
                              </span>
                            ) : null}
                            {!it.required ? (
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">
                                {tr(locale, "선택", "Tùy chọn")}
                              </span>
                            ) : null}
                            {it.shared ? (
                              <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200">
                                {tr(
                                  locale,
                                  "공용 — 한 번만 업로드",
                                  "Dùng chung — tải 1 lần"
                                )}
                              </span>
                            ) : null}
                          </div>
                          {nota ? (
                            <div className="mt-1 text-xs text-amber-700">
                              {tr(locale, "인증", "Chứng thực")}: {nota}
                            </div>
                          ) : null}
                          {it.notes ? (
                            <p className="mt-1 whitespace-pre-wrap text-xs text-slate-400">
                              {it.notes}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          <SubmissionUploader
                            locale={locale}
                            studentId={id}
                            docKey={it.usedKey}
                            existing={it.file}
                            autoExtract
                          />
                          {it.importCandidate ? (
                            <ImportFileButton
                              locale={locale}
                              studentId={id}
                              fromDocKey={it.importCandidate.docKey}
                              toDocKey={it.shareKey}
                              sourceLabel={it.importCandidate.sourceLabel}
                              fileName={it.importCandidate.fileName}
                            />
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* 2) 직접작성 서류 — 목록만 (업로드는 '최종 서류' 탭) */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-medium text-slate-700">
                  {tr(locale, "직접작성 서류 (학교 양식)", "Giấy tờ tự điền (mẫu trường)")}
                </h3>
                {g.formDocs.length > 0 ? (
                  <Link
                    href={`/center/students/${id}/final`}
                    className="shrink-0 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    {tr(locale, "최종 서류로 이동 →", "Đến 'Hồ sơ cuối' →")}
                  </Link>
                ) : null}
              </div>
              <div className="mb-2 mt-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                {tr(
                  locale,
                  "'정보 입력'을 채우면 시스템이 초안을 만들어 줍니다. 초안 다운로드·완성본 업로드는 '최종 서류' 탭에서.",
                  "Hệ thống tạo bản nháp khi điền 'Nhập thông tin'. Tải nháp & bản hoàn chỉnh ở tab 'Hồ sơ cuối'."
                )}
              </div>
              {g.formDocs.length === 0 ? (
                <p className="text-sm text-slate-400">
                  {tr(locale, "직접작성 서류가 없습니다.", "Không có giấy tờ tự điền.")}
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {g.formDocs.map((d) => {
                    const nota = notarizationLabel(locale, d.notarization);
                    return (
                      <li key={docUploadKey(d)} className="py-2 first:pt-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-slate-900">
                            {d.name_ko}
                          </span>
                          {d.name_vi ? (
                            <span className="text-xs text-slate-500">{d.name_vi}</span>
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
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
