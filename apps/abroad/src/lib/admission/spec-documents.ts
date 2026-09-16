/**
 * 지원 → 요강 학과 → 서류 목록 (0067 학과 모델).
 *
 *   요강(study_admission_specs)은 대학당 1개, 학과(study_spec_departments)가 그 안에 있고
 *   발급서류(study_spec_doc_items)·작성서류 양식(study_admission_form_files.spec_department_id)은
 *   학과에 붙는다. 여기서는 지원의 (admission_spec_id, target_department_id) 로 학과를 찾고,
 *   화면이 예전 `classifyRequiredDocs(...).issued / .forms` 에서 받던 것과 같은 모양(ClassifiedDoc)으로
 *   서류 줄을 만든다 — 업로드 키(docShareKey/docUploadKey)가 그대로 맞도록 이름·표준·대상자·인증을 같게 유지.
 *
 *   학과를 못 찾는 지원(옛 데이터·학과 없는 요강)은 null 을 돌려주며, 호출부가 옛 JSONB 경로로 폴백한다.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import type { ClassifiedDoc, RequiredDoc } from "./classify-documents";
import {
  expandItem,
  loadDocCatalog,
  loadSpecDocItemRowsByDepartment,
  TARGET_LABEL_KO,
  TARGET_LABEL_VI,
  type CatalogStandard,
  type DocCatalog,
  type SpecDocItemRow,
} from "./spec-doc-items";

type Client = SupabaseClient<Database>;

// ── 타입 ──────────────────────────────────────────────────────────────

export type SpecDepartmentKind = "language" | "regular";

/** 옛 departments JSONB 항목(info)에서 화면이 쓰는 필드 */
export type SpecDepartmentInfo = {
  name?: string | null;
  faculty?: string | null;
  track?: string | null;
  years?: number | null;
  capacity?: number | string | null;
  korean_min_topik?: number | null;
  tuition_per_semester_krw?: number | null;
  notes?: string | null;
  program_kind?: string | null;
};

export type SpecDepartmentRow = {
  id: string;
  spec_id: string;
  department_id: number;
  kind: SpecDepartmentKind;
  info: SpecDepartmentInfo;
  tuition: unknown;
  scholarships: unknown;
  /** null = 요강 공통(spec.eligibility) */
  eligibility: unknown | null;
  is_active: boolean;
  sort_order: number;
  /** departments 마스터 이름 (한국어는 저장값·양식 매칭에 쓰므로 번역 금지) */
  name_ko: string;
  name_vi: string | null;
};

export type SpecLite = {
  id: string;
  university_id: number;
  term: string;
  eligibility: unknown;
  required_documents: RequiredDoc[];
};

/** 작성서류 양식 파일 — 화면(최종서류·서류등록·양식 작성)이 쓰는 컬럼만 */
export type SpecFormFile = {
  id: string;
  university_id: number;
  spec_department_id: string | null;
  department_name: string | null;
  key: string;
  name_ko: string;
  file_url: string;
  file_name: string;
  size_bytes: number | null;
  mime_type: string | null;
  notes: string | null;
  required_data_type_keys: string[];
  field_overlays: unknown;
  is_essay: boolean | null;
  essay_sections: unknown;
  essay_questions: unknown;
};

export type SpecIssuedDoc = ClassifiedDoc & {
  kind: "issued";
  notes_vi: string | null;
  item_key: string;
  alternatives: Array<{ key: string; name_ko: string; name_vi: string | null }>;
};

export type SpecFormDoc = ClassifiedDoc & { kind: "form"; file: SpecFormFile };

export type DepartmentDocuments = {
  department: SpecDepartmentRow;
  issued: SpecIssuedDoc[];
  forms: SpecFormDoc[];
  formFiles: SpecFormFile[];
};

export type AppLike = {
  id: string;
  admission_spec_id: string;
  target_department_id: number | null;
};

// ── 요강 · 학과 ───────────────────────────────────────────────────────

export async function loadSpecsLite(supabase: Client, specIds: string[]): Promise<Map<string, SpecLite>> {
  const out = new Map<string, SpecLite>();
  if (specIds.length === 0) return out;
  const { data } = await supabase
    .from("study_admission_specs")
    .select("id, university_id, term, eligibility, required_documents")
    .in("id", specIds);
  for (const s of data ?? []) {
    out.set(s.id, {
      id: s.id,
      university_id: s.university_id,
      term: s.term,
      eligibility: s.eligibility,
      required_documents: (Array.isArray(s.required_documents) ? s.required_documents : []) as RequiredDoc[],
    });
  }
  return out;
}

