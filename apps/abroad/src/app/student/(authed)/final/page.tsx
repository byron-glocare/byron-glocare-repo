/**
 * /student/final — 셀프 학생 작성서류 초안 생성·다운로드.
 *   지원(대학/학과/학기)별 작성서류를 학생 정보로 채운 초안(docx/pdf)으로 받는다.
 *   완성본 업로드·최종 제출(글로케어 확인) 흐름은 이후(P2e-2).
 */

import Link from "next/link";

import { verifyStudentSession } from "@/lib/student/dal";
import { createClient } from "@/lib/supabase/server";
import { classifyRequiredDocs } from "@/lib/admission/classify-documents";
import { loadFormDocKeys } from "@/lib/admission/form-doc-keys";
import {
  FORM_FILE_COLUMNS,
  formFileAppliesTo,
  loadApplicationDocuments,
  type SpecFormFile,
} from "@/lib/admission/spec-documents";
import { getLocale, tr } from "@/lib/i18n";
import { downloadUrl } from "@/lib/storage-download";

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
    .select("id, admission_spec_id, target_department_id, term, target_department_label")
    .eq("student_id", studentId);
  const applications = apps ?? [];

  // 0067: 작성서류 양식은 지원의 요강 학과(spec_department_id)에서. 학과 없는 옛 지원만 이름 매칭 폴백.
  const { specs: specMap, deptByApp, byApp } = await loadApplicationDocuments(supabase, applications);
  const needsLegacy = applications.some((a) => !byApp.get(a.id));
  const formDocKeys = needsLegacy ? await loadFormDocKeys(supabase) : new Set<string>();

  const uniIds = Array.from(new Set(Array.from(specMap.values()).map((s) => s.university_id)));
  const [{ data: unis }, { data: legacyForms }] = await Promise.all([
    uniIds.length > 0
      ? supabase
          .from("universities")
          .select("id, name_ko, name_vi")
          .in("id", uniIds)
      : Promise.resolve({ data: [] as Array<{ id: number; name_ko: string; name_vi: string | null }> }),
    needsLegacy && uniIds.length > 0
      ? supabase
          .from("study_admission_form_files")
          .select(FORM_FILE_COLUMNS)
          .in("university_id", uniIds)
          .eq("is_current", true)
      : Promise.resolve({ data: [] as unknown[] }),
  ]);
  const legacyFormFiles = (legacyForms ?? []) as unknown as SpecFormFile[];
  const uniMap = new Map((unis ?? []).map((u) => [u.id, u]));
  const uniName = (uid: number) => {
    const u = uniMap.get(uid);
    return (locale === "vi" ? u?.name_vi ?? u?.name_ko : u?.name_ko) ?? `#${uid}`;
  };

  const groups = applications.map((a) => {
    const spec = specMap.get(a.admission_spec_id);
    const uni = spec?.university_id ?? null;
    const docs = byApp.get(a.id) ?? null;

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
      const canFill = !!file && ((isPdf && overlayCount > 0) || isDocx);
      const fillUrl =
        file && canFill
          ? engine === "pdf"
            ? `/student/final/pdf?form=${file.id}&app=${a.id}`
            : `/student/final/docx-fill?form=${file.id}`
          : null;
      return { doc, file, canFill, engine, fillUrl };
    });
    return { app: a, spec, term: a.term ?? spec?.term ?? "", writeRows };
  });

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/student/applications"
          className="text-sm text-ink-light hover:underline"
        >
          {tr(locale, "← 내 지원", "← Hồ sơ của tôi")}
        </Link>
        <h1 className="mt-2 gc-page-title">
          {tr(locale, "작성 서류 (초안)", "Hồ sơ soạn (bản nháp)")}
        </h1>
        <p className="gc-page-desc">
          {tr(
            locale,
            "입력한 정보로 채운 초안을 받아 서명·보정한 뒤 제출하세요.",
            "Tải bản nháp đã điền, ký & chỉnh sửa rồi nộp."
          )}
        </p>
      </div>

      <div className="gc-note gc-note-info">
        {tr(
          locale,
          "초안은 '정보 입력'의 값으로 자동 채워집니다. 비어 있으면 먼저 정보 입력을 채워주세요.",
          "Bản nháp được điền tự động từ 'Nhập thông tin'. Nếu trống, hãy nhập thông tin trước."
        )}
      </div>

      {groups.length === 0 ? (
        <div className="gc-card-dashed py-12 text-center text-sm text-ink-light">
          {tr(
            locale,
            "지원한 대학이 없습니다. '대학 찾기'에서 먼저 지원하세요.",
            "Chưa đăng ký trường. Hãy đăng ký ở 'Tìm trường'."
          )}
        </div>
      ) : (
        groups.map(({ app, spec, term, writeRows }) => (
          <section
            key={app.id}
            className="gc-card"
          >
            <div className="mb-3">
              <h2 className="text-base font-semibold text-ink">
                {spec ? uniName(spec.university_id) : "—"}
                {app.target_department_label
                  ? ` · ${app.target_department_label}`
                  : ""}
              </h2>
              <p className="text-xs text-ink-light">{term}</p>
            </div>

            {writeRows.length === 0 ? (
              <p className="pl-1 text-xs text-ink-xlight">
                {tr(locale, "작성 서류 없음", "Không có hồ sơ soạn")}
              </p>
            ) : (
              <ul className="space-y-1.5">
                {writeRows.map(({ doc, file, canFill, fillUrl }) => (
                  <li
                    key={doc.key + doc.name_ko}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-tag border border-line-soft bg-canvas px-3 py-2"
                  >
                    <span className="text-sm font-medium text-ink-mid">
                      {doc.name_ko}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {file && canFill && fillUrl ? (
                        <>
                          <a
                            href={fillUrl}
                            className="gc-btn gc-btn-primary gc-btn-md"
                          >
                            {tr(locale, "초안 다운로드", "Tải bản nháp")}
                          </a>
                          <a
                            href={`${fillUrl}${fillUrl.includes("?") ? "&" : "?"}preview=1`}
                            target="_blank"
                            rel="noreferrer"
                            className="gc-btn gc-btn-secondary gc-btn-md"
                          >
                            {tr(locale, "미리보기", "Xem trước")}
                          </a>
                        </>
                      ) : file ? (
                        <a
                          href={downloadUrl(file.file_url, doc.name_ko, file.file_name)}
                          className="gc-btn gc-btn-secondary gc-btn-md"
                        >
                          {tr(locale, "빈 양식 받기", "Tải mẫu trống")}
                        </a>
                      ) : (
                        <span className="text-[11px] text-ink-xlight">
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
