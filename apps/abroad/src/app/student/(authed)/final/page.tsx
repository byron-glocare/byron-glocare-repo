/**
 * /student/final — 셀프 학생 작성서류 초안 생성·다운로드.
 *   지원(대학/학과/학기)별 작성서류를 학생 정보로 채운 초안(docx/pdf)으로 받는다.
 *   완성본 업로드·최종 제출(글로케어 확인) 흐름은 이후(P2e-2).
 */

import Link from "next/link";

import { verifyStudentSession } from "@/lib/student/dal";
import { createClient } from "@/lib/supabase/server";
import {
  classifyRequiredDocs,
  type RequiredDoc,
} from "@/lib/admission/classify-documents";
import { getLocale, tr } from "@/lib/i18n";

function normFormName(s: string): string {
  return s
    .trim()
    .replace(/^\s*\d+[.)]\s*/, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

export const dynamic = "force-dynamic";

export default async function StudentFinalPage() {
  const session = await verifyStudentSession();
  const locale = await getLocale();
  const supabase = await createClient();
  const studentId = session.student.id;

  const { data: apps } = await supabase
    .from("study_applications")
    .select("id, admission_spec_id, target_department_label")
    .eq("student_id", studentId);
  const applications = apps ?? [];
  const specIds = Array.from(
    new Set(applications.map((a) => a.admission_spec_id))
  );

  const { data: specs } =
    specIds.length > 0
      ? await supabase
          .from("study_admission_specs")
          .select("id, university_id, term, required_documents")
          .in("id", specIds)
      : { data: [] as Array<{ id: string; university_id: number; term: string; required_documents: unknown }> };
  const specMap = new Map((specs ?? []).map((s) => [s.id, s]));

  const uniIds = Array.from(new Set((specs ?? []).map((s) => s.university_id)));
  const [{ data: unis }, { data: forms }] = await Promise.all([
    uniIds.length > 0
      ? supabase
          .from("universities")
          .select("id, name_ko, name_vi")
          .in("id", uniIds)
      : Promise.resolve({ data: [] as Array<{ id: number; name_ko: string; name_vi: string | null }> }),
    uniIds.length > 0
      ? supabase
          .from("study_admission_form_files")
          .select(
            "id, university_id, department_name, name_ko, key, field_overlays, mime_type, file_name, file_url"
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
            field_overlays: unknown;
            mime_type: string | null;
            file_name: string;
            file_url: string;
          }>,
        }),
  ]);
  const uniMap = new Map((unis ?? []).map((u) => [u.id, u]));
  const uniName = (uid: number) => {
    const u = uniMap.get(uid);
    return (locale === "vi" ? u?.name_vi ?? u?.name_ko : u?.name_ko) ?? `#${uid}`;
  };

  const groups = applications.map((a) => {
    const spec = specMap.get(a.admission_spec_id);
    const uni = spec?.university_id ?? null;

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
      const canFill = !!file && ((isPdf && overlayCount > 0) || isDocx);
      const fillUrl =
        file && canFill
          ? engine === "pdf"
            ? `/student/final/pdf?form=${file.id}&app=${a.id}`
            : `/student/final/docx-fill?form=${file.id}`
          : null;
      return { doc, file, canFill, engine, fillUrl };
    });
    return { app: a, spec, writeRows };
  });

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
          {tr(locale, "작성 서류 (초안)", "Hồ sơ soạn (bản nháp)")}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {tr(
            locale,
            "입력한 정보로 채운 초안을 받아 서명·보정한 뒤 제출하세요.",
            "Tải bản nháp đã điền, ký & chỉnh sửa rồi nộp."
          )}
        </p>
      </div>

      <div className="rounded-lg border border-sky-200 bg-sky-50/60 px-4 py-3 text-xs leading-relaxed text-sky-800">
        {tr(
          locale,
          "초안은 '정보 입력'의 값으로 자동 채워집니다. 비어 있으면 먼저 정보 입력을 채워주세요.",
          "Bản nháp được điền tự động từ 'Nhập thông tin'. Nếu trống, hãy nhập thông tin trước."
        )}
      </div>

      {groups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
          {tr(
            locale,
            "지원한 대학이 없습니다. '대학 찾기'에서 먼저 지원하세요.",
            "Chưa đăng ký trường. Hãy đăng ký ở 'Tìm trường'."
          )}
        </div>
      ) : (
        groups.map(({ app, spec, writeRows }) => (
          <section
            key={app.id}
            className="rounded-lg border border-slate-200 bg-white p-5"
          >
            <div className="mb-3">
              <h2 className="text-base font-semibold text-slate-900">
                {spec ? uniName(spec.university_id) : "—"}
                {app.target_department_label
                  ? ` · ${app.target_department_label}`
                  : ""}
              </h2>
              <p className="text-xs text-slate-500">{spec?.term ?? ""}</p>
            </div>

            {writeRows.length === 0 ? (
              <p className="pl-1 text-xs text-slate-400">
                {tr(locale, "작성 서류 없음", "Không có hồ sơ soạn")}
              </p>
            ) : (
              <ul className="space-y-1.5">
                {writeRows.map(({ doc, file, canFill, fillUrl }) => (
                  <li
                    key={doc.key + doc.name_ko}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-100 bg-slate-50/50 px-3 py-2"
                  >
                    <span className="text-sm font-medium text-slate-800">
                      {doc.name_ko}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {file && canFill && fillUrl ? (
                        <>
                          <a
                            href={fillUrl}
                            className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                          >
                            {tr(locale, "초안 다운로드", "Tải bản nháp")}
                          </a>
                          <a
                            href={`${fillUrl}${fillUrl.includes("?") ? "&" : "?"}preview=1`}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100"
                          >
                            {tr(locale, "미리보기", "Xem trước")}
                          </a>
                        </>
                      ) : file ? (
                        <a
                          href={file.file_url}
                          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100"
                        >
                          {tr(locale, "빈 양식 받기", "Tải mẫu trống")}
                        </a>
                      ) : (
                        <span className="text-[11px] text-slate-400">
                          {tr(locale, "양식 준비 중", "Đang chuẩn bị mẫu")}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))
      )}
    </div>
  );
}
