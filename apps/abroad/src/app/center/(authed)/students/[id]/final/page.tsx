/**
 * /center/students/[id]/final — 최종 서류 탭.
 *   지원(대학/학과/학기)별로 최종 제출할 서류를 모아 다운로드.
 *     · 작성서류(form_files): 학생 데이터 채워 DOCX 생성·다운로드 (정보 충분/부족 표시)
 *     · 제출서류(submissions): 업로드한 파일을 규칙 파일명으로 리네임 다운로드
 *   준비 완료 여부(정보 충분 / 업로드됨)를 배지로 구분.
 */

import Link from "next/link";

import { verifyCenterSession } from "@/lib/center/dal";
import { createCenterClient } from "@/lib/supabase/center";
import { residenceFromStudentLocation } from "@/lib/admission/offering-languages";
import { classifyRequiredDocs } from "@/lib/admission/classify-documents";
import { loadFormDocKeys } from "@/lib/admission/form-doc-keys";
import {
  FORM_FILE_COLUMNS,
  formFileAppliesTo,
  loadApplicationDocuments,
  type SpecFormFile,
} from "@/lib/admission/spec-documents";
import { getLocale, tr } from "@/lib/i18n";
import { WriteRowActions } from "./write-row-actions";
import { AppSubmitBar } from "./app-submit-bar";