/** 요강별 활성 학과 (어학당 먼저, 그다음 sort_order). 학과 마스터 이름 포함. */
export async function loadSpecDepartments(
  supabase: Client,
  specIds: string[]
): Promise<Map<string, SpecDepartmentRow[]>> {
  const out = new Map<string, SpecDepartmentRow[]>();
  if (specIds.length === 0) return out;
  const { data: rows } = await supabase
    .from("study_spec_departments")
    .select("id, spec_id, department_id, kind, info, tuition, scholarships, eligibility, is_active, sort_order")
    .in("spec_id", specIds)
    .eq("is_active", true)
    .order("sort_order");
  const deptIds = Array.from(new Set((rows ?? []).map((r) => r.department_id)));
  const { data: depts } =
    deptIds.length > 0
      ? await supabase.from("departments").select("id, name_ko, name_vi").in("id", deptIds)
      : { data: [] as Array<{ id: number; name_ko: string; name_vi: string | null }> };
  const deptMap = new Map((depts ?? []).map((d) => [d.id, d]));
  for (const r of rows ?? []) {
    const info = (r.info && typeof r.info === "object" ? r.info : {}) as SpecDepartmentInfo;
    const master = deptMap.get(r.department_id);
    const row: SpecDepartmentRow = {
      id: r.id,
      spec_id: r.spec_id,
      department_id: r.department_id,
      kind: r.kind,
      info,
      tuition: r.tuition,
      scholarships: r.scholarships,
      eligibility: r.eligibility ?? null,
      is_active: r.is_active,
      sort_order: r.sort_order,
      name_ko: master?.name_ko ?? (info.name ?? "").trim() ?? `학과 #${r.department_id}`,
      name_vi: master?.name_vi ?? null,
    };
    if (!row.name_ko) row.name_ko = `학과 #${r.department_id}`;
    if (!out.has(r.spec_id)) out.set(r.spec_id, []);
    out.get(r.spec_id)!.push(row);
  }
  for (const list of out.values()) list.sort(compareDepartments);
  return out;
}

/** 어학당 먼저, 그다음 sort_order */
export function compareDepartments(a: SpecDepartmentRow, b: SpecDepartmentRow): number {
  if (a.kind !== b.kind) return a.kind === "language" ? -1 : 1;
  return a.sort_order - b.sort_order;
}

/**
 * 지원의 학과 고르기.
 *   target_department_id 가 요강 학과에 있으면 그것. 없으면(옛 지원) 첫 정규 학과, 그것도 없으면 어학당.
 */
export function pickDepartment(
  rows: SpecDepartmentRow[] | undefined,
  targetDepartmentId: number | null | undefined
): SpecDepartmentRow | null {
  const list = rows ?? [];
  if (list.length === 0) return null;
  if (targetDepartmentId != null) {
    const hit = list.find((d) => d.department_id === targetDepartmentId);
    if (hit) return hit;
  }
  return list.find((d) => d.kind === "regular") ?? list.find((d) => d.kind === "language") ?? null;
}

/** 학과 자격요건 — 학과에 따로 있으면 그것, 없으면 요강 공통 */
export function departmentEligibility(dept: SpecDepartmentRow | null | undefined, spec: { eligibility: unknown } | null | undefined): unknown {
  return dept?.eligibility ?? spec?.eligibility ?? null;
}

/**
 * 지원 목록 → 지원별 학과 (+ 요강 요약). 서류 카탈로그는 읽지 않는다 — 양식/데이터키만 필요한 화면용.
 */
export async function loadApplicationDepartments(
  supabase: Client,
  apps: Array<Pick<AppLike, "id" | "admission_spec_id" | "target_department_id">>
): Promise<{ specs: Map<string, SpecLite>; deptByApp: Map<string, SpecDepartmentRow | null> }> {
  const specIds = Array.from(new Set(apps.map((a) => a.admission_spec_id).filter(Boolean)));
  const [specs, deptsBySpec] = await Promise.all([loadSpecsLite(supabase, specIds), loadSpecDepartments(supabase, specIds)]);
  const deptByApp = new Map<string, SpecDepartmentRow | null>();
  for (const a of apps) deptByApp.set(a.id, pickDepartment(deptsBySpec.get(a.admission_spec_id), a.target_department_id));
  return { specs, deptByApp };
}

// ── 양식 파일 ─────────────────────────────────────────────────────────

export const FORM_FILE_COLUMNS =
  "id, university_id, spec_department_id, department_name, key, name_ko, file_url, file_name, size_bytes, mime_type, notes, required_data_type_keys, field_overlays, is_essay, essay_sections, essay_questions";

