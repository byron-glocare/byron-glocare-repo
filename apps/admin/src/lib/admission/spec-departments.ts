/**
 * 모집요강 = 대학당 1개 · 학과별 서류 · 학기별 일정 (0067) — 공용 로직.
 *
 *   요강 학과(study_spec_departments): 어학당 1개(kind=language, 삭제 불가) + 일반학과.
 *     학과마다 발급서류 항목(study_spec_doc_items.spec_department_id), 작성서류 양식
 *     (study_admission_form_files.spec_department_id), 학비·장학금·(선택)자격을 각자 가진다.
 *     표준/서브 없음 — 다른 학과에서 복사해 시작하고 각자 고친다.
 *   요강 학기(study_spec_terms): 일정. 그 학기에 모집하는 학과 = study_offerings 행.
 *
 *   옛 JSONB(required_documents·departments)는 남은 옛 읽기 코드용 캐시로만 다시 그린다.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import {
  loadDocCatalog,
  renderLegacyFromRows,
  type DocCatalog,
  type LegacyDoc,
  type SpecDocItemRow,
} from "./spec-doc-items";

type Client = SupabaseClient<Database>;

export type SpecDepartmentKind = "language" | "regular";

export type DepartmentInfo = {
  faculty?: string | null;
  name?: string;
  track?: string | null;
  program_kind?: "language" | "degree" | null;
  degree?: string | null;
  years?: number | null;
  extension_eligible?: boolean;
  capacity?: number | string | null;
  korean_min_topik?: number | null;
  english_alt_allowed?: boolean;
  tuition_per_semester_krw?: number | null;
  notes?: string | null;
  is_glocare_target?: boolean;
};

export type SpecDepartment = {
  id: string;
  spec_id: string;
  department_id: number;
  kind: SpecDepartmentKind;
  /** 학과 마스터 이름 (departments.name_ko) */
  name_ko: string;
  name_vi: string | null;
  department_active: boolean;
  info: DepartmentInfo;
  tuition: Record<string, unknown>;
  scholarships: unknown[];
  eligibility: Record<string, unknown> | null;
  is_active: boolean;
  sort_order: number;
};

export type SpecTerm = {
  id: string;
  spec_id: string;
  term: string;
  schedule: Record<string, unknown>;
  notes: string | null;
  sort_order: number;
};

export type SpecFormFile = {
  id: string;
  key: string;
  name_ko: string;
  file_name: string;
  file_url: string;
  spec_department_id: string | null;
  is_essay: boolean | null;
  uploaded_at: string;
};

export const KIND_LABEL: Record<SpecDepartmentKind, string> = { language: "어학당", regular: "일반학과" };

// ── 읽기 ─────────────────────────────────────────────────────────────

export async function loadSpecDepartments(supabase: Client, specId: string): Promise<SpecDepartment[]> {
  const { data } = await supabase
    .from("study_spec_departments")
    .select("id, spec_id, department_id, kind, info, tuition, scholarships, eligibility, is_active, sort_order, departments(name_ko, name_vi, active)")
    .eq("spec_id", specId)
    .order("sort_order")
    .order("created_at");
  const rows = (data ?? []) as unknown as Array<{
    id: string; spec_id: string; department_id: number; kind: SpecDepartmentKind; info: unknown; tuition: unknown;
    scholarships: unknown; eligibility: unknown; is_active: boolean; sort_order: number;
    departments: { name_ko: string; name_vi: string | null; active: boolean } | null;
  }>;
  const out = rows.map((r) => ({
    id: r.id,
    spec_id: r.spec_id,
    department_id: r.department_id,
    kind: r.kind,
    name_ko: r.departments?.name_ko ?? (r.info as DepartmentInfo)?.name ?? `학과 #${r.department_id}`,
    name_vi: r.departments?.name_vi ?? null,
    department_active: r.departments?.active ?? false,
    info: ((r.info ?? {}) as DepartmentInfo) ?? {},
    tuition: ((r.tuition ?? {}) as Record<string, unknown>) ?? {},
    scholarships: (Array.isArray(r.scholarships) ? r.scholarships : []) as unknown[],
    eligibility: (r.eligibility ?? null) as Record<string, unknown> | null,
    is_active: r.is_active,
    sort_order: r.sort_order,
  }));
  // 어학당이 항상 맨 앞
  return out.sort((a, b) => (a.kind === b.kind ? a.sort_order - b.sort_order : a.kind === "language" ? -1 : 1));
}

export async function loadSpecTerms(supabase: Client, specId: string): Promise<SpecTerm[]> {
  const { data } = await supabase
    .from("study_spec_terms")
    .select("id, spec_id, term, schedule, notes, sort_order")
    .eq("spec_id", specId)
    .order("term", { ascending: false });
  return (data ?? []).map((r) => ({
    id: r.id, spec_id: r.spec_id, term: r.term,
    schedule: ((r.schedule ?? {}) as Record<string, unknown>) ?? {}, notes: r.notes, sort_order: r.sort_order,
  }));
}

