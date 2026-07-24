/**
 * /student/documents — 셀프 학생 서류 등록(발급서류 업로드).
 *   그룹 로딩·dedup·파일해소는 lib/admission/student-documents(센터와 공용).
 *   업로더/가져오기 컴포넌트도 센터와 동일 재사용(액션이 세션 자동 판별).
 */

import Link from "next/link";

import { verifyStudentSession } from "@/lib/student/dal";
import { createClient } from "@/lib/supabase/server";
import { getLocale, tr, type Locale } from "@/lib/i18n";
import { docUploadKey } from "@/lib/admission/classify-documents";
import { loadDocumentGroups } from "@/lib/admission/student-documents";

import { SubmissionUploader } from "@/app/center/(authed)/students/[id]/documents/submission-uploader";
import { ImportFileButton } from "@/app/center/(authed)/students/[id]/documents/import-file-button";

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

export const dynamic = "force-dynamic";

export default async function StudentDocumentsPage() {
  const session = await verifyStudentSession();
  const locale = await getLocale();
  const supabase = await createClient();
  const studentId = session.student.id;

  const { groups, hasAnyApp } = await loadDocumentGroups(
    supabase,
    studentId,
    locale
  );

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/student/applications"
          className="text-sm text-slate-500 hover:underline"
        >
          {tr(locale, "← 내 지원", "← Hồ sơ của tôi")}
        </Link>
        <h1 className="mt-2 text-xl font-bold text-slate-900">
          {tr(locale, "서류 등록", "Tải giấy tờ")}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {tr(
            locale,
            "지원한 대학별 필요 서류입니다. 여러 대학에서 요구하는 공용 서류는 한 번만 올리면 됩니다.",
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
      </div>

      {!hasAnyApp ? (
        <div className="rounded-md border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-400">
          {tr(
            locale,
            "먼저 대학을 찾아 지원하면 필요한 서류가 표시됩니다.",
            "Hãy tìm & đăng ký trường để xem giấy tờ cần thiết."
          )}
        </div>
      ) : (
        groups.map((g) => (
          <section
            key={g.appId}
            className="rounded-lg border border-slate-200 bg-white p-5"
          >
            <div className="mb-3">
              <h2 className="text-base font-semibold text-slate-900">{g.label}</h2>
              <p className="text-xs text-slate-500">{g.term}</p>
            </div>

            {/* 발급 서류 */}
            <div className="mb-4">
              <div className="mb-1 flex items-center justify-between">
                <h3 className="text-sm font-medium text-slate-700">
                  {tr(locale, "발급 서류", "Giấy tờ cần xin cấp")}
                </h3>
                {g.issued.length > 0 ? (
                  <span className="shrink-0 text-xs text-slate-500">
                    {tr(locale, "업로드", "Đã tải")} {g.uploadedCount}/{g.issued.length}
                  </span>
                ) : null}
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
                            studentId={studentId}
                            docKey={it.usedKey}
                            existing={it.file}
                          />
                          {it.importCandidate ? (
                            <ImportFileButton
                              locale={locale}
                              studentId={studentId}
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

            {/* 직접작성 서류 → 작성 서류 탭 */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-medium text-slate-700">
                  {tr(locale, "직접작성 서류 (학교 양식)", "Giấy tờ tự điền (mẫu trường)")}
                </h3>
                {g.formDocs.length > 0 ? (
                  <Link
                    href="/student/final"
                    className="shrink-0 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    {tr(locale, "작성 서류로 이동 →", "Đến 'Hồ sơ soạn' →")}
                  </Link>
                ) : null}
              </div>
              {g.formDocs.length === 0 ? (
                <p className="mt-1 text-sm text-slate-400">
                  {tr(locale, "직접작성 서류가 없습니다.", "Không có giấy tờ tự điền.")}
                </p>
              ) : (
                <ul className="mt-1 divide-y divide-slate-100">
                  {g.formDocs.map((d) => (
                    <li key={docUploadKey(d)} className="py-2 first:pt-0">
                      <span className="text-sm font-medium text-slate-900">
                        {d.name_ko}
                      </span>
                      {d.name_vi ? (
                        <span className="ml-2 text-xs text-slate-500">
                          {d.name_vi}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