function toFormFile(f: Record<string, unknown>): SpecFormFile {
  return {
    id: String(f.id),
    university_id: Number(f.university_id),
    spec_department_id: (f.spec_department_id as string | null | undefined) ?? null,
    department_name: (f.department_name as string | null) ?? null,
    key: String(f.key),
    name_ko: String(f.name_ko ?? ""),
    file_url: String(f.file_url ?? ""),
    file_name: String(f.file_name ?? ""),
    size_bytes: (f.size_bytes as number | null) ?? null,
    mime_type: (f.mime_type as string | null) ?? null,
    notes: (f.notes as string | null) ?? null,
    required_data_type_keys: (f.required_data_type_keys as string[] | null) ?? [],
    field_overlays: f.field_overlays ?? [],
    is_essay: (f.is_essay as boolean | null) ?? null,
    essay_sections: f.essay_sections ?? [],
    essay_questions: f.essay_questions ?? [],
  };
}

/** 요강 학과별 현행 양식 파일. 학과 id → 파일[] */
export async function loadFormFilesByDepartment(
  supabase: Client,
  specDepartmentIds: string[]
): Promise<Map<string, SpecFormFile[]>> {
  const out = new Map<string, SpecFormFile[]>();
  if (specDepartmentIds.length === 0) return out;
  const { data } = await supabase
    .from("study_admission_form_files")
    .select(FORM_FILE_COLUMNS)
    .in("spec_department_id", specDepartmentIds)
    .eq("is_current", true)
    .order("uploaded_at", { ascending: true });
  for (const raw of (data ?? []) as unknown as Array<Record<string, unknown>>) {
    const f = toFormFile(raw);
    if (!f.spec_department_id) continue;
    if (!out.has(f.spec_department_id)) out.set(f.spec_department_id, []);
    out.get(f.spec_department_id)!.push(f);
  }
  return out;
}

/**
 * 어떤 양식 파일이 이 지원에 적용되는가.
 *   학과가 풀리면 spec_department_id 로만 본다 (0067b 가 학과마다 복사 행을 만들어 두었으므로
 *   department_name 매칭을 같이 쓰면 중복이 생긴다).
 *   학과를 못 찾은 옛 지원은 예전 규칙(대학 + 학과명 전체/일치 + 적용학기)으로 폴백.
 */
export function formFileAppliesTo(
  file: {
    university_id: number;
    spec_department_id?: string | null;
    department_name: string | null;
    applies_to_terms?: string[] | null;
  },
  ctx: {
    dept: SpecDepartmentRow | null | undefined;
    universityId: number | null | undefined;
    departmentLabel: string | null | undefined;
    /** 주면 applies_to_terms 도 본다 (옛 규칙을 쓰던 화면만) */
    term?: string | null;
  }
): boolean {
  if (ctx.dept) return file.spec_department_id === ctx.dept.id;
  if (ctx.universityId == null || file.university_id !== ctx.universityId) return false;
  const deptOk =
    file.department_name === null || (!!ctx.departmentLabel && file.department_name === ctx.departmentLabel);
  if (!deptOk) return false;
  if (ctx.term !== undefined) {
    const terms = (file.applies_to_terms ?? []) as string[];
    if (terms.length > 0 && (!ctx.term || !terms.includes(ctx.term))) return false;
  }
  return true;
}

// ── 발급서류 줄 그리기 ────────────────────────────────────────────────

const stdOf = (d: RequiredDoc): string | null => {
  const s = String(d.std_key ?? "").trim();
  return s && s !== "__none__" ? s : null;
};
const targetOf = (d: RequiredDoc): string | null => {
  const t = String(d.target_person ?? "").trim();
  return t && t !== "self" ? t : null;
};

function conditionsKo(o: { validity_days?: number | null; issued_within_days?: number | null; original_required?: boolean | null }, s: CatalogStandard): string {
  const conds: string[] = [];
  const validity = o.validity_days ?? s.validity_days;
  const within = o.issued_within_days ?? s.issued_within_days;
  const original = o.original_required ?? s.original_required;
  if (validity != null) conds.push(`유효기간 ${validity}일`);
  if (within != null) conds.push(`발급 후 ${within}일 이내`);
  if (original === true) conds.push("원본 제출");
  return conds.join(" · ");
}
function conditionsVi(o: { validity_days?: number | null; issued_within_days?: number | null; original_required?: boolean | null }, s: CatalogStandard): string {
  const conds: string[] = [];
  const validity = o.validity_days ?? s.validity_days;
  const within = o.issued_within_days ?? s.issued_within_days;
  const original = o.original_required ?? s.original_required;
  if (validity != null) conds.push(`Hiệu lực ${validity} ngày`);
  if (within != null) conds.push(`Cấp trong vòng ${within} ngày`);
  if (original === true) conds.push("Nộp bản gốc");
  return conds.join(" · ");
}

