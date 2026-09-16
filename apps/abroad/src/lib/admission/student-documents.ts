/**
 * 서류 등록(발급서류) 그룹 로딩·정리 — 유학센터/셀프 학생 공용.
 *   지원별로 필요한 발급서류를 모으고, 복수 대학 공용 서류 dedup·과거 업로드 해소·
 *   다른 지원 파일 가져오기 후보까지 계산해 "그리기만 하면 되는" 형태로 반환한다.
 *
 *   0067: 서류는 지원의 요강 학과(study_spec_departments)에서 읽는다(lib/admission/spec-documents).
 *   학과를 못 찾는 옛 지원만 요강 JSONB(required_documents) + 학과명 양식 매칭으로 폴백.
 *   업로드 키(shareKey/legacyKey)는 표준·인증·대상자·이름이 같으므로 그대로 맞는다.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { isFormImageDataType } from "@/lib/center/student-data-context";
import {
  classifyRequiredDocs,
  docUploadKey,
  docShareKey,
  type ClassifiedDoc,
} from "@/lib/admission/classify-documents";
import { loadFormDocKeys } from "@/lib/admission/form-doc-keys";
import {
  formFileAppliesTo,
  loadApplicationDocuments,
} from "@/lib/admission/spec-documents";
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
    .select("id, admission_spec_id, target_department_id, term, target_department_label, created_at")
    .eq("student_id", studentId)
    .order("created_at", { ascending: true });
  const applications = apps ?? [];

  const [{ specs, deptByApp, byApp }, { data: files }, { data: dataTypes }] =
    await Promise.all([
      loadApplicationDocuments(supabase, applications),
      supabase
        .from("study_student_submission_files")
        .select("doc_key, file_name, file_path")
        .eq("student_id", studentId),
      supabase
        .from("study_student_data_types")
        .select("key, label_ko, label_vi, input_type")
        .eq("is_active", true),
    ]);
  const uniIds = Array.from(new Set(Array.from(specs.values()).map((s) => s.university_id)));

  // 학과를 못 찾은 옛 지원이 있으면 예전 규칙(대학 전체 양식 + 학과명 매칭)용 양식을 읽는다
  const needsLegacy = applications.some((a) => !deptByApp.get(a.id));
  const legacyUniIds = needsLegacy
    ? Array.from(
        new Set(
          applications
            .filter((a) => !deptByApp.get(a.id))
            .map((a) => specs.get(a.admission_spec_id)?.university_id)
            .filter((u): u is number => u != null)
        )
      )
    : [];

  const [{ data: unis }, { data: legacyForms }, formDocKeys] = await Promise.all([
    uniIds.length > 0
      ? supabase
          .from("universities")
          .select("id, name_ko, name_vi")
          .in("id", uniIds)
      : Promise.resolve({
          data: [] as Array<{ id: number; name_ko: string; name_vi: string | null }>,
        }),
    legacyUniIds.length > 0
      ? supabase
          .from("study_admission_form_files")
          .select(
            "university_id, spec_department_id, department_name, applies_to_terms, required_data_type_keys"
          )
          .in("university_id", legacyUniIds)
          .eq("is_current", true)
      : Promise.resolve({
          data: [] as Array<{
            university_id: number;
            spec_department_id: string | null;
            department_name: string | null;
            applies_to_terms: string[] | null;
            required_data_type_keys: string[] | null;
          }>,
        }),
    needsLegacy ? loadFormDocKeys(supabase) : Promise.resolve(new Set<string>()),
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
    target_person: string | null;
    name_ko: string;
    name_vi: string | null;
    notes: string | null;
    notarization: string | null;
    required: boolean;
  };

  const rawGroups = applications.map((app) => {
    const spec = specs.get(app.admission_spec_id);
    const dept = deptByApp.get(app.id) ?? null;
    const docs = byApp.get(app.id) ?? null;
    const deptLabel =
      app.target_department_label ??
      (dept ? (locale === "ko" ? dept.name_ko : dept.name_vi || dept.name_ko) : null);
    const label = spec
      ? `${uniName(spec.university_id)}${deptLabel ? ` · ${deptLabel}` : ""}`
      : deptLabel ?? "—";

    // 서류 목록: 학과가 풀리면 학과 서류, 아니면 옛 JSONB
    let formDocs: ClassifiedDoc[];
    let specIssued: ClassifiedDoc[];
    let requiredDataKeys: string[];
    if (docs) {
      formDocs = docs.forms.map((f) => ({
        key: f.key,
        name_ko: f.name_ko,
        name_vi: f.name_vi,
        notes: f.notes,
        notarization: f.notarization,
        required: f.required,
        kind: "form",
        std_key: f.std_key,
        target_person: f.target_person,
      }));
      specIssued = docs.issued.map((d) => ({
        key: d.key,
        name_ko: d.name_ko,
        name_vi: d.name_vi,
        notes: locale === "vi" ? d.notes_vi ?? d.notes : d.notes,
        notarization: d.notarization,
        required: d.required,
        kind: "issued",
        std_key: d.std_key,
        target_person: d.target_person,
      }));
      requiredDataKeys = docs.formFiles.flatMap((f) => f.required_data_type_keys ?? []);
    } else {
      const classified = classifyRequiredDocs(spec?.required_documents ?? [], formDocKeys);
      formDocs = classified.forms;
      specIssued = classified.issued;
      requiredDataKeys = spec
        ? (legacyForms ?? [])
            .filter((f) =>
              formFileAppliesTo(f, {
                dept: null,
                universityId: spec.university_id,
                departmentLabel: app.target_department_label,
                term: app.term ?? spec.term,
              })
            )
            .flatMap((f) => f.required_data_type_keys ?? [])
        : [];
    }

    const items = new Map<string, IssuedItem>();
    const dedupKeyOf = (d: ClassifiedDoc) =>
      d.std_key ? `s:${d.std_key}:${d.target_person ?? ""}` : `l:${docUploadKey(d)}`;
    for (const d of specIssued) {
      if (items.has(dedupKeyOf(d))) continue;
      items.set(dedupKeyOf(d), {
        shareKey: docShareKey(d),
        legacyKey: docUploadKey(d),
        std_key: d.std_key,
        target_person: d.target_person,
        name_ko: d.name_ko,
        name_vi: d.name_vi,
        notes: d.notes,
        notarization: d.notarization,
        required: d.required,
      });
    }

    // 적용 양식이 요구하는 파일형 표준데이터(양식에 박히는 사진·서명 제외)도 발급서류 칸으로
    for (const key of new Set(requiredDataKeys)) {
      const dt = dataTypeMap.get(key);
      if (!dt || dt.input_type !== "file" || isFormImageDataType(dt)) continue;
      const dedupKey = `s:${key}:`;
      if (items.has(dedupKey)) continue;
      items.set(dedupKey, {
        shareKey: `std::${key}::none`,
        legacyKey: null,
        std_key: key,
        target_person: null,
        name_ko: dt.label_ko,
        name_vi: dt.label_vi || null,
        notes: null,
        notarization: null,
        required: true,
      });
    }

    return {
      app,
      spec,
      label,
      term: app.term ?? spec?.term ?? "",
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
  // 표준 + 대상자로 묶는다 — 어머니 신분증이 아버지 칸의 "가져오기" 후보로 뜨지 않게
  const stdTargetOf = (it: IssuedItem) => `${it.std_key}:${it.target_person ?? ""}`;
  const uploadedByStd = new Map<
    string,
    Array<{ docKey: string; fileName: string; sourceLabel: string }>
  >();
  for (const g of rawGroups) {
    for (const it of g.issued) {
      if (!it.std_key) continue;
      const { key, file } = resolveFile(it);
      if (!file) continue;
      if (!uploadedByStd.has(stdTargetOf(it))) uploadedByStd.set(stdTargetOf(it), []);
      const list = uploadedByStd.get(stdTargetOf(it))!;
      if (!list.some((c) => c.docKey === key))
        list.push({ docKey: key, fileName: file.file_name, sourceLabel: g.label });
    }
  }

  const groups: DocGroup[] = rawGroups.map((g) => {
    const issued: IssuedResolved[] = g.issued.map((it) => {
      const { key: usedKey, file } = resolveFile(it);
      const importCandidates =
        !file && it.std_key
          ? (uploadedByStd.get(stdTargetOf(it)) ?? []).filter(
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