/** 양식 매칭용 이름 정규화 (앞 번호 "2." 제거 + 공백/대소문자 무시) */
function normFormName(s: string): string {
  return s
    .trim()
    .replace(/^\s*\d+[.)]\s*/, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

export default async function FinalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await verifyCenterSession();
  const locale = await getLocale();
  const supabase = await createCenterClient();
  const base = `/center/students/${id}`;

  const { data: student } = await supabase
    .from("study_managed_students")
    .select("id, name, location")
    .eq("id", id)
    .maybeSingle();
  if (!student) {
    return null;
  }
  const residence = residenceFromStudentLocation(student.location);

  const { data: apps } = await supabase
    .from("study_applications")
    .select(
      "id, admission_spec_id, target_department_id, term, target_department_label, selected_language"
    )
    .eq("student_id", id);
  const applications = apps ?? [];

  // 0067: 작성서류 양식은 지원의 요강 학과(spec_department_id)에서. 학과 없는 옛 지원만 이름 매칭 폴백.
  const [{ specs: specMap, deptByApp, byApp }, { data: files }] = await Promise.all([
    loadApplicationDocuments(supabase, applications),
    supabase
      .from("study_student_submission_files")
      .select("submission_id")
      .eq("student_id", id),
  ]);
  const uploadedSubs = new Set((files ?? []).map((f) => f.submission_id));
  const needsLegacy = applications.some((a) => !byApp.get(a.id));
  const formDocKeys = needsLegacy ? await loadFormDocKeys(supabase) : new Set<string>();

  // 작성서류 완성본/제출 상태 — (form_file_id::application_id) → {path, fileName, uploadedAt, submittedAt}
  const { data: finalDocs } = await supabase
    .from("study_student_final_docs")
    .select("form_file_id, application_id, file_path, file_name, finalized_at, submitted_at")
    .eq("student_id", id);
  const finalMap = new Map(
    (finalDocs ?? []).map((d) => [
      `${d.form_file_id}::${d.application_id}`,
      {
        path: d.file_path,
        fileName: d.file_name,
        uploadedAt: d.finalized_at,
        submittedAt: d.submitted_at as string | null,
      },
    ])
  );

  const uniIds = Array.from(new Set(Array.from(specMap.values()).map((s) => s.university_id)));
  const [{ data: unis }, { data: legacyForms }, { data: subs }] = await Promise.all([
    uniIds.length > 0
      ? supabase.from("universities").select("id, name_ko, name_vi").in("id", uniIds)
      : Promise.resolve({ data: [] as Array<{ id: number; name_ko: string; name_vi: string | null }> }),
    needsLegacy && uniIds.length > 0
      ? supabase
          .from("study_admission_form_files")
          .select(FORM_FILE_COLUMNS)
          .in("university_id", uniIds)
          .eq("is_current", true)
      : Promise.resolve({ data: [] as unknown[] }),
    supabase
      .from("study_required_submissions")
      .select("id, university_id, department_id, name_ko, applies_to_languages, applies_to_locations")
      .eq("is_active", true)
      .eq("status", "approved"),
  ]);
  const uniMap = new Map((unis ?? []).map((u) => [u.id, u]));
  const uniName = (uid: number) => {
    const u = uniMap.get(uid);
    return (locale === "ko" ? u?.name_ko : u?.name_vi) ?? u?.name_ko ?? `#${uid}`;
  };

  const legacyFormFiles = (legacyForms ?? []) as unknown as SpecFormFile[];

  // 지원별 묶음
  const groups = applications.map((a) => {
    const spec = specMap.get(a.admission_spec_id);
    const uni = spec?.university_id ?? null;
    const docs = byApp.get(a.id) ?? null;

    // 직접작성 행: {doc(키·이름), file(양식파일)}
    //   학과가 풀리면 학과의 현행 양식 파일이 곧 목록. 옛 지원은 JSONB 작성서류 → 양식파일에 key|이름 매칭.
    let pairs: Array<{ doc: { key: string; name_ko: string }; file: SpecFormFile | null }>;
    if (docs) {
      pairs = docs.formFiles.map((file) => ({ doc: { key: file.key, name_ko: file.name_ko }, file }));
    } else {
      const uniForms = legacyFormFiles.filter((f) =>
        formFileAppliesTo(f, {
          dept: deptByApp.get(a.id),
          universityId: uni,
          departmentLabel: a.target_department_label,
        })
      );
      const byKey = new Map(uniForms.map((f) => [f.key, f] as const));
      const byName = new Map(
        uniForms.map((f) => [normFormName(f.name_ko), f] as const)
      );
      const { forms: docForms } = classifyRequiredDocs(spec?.required_documents ?? [], formDocKeys);
      pairs = docForms.map((doc) => ({
        doc,
        file: byKey.get(doc.key) ?? byName.get(normFormName(doc.name_ko)) ?? null,
      }));
    }
    const writeRows = pairs.map(({ doc, file }) => {
      const overlayCount = Array.isArray(file?.field_overlays)
        ? (file!.field_overlays as unknown[]).length
        : 0;
      const isPdf = file
        ? (file.mime_type ?? "").toLowerCase().includes("pdf") ||
          file.file_name.toLowerCase().endsWith(".pdf") ||
          file.file_url.toLowerCase().includes(".pdf")
        : false;
      const isDocx = file
        ? (file.mime_type ?? "").toLowerCase().includes("word") ||
          file.file_name.toLowerCase().endsWith(".docx") ||
          file.file_url.toLowerCase().includes(".docx")
        : false;
      const engine: "pdf" | "docx" = isPdf ? "pdf" : "docx";
      // PDF: 좌표 오버레이 필요 / DOCX: 토큰 자동채움(오버레이 불필요)
      const canFill = !!file && ((isPdf && overlayCount > 0) || isDocx);
      const final = file ? finalMap.get(`${file.id}::${a.id}`) ?? null : null;
      // 서술형(자기소개서 등) 문항이 있는 양식 → AI 자기소개서 진입 버튼 노출
      const hasEssay =
        !!file?.is_essay &&
        Array.isArray(file.essay_sections) &&
        (file.essay_sections as unknown[]).length > 0;
      return { doc, file, canFill, engine, final, hasEssay };
    });
    // 완성본은 올라왔지만 아직 최종 제출 안 된 작성서류 수 (일괄 제출용)
    const readyCount = writeRows.filter(
      (r) => r.final && r.final.path && !r.final.submittedAt
    ).length;

    const submitDocs = (subs ?? []).filter((s) => {
      const uniMatch = s.university_id == null || s.university_id === uni;
      const deptMatch =
        s.department_id == null || s.department_id === a.target_department_id;
      const langs = (s.applies_to_languages ?? []) as string[];
      const locs = (s.applies_to_locations ?? []) as string[];
      const langOk =
        langs.length === 0 ||
        (a.selected_language != null && langs.includes(a.selected_language));
      const locOk = locs.length === 0 || locs.includes(residence);
      return uniMatch && deptMatch && langOk && locOk;
    });
    return { app: a, spec, term: a.term ?? spec?.term ?? "", writeRows, submitDocs, readyCount };
  });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-bold text-slate-900">
          {tr(locale, "최종 서류", "Hồ sơ cuối")}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {tr(
            locale,
            "지원별 제출 서류입니다. 작성서류는 초안을 내려받아 서명·보정한 뒤 완성본을 올리고 [제출]해야 완료됩니다.",
            "Hồ sơ theo từng nguyện vọng. Với hồ sơ soạn: tải bản nháp, ký & chỉnh sửa, rồi tải bản hoàn chỉnh lên và [Nộp]."
          )}
        </p>
      </header>

      <div className="rounded-lg border border-sky-200 bg-sky-50/60 px-4 py-3 text-xs leading-relaxed text-sky-800">
        {tr(
          locale,
          "작성서류 진행 순서: ① [초안 생성·다운로드]로 기본정보 채운 파일을 받아 → ② 서명·수기 보정 → ③ [완성본 업로드] → ④ [제출]. 제출한 서류만 글로케어(본사)에서 확인합니다.",
          "Quy trình: ① Tải bản nháp đã điền thông tin → ② Ký & chỉnh sửa tay → ③ Tải bản hoàn chỉnh lên → ④ Nộp. Chỉ hồ sơ đã nộp mới hiển thị cho GLOCARE."
        )}
      </div>

      {groups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
          {tr(
            locale,
            "선택한 대학이 없습니다. '대학 선택'에서 먼저 지원을 등록하세요.",
            "Chưa chọn trường. Hãy đăng ký ở 'Chọn trường'."
          )}
        </div>
      ) : (
        groups.map(({ app, spec, term, writeRows, submitDocs, readyCount }) => (
          <section
            key={app.id}
            className="rounded-lg border border-slate-200 bg-white p-6"
          >
            <div className="mb-3">
              <h2 className="text-base font-semibold text-slate-900">
                {spec ? uniName(spec.university_id) : "—"}
                {app.target_department_label ? ` · ${app.target_department_label}` : ""}
              </h2>
              <p className="text-xs text-slate-500">{term}</p>
            </div>

            {/* 작성서류 */}
            <div className="mb-4">
              <h3 className="mb-1.5 text-sm font-medium text-slate-700">
                {tr(locale, "작성서류 (초안 → 완성본 → 제출)", "Hồ sơ soạn (nháp → sửa → nộp)")}
              </h3>
              {writeRows.length === 0 ? (
                <p className="pl-1 text-xs text-slate-400">
                  {tr(locale, "없음", "Không có")}
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {writeRows.map(({ doc, file, canFill, engine, final, hasEssay }) => (
                    <li
                      key={doc.key + doc.name_ko}
                      className="flex flex-wrap items-start justify-between gap-2 rounded-md border border-slate-100 bg-slate-50/50 px-3 py-2"
                    >
                      <div className="space-y-1 pt-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-slate-800">
                            {doc.name_ko}
                          </span>
                          {!file ? (
                            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] text-slate-600">
                              {tr(locale, "양식 미등록", "Chưa có mẫu")}
                            </span>
                          ) : null}
                          {canFill ? (
                            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] text-sky-700">
                              {tr(locale, "원본양식 채움", "Điền vào mẫu gốc")}
                            </span>
                          ) : null}
                          {hasEssay ? (
                            <Link
                              href={`${base}/essays`}
                              className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700 hover:bg-violet-100"
                            >
                              ✍️ {tr(locale, "AI 자기소개서 작성 →", "Soạn bài luận AI →")}
                            </Link>
                          ) : null}
                        </div>
                      </div>
                      {file ? (
                        <div className="flex-1">
                          <WriteRowActions
                            locale={locale}
                            studentId={id}
                            formFileId={file.id}
                            appId={app.id}
                            docName={doc.name_ko}
                            blankFormUrl={file.file_url}
                            pdfBaseUrl={
                              canFill
                                ? engine === "pdf"
                                  ? `${base}/final/pdf?form=${file.id}&app=${app.id}`
                                  : `${base}/final/docx-fill?form=${file.id}&app=${app.id}`
                                : null
                            }
                            uploaded={
                              final && final.path
                                ? {
                                    path: final.path,
                                    fileName: final.fileName,
                                    uploadedAt: final.uploadedAt,
                                  }
                                : null
                            }
                            submittedAt={final?.submittedAt ?? null}
                            noFillLabel={tr(
                              locale,
                              "초안 자동생성 불가 — 빈 양식 받아 직접 작성 후 업로드",
                              "Không tạo được nháp — tải mẫu trống, điền tay rồi tải lên"
                            )}
                          />
                        </div>
                      ) : (
                        <span className="shrink-0 pt-1 text-[11px] text-slate-400">
                          {tr(locale, "글로케어에서 양식 등록 필요", "Cần đăng ký mẫu")}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <AppSubmitBar
                locale={locale}
                studentId={id}
                appId={app.id}
                readyCount={readyCount}
              />
            </div>

            {/* 제출서류 */}
            <div>
              <h3 className="mb-1.5 text-sm font-medium text-slate-700">
                {tr(locale, "제출서류 (업로드)", "Hồ sơ nộp")}
              </h3>
              {submitDocs.length === 0 ? (
                <p className="pl-1 text-xs text-slate-400">
                  {tr(locale, "없음", "Không có")}
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {submitDocs.map((s) => {
                    const uploaded = uploadedSubs.has(s.id);
                    return (
                      <li
                        key={s.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-100 bg-slate-50/50 px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-800">
                            {s.name_ko}
                          </span>
                          {uploaded ? (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-700">
                              {tr(locale, "업로드됨", "Đã tải")}
                            </span>
                          ) : (
                            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] text-slate-600">
                              {tr(locale, "미업로드", "Chưa tải")}
                            </span>
                          )}
                        </div>
                        {uploaded ? (
                          <a
                            href={`${base}/final/submission?sub=${s.id}&app=${app.id}`}
                            className="shrink-0 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            {tr(locale, "다운로드", "Tải")}
                          </a>
                        ) : (
                          <Link
                            href={`${base}/documents`}
                            className="shrink-0 rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100"
                          >
                            {tr(locale, "서류 등록에서 올리기", "Tải ở 'Tải giấy tờ'")}
                          </Link>
                        )}
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