/**
 * 학과의 항목 행 → 발급서류 줄 (옛 JSONB 발급서류 줄과 같은 모양).
 *   · 한 줄 = 항목 베트남 기준 구성의 칸 하나. 대체 가능 서류는 메모(notes)에 적는다.
 *   · name_ko 는 대상자가 있으면 "(아버지)" 접미 — 옛 JSONB 캐시와 같아서 legacy 업로드 키(key::이름)가 그대로 맞는다.
 *   · key(옛 A enum)는 옛 JSONB 에 같은 표준·대상자 줄이 있으면 잇고, 없으면 other.
 *   · 같은 표준·대상자가 여러 항목에서 나오면 앞의 것만.
 */
export function renderIssuedDocs(rows: SpecDocItemRow[], catalog: DocCatalog, legacyDocs: RequiredDoc[]): SpecIssuedDoc[] {
  const itemByKey = new Map(catalog.items.map((i) => [i.key, i]));
  const prevBy = new Map<string, RequiredDoc>();
  for (const d of legacyDocs) {
    const s = stdOf(d);
    if (s && !prevBy.has(`${s}|${targetOf(d) ?? ""}`)) prevBy.set(`${s}|${targetOf(d) ?? ""}`, d);
  }
  const seen = new Set<string>();
  const out: SpecIssuedDoc[] = [];
  for (const r of [...rows].sort((a, b) => a.sort_order - b.sort_order)) {
    const item = itemByKey.get(r.item_key);
    if (!item) continue;
    const ov = r.overrides?.standards ?? {};
    for (const e of expandItem(item, catalog)) {
      const s = e.standard;
      const dedup = `${s.key}|${e.target ?? ""}`;
      if (seen.has(dedup)) continue;
      seen.add(dedup);
      const prev = prevBy.get(dedup);
      const o = ov[s.key] ?? {};
      const notarization = (o.notarization ?? s.notarization ?? "").trim() || null;
      const guideKo = r.guide_override_ko?.trim() || item.guide_ko?.trim() || s.guide_ko?.trim() || "";
      const guideVi = r.guide_override_vi?.trim() || item.guide_vi?.trim() || s.guide_vi?.trim() || guideKo;
      const altKo = e.alternatives.length ? `대체 가능: ${e.alternatives.map((a) => a.name_ko).join(", ")}` : "";
      const altVi = e.alternatives.length
        ? `Có thể thay bằng: ${e.alternatives.map((a) => a.name_vi || a.name_ko).join(", ")}`
        : "";
      const notes = [guideKo, conditionsKo(o, s), altKo].filter(Boolean).join("\n") || null;
      const notesVi = [guideVi, conditionsVi(o, s), altVi].filter(Boolean).join("\n") || null;
      const targetKo = e.target ? TARGET_LABEL_KO[e.target] ?? e.target : null;
      const targetVi = e.target ? TARGET_LABEL_VI[e.target] ?? e.target : null;
      out.push({
        key: String(prev?.key ?? "other").trim() || "other",
        name_ko: targetKo ? `${s.name_ko} (${targetKo})` : s.name_ko,
        name_vi: s.name_vi ? (targetVi ? `${s.name_vi} (${targetVi})` : s.name_vi) : null,
        notes,
        notes_vi: notesVi,
        notarization,
        required: r.required !== false && e.required,
        kind: "issued",
        std_key: s.key,
        target_person: e.target,
        item_key: r.item_key,
        alternatives: e.alternatives.map((a) => ({ key: a.key, name_ko: a.name_ko, name_vi: a.name_vi })),
      });
    }
  }
  return out;
}

export function formDocOf(file: SpecFormFile): SpecFormDoc {
  return {
    key: file.key,
    name_ko: file.name_ko,
    name_vi: null,
    // 양식 파일 notes 는 업로드 메모(운영용)라 학생 화면에 내보내지 않는다
    notes: null,
    notarization: null,
    required: true,
    kind: "form",
    std_key: null,
    target_person: null,
    file,
  };
}

