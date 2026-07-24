/**
 * 서류 등록(발급서류) 그룹 로딩·정리 — 유학센터/셀프 학생 공용.
 *   지원별로 필요한 발급서류를 모으고, 복수 대학 공용 서류 dedup·과거 업로드 해소·
 *   다른 지원 파일 가져오기 후보까지 계산해 "그리기만 하면 되는" 형태로 반환한다.
 *   (기존 /center/.../documents 페이지 로직을 그대로 이동. 동작 불변.)
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { isFormImageDataType } from "@/lib/center/student-data-context";
import {
  classifyRequiredDocs,
  docUploadKey,
  docShareKey,
  type ClassifiedDoc,
  type RequiredDoc,
} from "@/lib/admission/classify-documents";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;
type Locale = "ko" | "vi";

export type DocFile = { file_name: string; file_path: string };

export type IssuedResolved = {
  shareKey: string;
  std_key: string | null;
  name_ko: string;
  name_vi: string | null;
  notes: string | null;
  notarization: string | null;
  required: boolean;
  /** 파일이 실제로 있는 doc_key (share→legacy→구제) */
  usedKey: string;
  file: DocFile | null;
  /** 여러 지원에서 공용(2+) */
  shared: boolean;
  /** 미업로드 시, 다른 지원에 올린 같은 서류 가져오기 후보(첫 번째) */
  importCandidate: { docKey: string; fileName: string; sourceLabel: string } | null;
};

export type DocGroup = {
  appId: string;
  label: string;
  term: string;
  issued: IssuedResolved[];
  formDocs: ClassifiedDoc[];
  uploadedCount: number;
};

export async function loadDocumentGroups(
  supabase: Client,
  studentId: string,
  locale: Locale
): Promise<{ groups: DocGroup[]; hasAnyApp: boolean }> {
  const { data: apps } = await supabase
    .from("study_applications")
    .select("id, admission_spec_id, target_department_label, created_at")
    .eq("student_id", studentId)
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
        .eq("student_id", studentId),
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

  type IssuedItem = {
    shareKey: string;
    legacyKey: string | null;
    std_key: string | null;
    name_ko: string;
    name_vi: string | null;
    notes: string | null;
    notarization: string | null;
    required: boolean;
  };

  const rawGroups = applications.map((app) => {
    const spec = specMap.get(app.admission_spec_id);
    const label = spec
      ? `${uniName(spec.university_id)}${
          app.target_department_label ? ` · ${app.target_department_label}` : ""
        }`
      : app.target_department_label ?? "—";

    const { forms: formDocs, issued: specIssued } = classifyRequiredDocs(
      (spec?.required_documents as RequiredDoc[]) ?? []
    );

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
        if (items.has(dedupKey)) continue;
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

    return {
      app,
      spec,
      label,
      term: spec?.term ?? "",
      issued: Array.from(items.values()),
      formDocs,
    };
  });

  // shareKey → 등장 그룹 수
  const shareCount = new Map<string, number>();
  for (const g of rawGroups)
    for (const it of g.issued)
      shareCount.set(it.shareKey, (shareCount.get(it.shareKey) ?? 0) + 1);

  const fileEntries = Array.from(fileByDocKey.entries());
  const healByKeyPrefix = (legacyKey: string | null) => {
    if (!legacyKey) return null;
    const sep = legacyKey.indexOf("::");
    if (sep < 1) return null;
    const prefix = legacyKey.slice(0, sep + 2);
    const hits = fileEntries.filter(([k]) => k.startsWith(prefix));
    return hits.length === 1 ? { key: hits[0][0], file: hits[0][1] } : null;
  };
  const resolveFile = (it: IssuedItem) => {
    const byShare = fileByDocKey.get(it.shareKey);
    if (byShare) return { key: it.shareKey, file: byShare };
    if (it.legacyKey) {
      const byLegacy = fileByDocKey.get(it.legacyKey);
      if (byLegacy) return { key: it.legacyKey, file: byLegacy };
    }
    const healed = healByKeyPrefix(it.legacyKey);
    if (healed) return healed;
    return { key: it.shareKey, file: null as DocFile | null };
  };

  // std_key → 업로드 출처 목록
  const uploadedByStd = new Map<
    string,
    Array<{ docKey: string; fileName: string; sourceLabel: string }>
  >();
  for (const g of rawGroups) {
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

  const groups: DocGroup[] = rawGroups.map((g) => {
    const issued: IssuedResolved[] = g.issued.map((it) => {
      const { key: usedKey, file } = resolveFile(it);
      const importCandidates =
        !file && it.std_key
          ? (uploadedByStd.get(it.std_key) ?? []).filter(
              (c) => c.docKey !== it.shareKey
            )
          : [];
      return {
        shareKey: it.shareKey,
        std_key: it.std_key,
        name_ko: it.name_ko,
        name_vi: it.name_vi,
        notes: it.notes,
        notarization: it.notarization,
        required: it.required,
        usedKey,
        file,
        shared: (shareCount.get(it.shareKey) ?? 0) > 1,
        importCandidate: importCandidates[0] ?? null,
      };
    });
    return {
      appId: g.app.id,
      label: g.label,
      term: g.term,
      issued,
      formDocs: g.formDocs,
      uploadedCount: issued.filter((it) => it.file != null).length,
    };
  });

  return { groups, hasAnyApp: groups.length > 0 };
}
