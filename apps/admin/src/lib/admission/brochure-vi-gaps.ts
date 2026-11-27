/**
 * 모집요강 PDF 베트남어판 — 베트남어가 비어 있는 칸 목록 (KAN-40).
 *   PDF 에 실제로 나가는 칸 중 한국어만 있고 베트남어가 빈 것을 모은다.
 *   화면에서 사람이 베트남어를 넣거나 AI 로 채운 뒤 확인·저장한다(brochure/vi-actions.ts).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import { hasHangul } from "./brochure-text";
import { expandItem, loadDocCatalog } from "./spec-doc-items";
import { loadDocItemRowsByDepartment, loadFormFilesByDepartment, loadSpecDepartments } from "./spec-departments";

type Client = SupabaseClient<Database>;

export const SCHOLARSHIP_VI_FIELDS = {
  name: "name_vi",
  condition: "condition_vi",
  benefit_value: "benefit_vi",
  duration: "duration_vi",
  notes: "notes_vi",
} as const;
type ScholarshipViField = (typeof SCHOLARSHIP_VI_FIELDS)[keyof typeof SCHOLARSHIP_VI_FIELDS];

export type ViTarget =
  | { kind: "university"; field: "name_vi" | "region_vi" | "dormitory_desc_vi" }
  | { kind: "department"; departmentId: number }
  | { kind: "scholarship"; sdId: string; index: number; field: ScholarshipViField }
  | { kind: "faculty_fee"; sdId: string; key: string }
  | { kind: "other_fee"; sdId: string; index: number }
  | { kind: "form"; formId: string }
  | { kind: "doc_standard"; key: string }
  | { kind: "doc_guide"; sdId: string; itemKey: string };

export type ViGap = {
  id: string;
  /** 화면 묶음 (학교 · 학과 이름 · 장학금 …) */
  group: string;
  /** 어디에 쓰이는 글인지 — 화면 표시 + AI 번역 힌트 */
  where: string;
  ko: string;
  target: ViTarget;
};

const filled = (v: unknown) => typeof v === "string" && v.trim() !== "";
const needs = (ko: unknown, vi: unknown): ko is string => typeof ko === "string" && hasHangul(ko) && !filled(vi);

const SCH_LABEL: Record<keyof typeof SCHOLARSHIP_VI_FIELDS, string> = {
  name: "장학금명",
  condition: "장학금 조건",
  benefit_value: "장학금 혜택",
  duration: "장학금 기간",
  notes: "장학금 메모",
};