/**
 * 학과 목록 → 학과별 서류(발급 + 작성). 카탈로그·항목 행·양식 파일을 한 번에 읽는다.
 *   legacyBySpec: 요강 id → 옛 required_documents (key 잇기용). 없으면 모두 other.
 */
export async function loadDepartmentDocuments(
  supabase: Client,
  departments: SpecDepartmentRow[],
  legacyBySpec?: Map<string, RequiredDoc[]>
): Promise<Map<string, DepartmentDocuments>> {
  const out = new Map<string, DepartmentDocuments>();
  if (departments.length === 0) return out;
  const ids = Array.from(new Set(departments.map((d) => d.id)));
  const [catalog, rowsByDept, filesByDept] = await Promise.all([
    loadDocCatalog(supabase),
    loadSpecDocItemRowsByDepartment(supabase, ids),
    loadFormFilesByDepartment(supabase, ids),
  ]);
  for (const dept of departments) {
    if (out.has(dept.id)) continue;
    const formFiles = filesByDept.get(dept.id) ?? [];
    out.set(dept.id, {
      department: dept,
      issued: renderIssuedDocs(rowsByDept.get(dept.id) ?? [], catalog, legacyBySpec?.get(dept.spec_id) ?? []),
      forms: formFiles.map(formDocOf),
      formFiles,
    });
  }
  return out;
}

/**
 * 지원 목록 → 지원별 서류. 학과를 못 찾은 지원은 null (호출부가 옛 JSONB 로 폴백).
 */
export async function loadApplicationDocuments(
  supabase: Client,
  apps: AppLike[]
): Promise<{
  specs: Map<string, SpecLite>;
  deptByApp: Map<string, SpecDepartmentRow | null>;
  byApp: Map<string, DepartmentDocuments | null>;
}> {
  const { specs, deptByApp } = await loadApplicationDepartments(supabase, apps);
  const depts: SpecDepartmentRow[] = [];
  const seen = new Set<string>();
  for (const d of deptByApp.values()) {
    if (d && !seen.has(d.id)) {
      seen.add(d.id);
      depts.push(d);
    }
  }
  const legacyBySpec = new Map<string, RequiredDoc[]>();
  for (const s of specs.values()) legacyBySpec.set(s.id, s.required_documents);
  const docsByDept = await loadDepartmentDocuments(supabase, depts, legacyBySpec);
  const byApp = new Map<string, DepartmentDocuments | null>();
  for (const a of apps) {
    const d = deptByApp.get(a.id);
    byApp.set(a.id, d ? docsByDept.get(d.id) ?? null : null);
  }
  return { specs, deptByApp, byApp };
}

/** 요강 하나의 학과별 서류 (센터 요강 상세) */
export async function loadSpecDocuments(
  supabase: Client,
  spec: { id: string; required_documents?: unknown }
): Promise<{ departments: SpecDepartmentRow[]; byDept: Map<string, DepartmentDocuments> }> {
  const deptsBySpec = await loadSpecDepartments(supabase, [spec.id]);
  const departments = deptsBySpec.get(spec.id) ?? [];
  const legacy = new Map<string, RequiredDoc[]>([
    [spec.id, (Array.isArray(spec.required_documents) ? spec.required_documents : []) as RequiredDoc[]],
  ]);
  const byDept = await loadDepartmentDocuments(supabase, departments, legacy);
  return { departments, byDept };
}

/** 요강의 학기(일정) */
export type SpecTermRow = { id: string; term: string; schedule: unknown; notes: string | null; sort_order: number };
export async function loadSpecTerms(supabase: Client, specIds: string[]): Promise<Map<string, SpecTermRow[]>> {
  const out = new Map<string, SpecTermRow[]>();
  if (specIds.length === 0) return out;
  const { data } = await supabase
    .from("study_spec_terms")
    .select("id, spec_id, term, schedule, notes, sort_order")
    .in("spec_id", specIds)
    .order("sort_order")
    .order("term", { ascending: false });
  for (const t of data ?? []) {
    if (!out.has(t.spec_id)) out.set(t.spec_id, []);
    out.get(t.spec_id)!.push({ id: t.id, term: t.term, schedule: t.schedule, notes: t.notes, sort_order: t.sort_order });
  }
  return out;
}

/** 학과 종류 → 옛 program_type 라벨 키 (배지용 best-effort) */
export function programTypeOfDepartment(dept: SpecDepartmentRow | null | undefined): string | null {
  if (!dept) return null;
  if (dept.kind === "language") return "language_program";
  const years = dept.info?.years;
  if (years === 2) return "associate_2yr";
  if (years === 4) return "bachelor_4yr";
  return null;
}