/** 요강 학과별 항목 행 — { spec_department_id → rows } */
export async function loadDocItemRowsByDepartment(supabase: Client, specId: string): Promise<Map<string, SpecDocItemRow[]>> {
  const { data } = await supabase
    .from("study_spec_doc_items")
    .select("spec_department_id, item_key, required, sort_order, guide_override_ko, guide_override_vi, overrides")
    .eq("spec_id", specId)
    .order("sort_order");
  const out = new Map<string, SpecDocItemRow[]>();
  for (const r of data ?? []) {
    if (!r.spec_department_id) continue;
    const list = out.get(r.spec_department_id) ?? [];
    list.push({
      item_key: r.item_key, required: r.required, sort_order: r.sort_order,
      guide_override_ko: r.guide_override_ko, guide_override_vi: r.guide_override_vi,
      overrides: (r.overrides ?? {}) as SpecDocItemRow["overrides"],
    });
    out.set(r.spec_department_id, list);
  }
  return out;
}

/** 요강 학과별 현행 작성서류 양식 — { spec_department_id → files } */
export async function loadFormFilesByDepartment(supabase: Client, universityId: number): Promise<Map<string, SpecFormFile[]>> {
  const { data } = await supabase
    .from("study_admission_form_files")
    .select("id, key, name_ko, file_name, file_url, spec_department_id, is_essay, uploaded_at")
    .eq("university_id", universityId)
    .eq("is_current", true)
    .order("key");
  const out = new Map<string, SpecFormFile[]>();
  for (const f of data ?? []) {
    if (!f.spec_department_id) continue;
    const list = out.get(f.spec_department_id) ?? [];
    list.push(f as SpecFormFile);
    out.set(f.spec_department_id, list);
  }
  return out;
}

// ── 쓰기 ─────────────────────────────────────────────────────────────

/** 한 학과의 항목 행을 통째로 바꾼다 (없어진 건 지우고, 있는 건 갱신·추가) */
export async function writeDepartmentDocItems(
  supabase: Client,
  specId: string,
  specDepartmentId: string,
  rows: SpecDocItemRow[]
): Promise<string | null> {
  const keys = rows.map((r) => r.item_key);
  const del = keys.length
    ? await supabase.from("study_spec_doc_items").delete().eq("spec_department_id", specDepartmentId).not("item_key", "in", `(${keys.map((k) => `"${k}"`).join(",")})`)
    : await supabase.from("study_spec_doc_items").delete().eq("spec_department_id", specDepartmentId);
  if (del.error) return `학과 항목 정리 실패: ${del.error.message}`;
  if (rows.length === 0) return null;
  // 부분 유일 인덱스(spec_department_id, item_key)는 upsert onConflict 로 못 쓴다 → 있는 건 갱신, 없는 건 추가
  const { data: existing } = await supabase.from("study_spec_doc_items").select("id, item_key").eq("spec_department_id", specDepartmentId);
  const idByKey = new Map((existing ?? []).map((r) => [r.item_key, r.id]));
  for (const [i, r] of rows.entries()) {
    const payload = {
      spec_id: specId,
      spec_department_id: specDepartmentId,
      item_key: r.item_key,
      required: r.required !== false,
      sort_order: i + 1,
      guide_override_ko: r.guide_override_ko?.trim() || null,
      guide_override_vi: r.guide_override_vi?.trim() || null,
      overrides: r.overrides ?? {},
    };
    const id = idByKey.get(r.item_key);
    const { error } = id
      ? await supabase.from("study_spec_doc_items").update(payload).eq("id", id)
      : await supabase.from("study_spec_doc_items").insert(payload);
    if (error) return `학과 항목 저장 실패: ${error.message}`;
  }
  return null;
}

/**
 * 학과 설정 복사 — from 학과의 발급서류 항목·작성서류 양식·학비·장학금·자격을 to 학과로.
 *   양식은 같은 파일을 가리키는 새 행(슬롯 배치·서술형 설정 포함). to 학과의 기존 양식은 현행에서 내린다.
 *   what 으로 일부만 복사할 수 있다. 기본은 전부.
 */