/** dept: 요강 학과 id 또는 "all"(활성 학과 전부) — 모집요강 PDF 화면과 같은 범위 */
export async function loadBrochureViGaps(supabase: Client, specId: string, dept: string): Promise<ViGap[]> {
  const { data: spec } = await supabase.from("study_admission_specs").select("university_id").eq("id", specId).maybeSingle();
  if (!spec) return [];
  const [{ data: uni }, departments, rowsByDept, filesByDept, catalog] = await Promise.all([
    supabase
      .from("universities")
      .select("name_ko, name_vi, region_ko, region_vi, dormitory_desc_ko, dormitory_desc_vi")
      .eq("id", spec.university_id)
      .maybeSingle(),
    loadSpecDepartments(supabase, specId),
    loadDocItemRowsByDepartment(supabase, specId),
    loadFormFilesByDepartment(supabase, spec.university_id),
    loadDocCatalog(supabase),
  ]);
  const chosen = dept !== "all" && departments.some((d) => d.id === dept) ? departments.filter((d) => d.id === dept) : departments.filter((d) => d.is_active);

  const out: ViGap[] = [];
  const seen = new Set<string>();
  const add = (g: ViGap) => {
    if (seen.has(g.id)) return;
    seen.add(g.id);
    out.push(g);
  };

  // 학교
  if (uni) {
    if (!filled(uni.name_vi)) add({ id: "uni:name", group: "학교", where: "대학 이름", ko: uni.name_ko, target: { kind: "university", field: "name_vi" } });
    if (needs(uni.region_ko, uni.region_vi)) add({ id: "uni:region", group: "학교", where: "대학 소재 지역", ko: uni.region_ko, target: { kind: "university", field: "region_vi" } });
    if (needs(uni.dormitory_desc_ko, uni.dormitory_desc_vi))
      add({ id: "uni:dorm", group: "학교", where: "기숙사 설명", ko: uni.dormitory_desc_ko, target: { kind: "university", field: "dormitory_desc_vi" } });
  }

  const itemByKey = new Map(catalog.items.map((i) => [i.key, i]));
  for (const sd of chosen) {
    const dn = sd.name_ko;
    if (needs(sd.name_ko, sd.name_vi))
      add({ id: `dept:${sd.department_id}`, group: "학과 이름", where: "학과 이름", ko: sd.name_ko, target: { kind: "department", departmentId: sd.department_id } });

    // 장학금
    (sd.scholarships as Array<Record<string, unknown>>).forEach((s, index) => {
      if (!s) return;
      for (const [src, viField] of Object.entries(SCHOLARSHIP_VI_FIELDS) as Array<[keyof typeof SCHOLARSHIP_VI_FIELDS, ScholarshipViField]>) {
        if (needs(s[src], s[viField]))
          add({
            id: `sch:${sd.id}:${index}:${viField}`,
            group: "장학금",
            where: `${dn} · ${SCH_LABEL[src]}`,
            ko: s[src] as string,
            target: { kind: "scholarship", sdId: sd.id, index, field: viField },
          });
      }
    });

    // 학비 — 계열별 이름 · 기타 비용 이름
    const t = sd.tuition as { tuition_by_faculty?: Record<string, number>; tuition_by_faculty_vi?: Record<string, string>; other_fees?: Array<{ name?: string; name_vi?: string }> };
    for (const k of Object.keys(t.tuition_by_faculty ?? {})) {
      if (needs(k, t.tuition_by_faculty_vi?.[k]))
        add({ id: `fac:${sd.id}:${k}`, group: "학비", where: `${dn} · 계열별 학비 이름`, ko: k, target: { kind: "faculty_fee", sdId: sd.id, key: k } });
    }
    (t.other_fees ?? []).forEach((f, index) => {
      if (needs(f?.name, f?.name_vi))
        add({ id: `fee:${sd.id}:${index}`, group: "학비", where: `${dn} · 기타 비용 이름`, ko: f.name as string, target: { kind: "other_fee", sdId: sd.id, index } });
    });

    // 서류 — 서류 이름(전체 공용) · 학과별 안내
    for (const r of rowsByDept.get(sd.id) ?? []) {
      const item = itemByKey.get(r.item_key);
      if (item) {
        for (const e of expandItem(item, catalog)) {
          for (const std of [e.standard, ...e.alternatives]) {
            if (!filled(std.name_vi))
              add({ id: `std:${std.key}`, group: "서류 이름 (모든 대학 공용)", where: "제출 서류 이름", ko: std.name_ko, target: { kind: "doc_standard", key: std.key } });
          }
        }
      }
      if (needs(r.guide_override_ko, r.guide_override_vi))
        add({
          id: `guide:${sd.id}:${r.item_key}`,
          group: "서류 안내",
          where: `${dn} · 제출 서류 안내`,
          ko: r.guide_override_ko as string,
          target: { kind: "doc_guide", sdId: sd.id, itemKey: r.item_key },
        });
    }

    // 학교 양식
    for (const f of filesByDept.get(sd.id) ?? []) {
      if (needs(f.name_ko, f.name_vi))
        add({ id: `form:${f.id}`, group: "학교 양식", where: `${dn} · 학교 양식 이름`, ko: f.name_ko, target: { kind: "form", formId: f.id } });
    }
  }
  return out;
}
