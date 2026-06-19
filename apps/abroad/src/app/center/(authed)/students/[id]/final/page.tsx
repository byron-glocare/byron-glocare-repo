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
import {
  classifyRequiredDocs,
  type RequiredDoc,
} from "@/lib/admission/classify-documents";
import { getLocale, tr } from "@/lib/i18n";
import { WriteRowActions } from "./write-row-actions";

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
      "id, admission_spec_id, target_department_id, target_department_label, selected_language"
    )
    .eq("student_id", id);
  const applications = apps ?? [];
  const specIds = Array.from(
    new Set(applications.map((a) => a.admission_spec_id))
  );

  const [{ data: specs }, { data: vals }, { data: files }] = await Promise.all([
    specIds.length > 0
      ? supabase
          .from("study_admission_specs")
          .select("id, university_id, term, required_documents")
          .in("id", specIds)
      : Promise.resolve({
          data: [] as Array<{
            id: string;
            university_id: number;
            term: string;
            required_documents: unknown;
          }>,
        }),
    supabase
      .from("study_student_data_values")
      .select("data_type_key")
      .eq("student_id", id),
    supabase
      .from("study_student_submission_files")
      .select("submission_id")
      .eq("student_id", id),
  ]);
  const specMap = new Map((specs ?? []).map((s) => [s.id, s]));
  const filledKeys = new Set((vals ?? []).map((v) => v.data_type_key));
  const uploadedSubs = new Set((files ?? []).map((f) => f.submission_id));

  const uniIds = Array.from(new Set((specs ?? []).map((s) => s.university_id)));
  const [{ data: unis }, { data: forms }, { data: subs }] = await Promise.all([
    uniIds.length > 0
      ? supabase.from("universities").select("id, name_ko, name_vi").in("id", uniIds)
      : Promise.resolve({ data: [] as Array<{ id: number; name_ko: string; name_vi: string | null }> }),
    uniIds.length > 0
      ? supabase
          .from("study_admission_form_files")
          .select(
            "id, university_id, department_name, name_ko, key, required_data_type_keys, field_overlays, mime_type, file_name, file_url"
          )
          .in("university_id", uniIds)
          .eq("is_current", true)
      : Promise.resolve({
          data: [] as Array<{
            id: string;
            university_id: number;
            department_name: string | null;
            name_ko: string;
            key: string;
            required_data_type_keys: string[] | null;
            field_overlays: unknown;
            mime_type: string | null;
            file_name: string;
            file_url: string;
          }>,
        }),
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

  // 지원별 묶음
  const groups = applications.map((a) => {
    const spec = specMap.get(a.admission_spec_id);
    const uni = spec?.university_id ?? null;

    // 직접작성 = 모집요강에서 파생(자동분류·중복제거) → 현재 양식파일에 key|이름으로 매칭
    const uniForms = (forms ?? []).filter(
      (f) =>
        f.university_id === uni &&
        (f.department_name == null ||
          f.department_name === a.target_department_label)
    );
    const byKey = new Map(uniForms.map((f) => [f.key, f] as const));
    const byName = new Map(
      uniForms.map((f) => [normFormName(f.name_ko), f] as const)
    );
    const { forms: docForms } = classifyRequiredDocs(
      (spec?.required_documents as RequiredDoc[]) ?? []
    );
    const writeRows = docForms.map((doc) => {
      const file =
        byKey.get(doc.key) ?? byName.get(normFormName(doc.name_ko)) ?? null;
      const ready = file
        ? (file.required_data_type_keys ?? []).every((k) => filledKeys.has(k))
        : false;
      // 좌표 오버레이가 있는 PDF 양식 → 원본에 채운 PDF 생성 (미리보기 가능)
      const overlays = Array.isArray(file?.field_overlays)
        ? (file!.field_overlays as Array<{
            key: string;
            kind?: string;
            source?: string;
            inputLabel?: string;
            inputType?: string;
            datePart?: "year" | "month" | "day";
          }>)
        : [];
      // 생성 시 입력받을 칸 (kind=text, source=input). 년/월/일 분리 박스는
      // inputLabel 로 한 입력을 공유 → 날짜 한 번만 받음.
      const seenInput = new Set<string>();
      const inputFields: { key: string; label: string; type: string }[] = [];
      for (const o of overlays) {
        if ((o.kind ?? "text") !== "text" || o.source !== "input") continue;
        const fieldKey = o.datePart
          ? `datelabel:${o.inputLabel || "작성일"}`
          : o.key;
        if (seenInput.has(fieldKey)) continue;
        seenInput.add(fieldKey);
        inputFields.push({
          key: fieldKey,
          label: o.inputLabel || "입력",
          type: o.datePart ? "date" : o.inputType === "text" ? "text" : "date",
        });
      }
      const isPdf = file
        ? (file.mime_type ?? "").toLowerCase().includes("pdf") ||
          file.file_name.toLowerCase().endsWith(".pdf") ||
          file.file_url.toLowerCase().includes(".pdf")
        : false;
      const canFill = !!file && isPdf && overlays.length > 0;
      return { doc, file, ready, canFill, inputFields: canFill ? inputFields : [] };
    });

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
    return { app: a, spec, writeRows, submitDocs };
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
            "지원별 최종 제출 서류입니다. 작성서류는 생성·다운로드, 제출서류는 업로드 파일을 규칙 파일명으로 내려받습니다.",
            "Hồ sơ cuối theo từng nguyện vọng. Hồ sơ soạn: tạo & tải; hồ sơ nộp: tải tệp đã upload với tên chuẩn."
          )}
        </p>
      </header>

      {groups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
          {tr(
            locale,
            "선택한 대학이 없습니다. '대학 선택'에서 먼저 지원을 등록하세요.",
            "Chưa chọn trường. Hãy đăng ký ở 'Chọn trường'."
          )}
        </div>
      ) : (
        groups.map(({ app, spec, writeRows, submitDocs }) => (
          <section
            key={app.id}
            className="rounded-lg border border-slate-200 bg-white p-6"
          >
            <div className="mb-3">
              <h2 className="text-base font-semibold text-slate-900">
                {spec ? uniName(spec.university_id) : "—"}
                {app.target_department_label ? ` · ${app.target_department_label}` : ""}
              </h2>
              <p className="text-xs text-slate-500">{spec?.term ?? ""}</p>
            </div>

            {/* 작성서류 */}
            <div className="mb-4">
              <h3 className="mb-1.5 text-sm font-medium text-slate-700">
                {tr(locale, "작성서류 (생성)", "Hồ sơ soạn")}
              </h3>
              {writeRows.length === 0 ? (
                <p className="pl-1 text-xs text-slate-400">
                  {tr(locale, "없음", "Không có")}
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {writeRows.map(({ doc, file, ready, canFill, inputFields }) => (
                    <li
                      key={doc.key + doc.name_ko}
                      className="flex flex-wrap items-start justify-between gap-2 rounded-md border border-slate-100 bg-slate-50/50 px-3 py-2"
                    >
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-sm font-medium text-slate-800">
                          {doc.name_ko}
                        </span>
                        {!file ? (
                          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] text-slate-600">
                            {tr(locale, "양식 미등록", "Chưa có mẫu")}
                          </span>
                        ) : ready ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-700">
                            {tr(locale, "정보 충분", "Đủ thông tin")}
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-700">
                            {tr(locale, "정보 부족", "Thiếu thông tin")}
                          </span>
                        )}
                        {canFill ? (
                          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] text-sky-700">
                            {tr(locale, "원본양식 채움", "Điền vào mẫu gốc")}
                          </span>
                        ) : null}
                      </div>
                      {file ? (
                        <div className="min-w-[180px] flex-1">
                          <WriteRowActions
                            docxUrl={`${base}/final/docx?form=${file.id}&app=${app.id}`}
                            pdfBaseUrl={
                              canFill
                                ? `${base}/final/pdf?form=${file.id}&app=${app.id}`
                                : null
                            }
                            inputFields={inputFields}
                            sheetLabel={tr(locale, "데이터 시트", "Bảng dữ liệu")}
                            pdfLabel={tr(locale, "원본양식 PDF", "PDF mẫu gốc")}
                            previewLabel={tr(locale, "미리보기", "Xem trước")}
                            closeLabel={tr(locale, "닫기", "Đóng")}
                            inputsTitle={tr(locale, "생성 정보 입력", "Nhập thông tin tạo")}
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
