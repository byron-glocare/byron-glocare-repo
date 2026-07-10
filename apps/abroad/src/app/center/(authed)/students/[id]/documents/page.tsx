/**
 * /center/students/[id]/documents — 서류 등록 탭 (지원별 분리).
 *   지원(대학·학과·학기)별 섹션으로 필요한 서류를 노출:
 *   - 발급 서류(issued): 모집요강 required_documents + 지원 양식이 요구하는
 *     파일 타입 표준데이터(졸업증명서 등, 사진·서명 제외)를 합쳐 노출.
 *   - 직접작성(form): 목록만 (업로드는 '최종 서류' 탭).
 *
 *   중복 제거 규칙 (복수 대학 지원 시):
 *   - 공용 표준(std_key)에 연결된 발급 서류는 세부요건(인증)이 같으면 doc_key 를
 *     공유 → 한 지원에서 올리면 다른 지원에도 등록된 것으로 표시.
 *   - 같은 표준인데 세부요건이 다르면 각각 업로드하되, 다른 지원에 올린 파일을
 *     복사해 오는 [다른 대학 파일 가져오기] 버튼 제공.
 */

import Link from "next/link";
import { notFound } from "next/navigation";

import { verifyCenterSession } from "@/lib/center/dal";
import { createCenterClient } from "@/lib/supabase/center";
import { getLocale, tr, type Locale } from "@/lib/i18n";
import { isFormImageDataType } from "@/lib/center/student-data-context";
import {
  classifyRequiredDocs,
  docUploadKey,
  docShareKey,
  type ClassifiedDoc,
  type RequiredDoc,
} from "@/lib/admission/classify-documents";

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