export async function copyDepartmentSetup(
  supabase: Client,
  from: { id: string; spec_id: string },
  to: { id: string; spec_id: string; university_id: number },
  what: { docs?: boolean; forms?: boolean; tuition?: boolean; scholarships?: boolean; eligibility?: boolean } = {}
): Promise<string | null> {
  const w = { docs: true, forms: true, tuition: true, scholarships: true, eligibility: true, ...what };

  if (w.docs) {
    const { data: rows } = await supabase
      .from("study_spec_doc_items")
      .select("item_key, required, sort_order, guide_override_ko, guide_override_vi, overrides")
      .eq("spec_department_id", from.id)
      .order("sort_order");
    const err = await writeDepartmentDocItems(
      supabase, to.spec_id, to.id,
      (rows ?? []).map((r) => ({ ...r, overrides: (r.overrides ?? {}) as SpecDocItemRow["overrides"] }))
    );
    if (err) return err;
  }

  if (w.forms) {
    const { data: files } = await supabase.from("study_admission_form_files").select("*").eq("spec_department_id", from.id).eq("is_current", true);
    // to 학과의 기존 현행 양식은 내린다 (같은 종류만)
    const keys = (files ?? []).map((f) => f.key);
    if (keys.length) {
      const { error } = await supabase
        .from("study_admission_form_files")
        .update({ is_current: false })
        .eq("spec_department_id", to.id)
        .eq("is_current", true)
        .in("key", keys);
      if (error) return `양식 정리 실패: ${error.message}`;
    }
    for (const f of files ?? []) {
      const { id: _id, created_at: _c, updated_at: _u, superseded_by: _s, ...rest } = f;
      void _id; void _c; void _u; void _s;
      const { error } = await supabase.from("study_admission_form_files").insert({
        ...rest,
        university_id: to.university_id,
        spec_department_id: to.id,
        is_current: true,
        applies_to_department_ids: [],
        department_name: null,
      });
      if (error) return `양식 복사 실패: ${error.message}`;
    }
  }

  if (w.tuition || w.scholarships || w.eligibility) {
    const { data: src } = await supabase.from("study_spec_departments").select("tuition, scholarships, eligibility").eq("id", from.id).maybeSingle();
    if (src) {
      const patch: Database["public"]["Tables"]["study_spec_departments"]["Update"] = {};
      if (w.tuition) patch.tuition = src.tuition ?? {};
      if (w.scholarships) patch.scholarships = src.scholarships ?? [];
      if (w.eligibility) patch.eligibility = src.eligibility ?? null;
      const { error } = await supabase.from("study_spec_departments").update(patch).eq("id", to.id);
      if (error) return `학비·장학금 복사 실패: ${error.message}`;
    }
  }
  return null;
}

// ── 옛 JSONB 캐시 ─────────────────────────────────────────────────────

/** 학과 정보 JSONB (옛 departments 배열) — 옛 읽기 코드용 */
export function departmentsJsonFrom(depts: SpecDepartment[]): DepartmentInfo[] {
  return depts
    .filter((d) => d.is_active)
    .map((d) => ({
      ...d.info,
      name: (d.info.name ?? "").trim() || d.name_ko,
      program_kind: d.kind === "language" ? "language" : "degree",
    }));
}

/**
 * 옛 required_documents 캐시 — 모든 학과의 발급서류를 합쳐(서류·대상자 중복 제거) + 작성서류·미연결 줄 유지.
 * 학과 구분이 없는 옛 읽기 코드(어드민 소수 화면)에만 쓰인다. 학생·센터 화면은 학과별 행을 읽는다.
 */
export async function refreshSpecLegacyCaches(supabase: Client, specId: string): Promise<string | null> {
  const [{ data: spec }, depts, rowsByDept, catalog] = await Promise.all([
    supabase.from("study_admission_specs").select("id, required_documents").eq("id", specId).maybeSingle(),
    loadSpecDepartments(supabase, specId),
    loadDocItemRowsByDepartment(supabase, specId),
    loadDocCatalog(supabase),
  ]);
  if (!spec) return "모집요강을 찾을 수 없습니다.";
  const prev = (Array.isArray(spec.required_documents) ? spec.required_documents : []) as LegacyDoc[];
  const keep = prev.filter((d) => {
    const std = String(d.std_key ?? "").trim();
    return std === "" || std === "__none__" || std.startsWith("doc_form_");
  });
  const seen = new Set<string>();
  const rendered: LegacyDoc[] = [];
  for (const d of depts) {
    for (const doc of renderLegacyFromRows(rowsByDept.get(d.id) ?? [], catalog, prev)) {
      const sig = `${doc.std_key}|${doc.target_person ?? ""}`;
      if (seen.has(sig)) continue;
      seen.add(sig);
      rendered.push(doc);
    }
  }
  const forms = keep.filter((d) => String(d.std_key ?? "").startsWith("doc_form_"));
  const unlinked = keep.filter((d) => !String(d.std_key ?? "").startsWith("doc_form_"));
  const { error } = await supabase
    .from("study_admission_specs")
    .update({ required_documents: [...forms, ...rendered, ...unlinked], departments: departmentsJsonFrom(depts) })
    .eq("id", specId);
  return error ? `요강 캐시 갱신 실패: ${error.message}` : null;
}

export type { DocCatalog, SpecDocItemRow };