/** 지원별 섹션에 노출할 발급 서류 한 건 */
type IssuedItem = {
  /** 업로드 식별 doc_key (std 공유 키 우선) */
  shareKey: string;
  /** 과거 업로드 조회용 (예전 key::name 키) */
  legacyKey: string | null;
  std_key: string | null;
  name_ko: string;
  name_vi: string | null;
  notes: string | null;
  notarization: string | null;
  required: boolean;
};

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

  const { data: apps } = await supabase
    .from("study_applications")
    .select("id, admission_spec_id, target_department_label, created_at")
    .eq("student_id", id)
    .order("created_at", { ascending: true });
  const applications = apps ?? [];
  const specIds = Array.from(
    new Set(applications.map((a) => a.admission_spec_id).filter(Boolean))
  );

  const [{ data: specs }, { data: files }, { data: dataTypes }] =
    await Promise.all([
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
        .from("study_student_submission_files")
        .select("doc_key, file_name, file_path")
        .eq("student_id", id),
      supabase
        .from("study_student_data_types")
        .select("key, label_ko, label_vi, input_type")
        .eq("is_active", true),
    ]);
  const specMap = new Map((specs ?? []).map((s) => [s.id, s]));
  const uniIds = Array.from(new Set((specs ?? []).map((s) => s.university_id)));

  const [{ data: unis }, { data: forms }] = await Promise.all([
    uniIds.length > 0
      ? supabase
          .from("universities")
          .select("id, name_ko, name_vi")
          .in("id", uniIds)
      : Promise.resolve({
          data: [] as Array<{ id: number; name_ko: string; name_vi: string | null }>,
        }),
    uniIds.length > 0
      ? supabase
          .from("study_admission_form_files")
          .select(
            "university_id, department_name, applies_to_terms, required_data_type_keys"
          )
          .in("university_id", uniIds)
          .eq("is_current", true)
      : Promise.resolve({
          data: [] as Array<{
            university_id: number;
            department_name: string | null;
            applies_to_terms: string[] | null;
            required_data_type_keys: string[] | null;
          }>,
        }),
  ]);
  const uniMap = new Map((unis ?? []).map((u) => [u.id, u]));
  const uniName = (uid: number) => {
    const u = uniMap.get(uid);
    return (locale === "ko" ? u?.name_ko : u?.name_vi) ?? u?.name_ko ?? `#${uid}`;
  };
  const dataTypeMap = new Map((dataTypes ?? []).map((d) => [d.key, d]));
  const fileByDocKey = new Map(
    (files ?? [])
      .filter((f) => f.doc_key)
      .map((f) => [
        f.doc_key as string,
        { file_name: f.file_name, file_path: f.file_path },
      ])
  );

  // ── 지원별 그룹 구성 ─────────────────────────────────────────────
  const groups = applications.map((app) => {
    const spec = specMap.get(app.admission_spec_id);
    const label = spec
      ? `${uniName(spec.university_id)}${
          app.target_department_label ? ` · ${app.target_department_label}` : ""
        }`
      : app.target_department_label ?? "—";

    const { forms: formDocs, issued: specIssued } = classifyRequiredDocs(
      (spec?.required_documents as RequiredDoc[]) ?? []
    );

    // 발급 서류: 모집요강 항목 (그룹 내 dedup = std_key 우선)
    const items = new Map<string, IssuedItem>();
    const dedupKeyOf = (d: ClassifiedDoc) =>
      d.std_key ? `s:${d.std_key}` : `l:${docUploadKey(d)}`;
    for (const d of specIssued) {
      items.set(dedupKeyOf(d), {
        shareKey: docShareKey(d),
        legacyKey: docUploadKey(d),
        std_key: d.std_key,
        name_ko: d.name_ko,
        name_vi: d.name_vi,
        notes: d.notes,
        notarization: d.notarization,
        required: d.required,
      });
    }

    // + 지원 양식이 요구하는 파일 타입 표준데이터 (졸업증명서 등 발급서류 성격).
    //   사진·서명 등 양식 삽입 이미지는 '정보 입력'에서 처리 → 제외.
    if (spec) {
      const applicableForms = (forms ?? []).filter((f) => {
        if (f.university_id !== spec.university_id) return false;
        const deptOk =
          f.department_name === null ||
          (!!app.target_department_label &&
            f.department_name === app.target_department_label);
        const terms = (f.applies_to_terms ?? []) as string[];
        const termOk = terms.length === 0 || terms.includes(spec.term);
        return deptOk && termOk;
      });
      const fileKeys = new Set<string>();
      for (const f of applicableForms)
        for (const k of f.required_data_type_keys ?? []) fileKeys.add(k);
      for (const key of fileKeys) {
        const dt = dataTypeMap.get(key);
        if (!dt || dt.input_type !== "file" || isFormImageDataType(dt)) continue;
        const dedupKey = `s:${key}`;
        if (items.has(dedupKey)) continue; // 모집요강 항목이 우선 (인증 요건 등 상세 보유)
        items.set(dedupKey, {
          shareKey: `std::${key}::none`,
          legacyKey: null,
          std_key: key,
          name_ko: dt.label_ko,
          name_vi: dt.label_vi || null,
          notes: null,
          notarization: null,
          required: true,
        });
      }
    }

    return { app, spec, label, issued: Array.from(items.values()), formDocs };
  });

  // shareKey → 등장 그룹 수 (2개 이상이면 "공용 — 한 번만 업로드")
  const shareCount = new Map<string, number>();
  for (const g of groups)
    for (const it of g.issued)
      shareCount.set(it.shareKey, (shareCount.get(it.shareKey) ?? 0) + 1);

  const fileEntries = Array.from(fileByDocKey.entries()); // [doc_key, file]

  // 이름 변경/표준 연결로 과거 업로드가 새 키(share·legacy)와 안 맞을 때 구제:
  //   같은 "서류 종류(key)" 접두사(key::)로 올라온 파일이 정확히 하나면 그 파일로 본다.
  //   (본인/부모 여권처럼 같은 key 가 2개 이상이면 오매칭 방지 위해 구제 안 함 — 재업로드/가져오기 유도.)
  const healByKeyPrefix = (legacyKey: string | null) => {
    if (!legacyKey) return null;
    const sep = legacyKey.indexOf("::");
    if (sep < 1) return null;
    const prefix = legacyKey.slice(0, sep + 2); // "key::"
    const hits = fileEntries.filter(([k]) => k.startsWith(prefix));
    return hits.length === 1
      ? { key: hits[0][0], file: hits[0][1] }
      : null;
  };

  // 파일 조회 (share 키 → legacy 키 → key 접두사 구제). 업로더는 파일이 있는 키를 그대로 사용.
  const resolveFile = (it: IssuedItem) => {
    const byShare = fileByDocKey.get(it.shareKey);
    if (byShare) return { key: it.shareKey, file: byShare };
    if (it.legacyKey) {
      const byLegacy = fileByDocKey.get(it.legacyKey);
      if (byLegacy) return { key: it.legacyKey, file: byLegacy };
    }
    const healed = healByKeyPrefix(it.legacyKey);
    if (healed) return healed;
    return { key: it.shareKey, file: null };
  };

  // std_key → 업로드된 파일 출처 목록 (가져오기 후보)
  const uploadedByStd = new Map<
    string,
    Array<{ docKey: string; fileName: string; sourceLabel: string }>
  >();
  for (const g of groups) {
    for (const it of g.issued) {
      if (!it.std_key) continue;
      const { key, file } = resolveFile(it);
      if (!file) continue;
      if (!uploadedByStd.has(it.std_key)) uploadedByStd.set(it.std_key, []);
      const list = uploadedByStd.get(it.std_key)!;
      if (!list.some((c) => c.docKey === key))
        list.push({ docKey: key, fileName: file.file_name, sourceLabel: g.label });
    }
  }

  const hasAnyApp = groups.length > 0;

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
        groups.map(({ app, spec, label, issued, formDocs }) => {
          const uploadedCount = issued.filter(
            (it) => resolveFile(it).file != null
          ).length;
          return (
            <section
              key={app.id}
              className="rounded-lg border border-slate-200 bg-white p-6"
            >
              <div className="mb-3">
                <h2 className="text-base font-semibold text-slate-900">{label}</h2>
                <p className="text-xs text-slate-500">{spec?.term ?? ""}</p>
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
                  {issued.length > 0 ? (
                    <span className="shrink-0 text-xs text-slate-500">
                      {tr(locale, "업로드", "Đã tải")} {uploadedCount}/{issued.length}
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
                {issued.length === 0 ? (
                  <p className="text-sm text-slate-400">
                    {tr(locale, "발급 서류가 없습니다.", "Không có giấy tờ cần xin cấp.")}
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {issued.map((it) => {
                      const nota = notarizationLabel(locale, it.notarization);
                      const { key: usedKey, file } = resolveFile(it);
                      const shared = (shareCount.get(it.shareKey) ?? 0) > 1;
                      const importCandidates = !file && it.std_key
                        ? (uploadedByStd.get(it.std_key) ?? []).filter(
                            (c) => c.docKey !== it.shareKey
                          )
                        : [];
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
                              {shared ? (
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
                              docKey={usedKey}
                              existing={file}
                            />
                            {importCandidates.length > 0 ? (
                              <ImportFileButton
                                locale={locale}
                                studentId={id}
                                fromDocKey={importCandidates[0].docKey}
                                toDocKey={it.shareKey}
                                sourceLabel={importCandidates[0].sourceLabel}
                                fileName={importCandidates[0].fileName}
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
                  {formDocs.length > 0 ? (
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
                {formDocs.length === 0 ? (
                  <p className="text-sm text-slate-400">
                    {tr(locale, "직접작성 서류가 없습니다.", "Không có giấy tờ tự điền.")}
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {formDocs.map((d) => {
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
          );
        })
      )}
    </div>
  );
}
