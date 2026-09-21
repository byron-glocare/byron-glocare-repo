/**
 * 모집요강 PDF(베트남어 전용) — 데이터 로더 + 화면 모델.
 *   요강 1개(대학) → 학과별 한 장. 학과 1개 또는 활성 학과 전부, 학기 1개.
 *   화면은 이 모델만 그린다(문구·포맷은 brochure-text.ts).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import { expandItem, loadDocCatalog, type DocCatalog, type SpecDocItemRow } from "./spec-doc-items";
import {
  loadDocItemRowsByDepartment,
  loadFormFilesByDepartment,
  loadSpecDepartments,
  loadSpecTerms,
  type SpecDepartment,
  type SpecFormFile,
  type SpecTerm,
} from "./spec-departments";
import {
  ALT_PATH_VI,
  APPLIES_TO_VI,
  DOC_COND_VI,
  EDUCATION_VI,
  FEE_VI,
  L,
  LP_VI,
  SCHEDULE_VI,
  TARGET_VI,
  TUITION_UNIT_VI,
  ageRequirementVi,
  financialVi,
  fmtDate,
  fmtMoney,
  fmtRange,
  gpaVi,
  hasHangul,
  roundNameVi,
  scholarshipBenefitVi,
  termLabelVi,
  termSortKey,
  topikVi,
} from "./brochure-text";

type Client = SupabaseClient<Database>;

// ── 화면 모델 ─────────────────────────────────────────────────────────

export type BrochureRow = { label: string; value: string };
export type BrochureListItem = { text: string; sub?: string[]; note?: string };
export type BrochureBlock =
  | { type: "rows"; title?: string; rows: BrochureRow[] }
  | { type: "list"; title?: string; items: BrochureListItem[]; ordered?: boolean }
  | { type: "text"; title?: string; text: string }
  | { type: "footnote"; text: string };
export type BrochureSection = { title: string; blocks: BrochureBlock[] };

export type BrochurePage = {
  sdId: string;
  universityName: string;
  departmentName: string;
  termLabel: string;
  courseLabel: string;
  quota: number | null;
  facts: string[];
  intro: string | null;
  sections: BrochureSection[];
};

export type BrochureOption = { value: string; label: string };
export type BrochureModel = {
  specId: string;
  universityNameKo: string;
  logoUrl: string | null;
  term: string | null;
  termOptions: BrochureOption[];
  deptOptions: BrochureOption[];
  dept: string;
  pages: BrochurePage[];
};

// ── 입력 JSON 모양 (느슨하게) ─────────────────────────────────────────

type Elig = {
  age_requirement?: Parameters<typeof ageRequirementVi>[0];
  education_required?: string;
  gpa_min?: number | null;
  gpa_scale?: string | null;
  korean_proficiency?: {
    topik_min_default?: number | null;
    alternative_paths?: Array<{ type?: string; level?: string; name?: string; description?: string }>;
    post_admission_requirement?: string | null;
  };
  english_proficiency?: { minimums?: Record<string, number | string> } | null;
  financial_minimum?: Parameters<typeof financialVi>[0];
};
type Tuition = {
  currency?: string;
  unit?: string;
  disclosure_state?: string;
  application_fee?: number | null;
  admission_fee?: number | null;
  tuition_per_semester?: number | null;
  tuition_per_year?: number | null;
  tuition_by_faculty?: Record<string, number>;
  dorm_fee?: number | null;
  insurance_per_year?: number | null;
  other_fees?: Array<{ name?: string; amount?: number; notes?: string }>;
  payment_method?: string;
};
type Scholarship = {
  name?: string;
  applies_to?: string;
  condition?: string;
  benefit_type?: string;
  benefit_value?: number | string | null;
  tiered_by_topik?: Record<string, number | string> | null;
  duration?: string | null;
  notes?: string | null;
};
type Round = {
  name?: string;
  application_open?: string | null;
  application_close?: string | null;
  document_submission_close?: string | null;
  interview?: string | null;
  interview_period?: [string, string];
  result_announcement?: string | null;
  payment_period?: [string, string];
  visa_certificate_issuance?: [string, string];
};
type Schedule = {
  rounds?: Round[];
  main_enrollment_period?: [string, string];
  additional_enrollment_period?: [string, string];
  orientation?: string | null;
  semester_start?: string | null;
  semester_end?: string | null;
};

const nonEmpty = (o: unknown): o is Record<string, unknown> => !!o && typeof o === "object" && !Array.isArray(o) && Object.keys(o as object).length > 0;
const clean = (s: string | null | undefined): string | null => {
  const t = String(s ?? "").trim();
  return t || null;
};
/** 베트남어 PDF 에 넣을 수 있는 자유 입력(한국어가 섞였으면 뺀다) */
const viOnly = (s: string | null | undefined): string | null => {
  const t = clean(s);
  return t && !hasHangul(t) ? t : null;
};

// ── 섹션 만들기 ───────────────────────────────────────────────────────

function eligibilityBlocks(sd: SpecDepartment, specElig: Elig | null): BrochureBlock[] {
  const e: Elig = (nonEmpty(sd.eligibility) ? (sd.eligibility as Elig) : specElig) ?? {};
  const rows: BrochureRow[] = [];
  const edu = e.education_required ? EDUCATION_VI[e.education_required] : null;
  if (edu) rows.push({ label: L.education, value: edu });
  const gpa = gpaVi(e.gpa_min, e.gpa_scale);
  if (gpa) rows.push({ label: L.gpa, value: gpa });
  const age = ageRequirementVi(e.age_requirement);
  if (age) rows.push({ label: L.age, value: age });

  const topik = topikVi(e.korean_proficiency?.topik_min_default ?? sd.info.korean_min_topik ?? null);
  const alts = (e.korean_proficiency?.alternative_paths ?? [])
    .map((a) => {
      const base = (a.type && ALT_PATH_VI[a.type]) || viOnly(a.name) || null;
      if (!base) return null;
      const lv = viOnly(a.level);
      return lv ? `${base} (${lv})` : base;
    })
    .filter((x): x is string => !!x);
  if (topik || alts.length) {
    const parts = [topik, alts.length ? `${L.koreanAlt}: ${alts.join("; ")}` : null].filter(Boolean);
    rows.push({ label: L.korean, value: parts.join("\n") });
  }
  const eng = e.english_proficiency?.minimums;
  if (eng && Object.keys(eng).length) {
    rows.push({ label: L.english, value: Object.entries(eng).map(([k, v]) => `${k.replace(/_/g, " ")} ${v}`).join(" · ") });
  }
  const fin = financialVi(e.financial_minimum);
  if (fin) rows.push({ label: L.financial, value: fin });

  const blocks: BrochureBlock[] = [];
  if (rows.length) blocks.push({ type: "rows", rows });

  if (sd.kind === "language") {
    const lp = sd.info.language_program ?? {};
    const lpRows: BrochureRow[] = [];
    const load = [
      lp.hours_per_week != null ? LP_VI.hoursPerWeek(lp.hours_per_week) : null,
      lp.hours_per_semester != null ? LP_VI.hoursPerSemester(lp.hours_per_semester) : null,
      lp.weeks_per_semester != null ? LP_VI.weeks(lp.weeks_per_semester) : null,
    ].filter(Boolean);
    if (load.length) lpRows.push({ label: L.program, value: load.join(" · ") });
    const sched = viOnly(lp.weekly_schedule);
    if (sched) lpRows.push({ label: LP_VI.schedule, value: sched });
    const visa = viOnly(lp.visa_type);
    if (visa) lpRows.push({ label: LP_VI.visa, value: visa });
    const ext = viOnly(lp.visa_extension);
    if (ext) lpRows.push({ label: LP_VI.visaExtension, value: ext });
    if (lpRows.length) blocks.push({ type: "rows", title: L.program, rows: lpRows });
  }

  const pref = clean(sd.info.brochure_vi?.preferences);
  if (pref) blocks.push({ type: "text", title: L.preferences, text: pref });
  return blocks;
}

function tuitionBlocks(sd: SpecDepartment, dormDefault: string | null): BrochureBlock[] {
  const t = sd.tuition as Tuition;
  const cur = t.currency || "KRW";
  const rows: BrochureRow[] = [];
  const pending = t.unit === "pending" || t.disclosure_state === "pending_until_acceptance";
  const mainAmount =
    t.unit === "per_year" ? t.tuition_per_year : t.tuition_per_semester ?? sd.info.tuition_per_semester_krw ?? null;
  const mainLabel = TUITION_UNIT_VI[t.unit ?? "per_semester"] ?? TUITION_UNIT_VI.per_semester;
  if (pending) rows.push({ label: L.tuitionTitle, value: L.tuitionPending });
  else if (mainAmount != null) rows.push({ label: mainLabel, value: fmtMoney(mainAmount, cur)! });
  if (!pending && t.unit !== "per_year" && t.tuition_per_year != null) rows.push({ label: TUITION_UNIT_VI.per_year, value: fmtMoney(t.tuition_per_year, cur)! });
  for (const [k, v] of Object.entries(t.tuition_by_faculty ?? {})) {
    if (typeof v === "number") rows.push({ label: k, value: fmtMoney(v, cur)! });
  }
  if (t.application_fee != null) rows.push({ label: FEE_VI.application_fee, value: t.application_fee === 0 ? "Miễn phí" : fmtMoney(t.application_fee, cur)! });
  if (t.admission_fee != null) rows.push({ label: FEE_VI.admission_fee, value: t.admission_fee === 0 ? "Miễn phí" : fmtMoney(t.admission_fee, cur)! });
  if (t.insurance_per_year != null) rows.push({ label: FEE_VI.insurance_per_year, value: fmtMoney(t.insurance_per_year, cur)! });
  if (t.dorm_fee != null) rows.push({ label: FEE_VI.dorm_fee, value: fmtMoney(t.dorm_fee, cur)! });
  for (const f of t.other_fees ?? []) {
    const name = clean(f.name);
    if (name && f.amount != null) rows.push({ label: name, value: fmtMoney(f.amount, cur)! });
  }
  const pay = viOnly(t.payment_method);
  if (pay) rows.push({ label: FEE_VI.payment_method, value: pay });

  const blocks: BrochureBlock[] = [];
  if (rows.length) blocks.push({ type: "rows", title: L.tuitionTitle, rows });

  const sch = (sd.scholarships as Scholarship[]).filter((s) => s && (clean(s.name) || clean(s.condition)));
  if (sch.length) {
    blocks.push({
      type: "list",
      title: L.scholarshipTitle,
      items: sch.map((s) => {
        const benefit = scholarshipBenefitVi(s);
        const sub = [
          clean(s.condition),
          s.applies_to ? APPLIES_TO_VI[s.applies_to] : null,
          clean(s.duration),
        ].filter((x): x is string => !!x);
        return { text: [clean(s.name), benefit].filter(Boolean).join(" — "), sub, note: clean(s.notes) ?? undefined };
      }),
    });
  }

  const dorm = clean(sd.info.brochure_vi?.dormitory) ?? dormDefault;
  if (dorm) blocks.push({ type: "text", title: L.dormitoryTitle, text: dorm });
  return blocks;
}

function scheduleBlocks(sd: SpecDepartment, term: SpecTerm | null): BrochureBlock[] {
  const blocks: BrochureBlock[] = [];
  const s = (term ? (sd.kind === "language" ? term.schedule_language : term.schedule) : {}) as Schedule;
  const rounds = (s.rounds ?? []).filter(Boolean);
  rounds.forEach((r, i) => {
    const rows: BrochureRow[] = [];
    const add = (label: string, v: string | null) => { if (v) rows.push({ label, value: v }); };
    add(SCHEDULE_VI.application, fmtRange(r.application_open, r.application_close));
    add(SCHEDULE_VI.documents, fmtDate(r.document_submission_close));
    add(SCHEDULE_VI.interview, r.interview_period ? fmtRange(r.interview_period[0], r.interview_period[1]) : fmtDate(r.interview));
    add(SCHEDULE_VI.result, fmtDate(r.result_announcement));
    add(SCHEDULE_VI.payment, r.payment_period ? fmtRange(r.payment_period[0], r.payment_period[1]) : null);
    add(SCHEDULE_VI.visa, r.visa_certificate_issuance ? fmtRange(r.visa_certificate_issuance[0], r.visa_certificate_issuance[1]) : null);
    if (rows.length) blocks.push({ type: "rows", title: roundNameVi(r.name, i, rounds.length), rows });
  });
  const common: BrochureRow[] = [];
  const add = (label: string, v: string | null) => { if (v) common.push({ label, value: v }); };
  add(SCHEDULE_VI.enrollment, s.main_enrollment_period ? fmtRange(s.main_enrollment_period[0], s.main_enrollment_period[1]) : null);
  add(SCHEDULE_VI.enrollmentExtra, s.additional_enrollment_period ? fmtRange(s.additional_enrollment_period[0], s.additional_enrollment_period[1]) : null);
  add(SCHEDULE_VI.orientation, fmtDate(s.orientation));
  add(SCHEDULE_VI.semesterStart, fmtDate(s.semester_start));
  add(SCHEDULE_VI.semesterEnd, fmtDate(s.semester_end));
  if (common.length) blocks.push({ type: "rows", rows: common });
  const note = clean(sd.info.brochure_vi?.schedule_note);
  if (note) blocks.push({ type: "text", text: note });
  if (blocks.length) blocks.push({ type: "footnote", text: L.scheduleFootnote });
  return blocks;
}

function documentBlocks(rows: SpecDocItemRow[], catalog: DocCatalog, forms: SpecFormFile[]): BrochureBlock[] {
  const itemByKey = new Map(catalog.items.map((i) => [i.key, i]));
  const items: BrochureListItem[] = [];
  const seen = new Set<string>();
  for (const r of [...rows].sort((a, b) => a.sort_order - b.sort_order)) {
    const item = itemByKey.get(r.item_key);
    if (!item) continue;
    const ov = r.overrides?.standards ?? {};
    for (const e of expandItem(item, catalog)) {
      const sig = `${e.standard.key}|${e.target ?? ""}`;
      if (seen.has(sig)) continue;
      seen.add(sig);
      const nameOf = (s: { name_vi: string | null; name_ko: string }) => clean(s.name_vi) ?? s.name_ko;
      const target = e.target ? TARGET_VI[e.target] ?? null : null;
      let text = nameOf(e.standard);
      if (target) text += ` (${target})`;
      if (e.alternatives.length) text += ` ${L.or} ${e.alternatives.map(nameOf).join(` ${L.or} `)}`;
      const required = r.required !== false && e.required;
      if (!required) text += ` ${L.optional}`;
      const o = ov[e.standard.key] ?? {};
      const within = o.issued_within_days ?? e.standard.issued_within_days;
      const validity = o.validity_days ?? e.standard.validity_days;
      const original = o.original_required ?? e.standard.original_required;
      const conds = [
        within != null ? DOC_COND_VI.issuedWithin(within) : null,
        within == null && validity != null ? DOC_COND_VI.validity(validity) : null,
        original === true ? DOC_COND_VI.original : null,
      ].filter((x): x is string => !!x);
      const guide = viOnly(r.guide_override_vi);
      items.push({ text, sub: conds.length ? [conds.join(" · ")] : undefined, note: guide ?? undefined });
    }
  }
  const blocks: BrochureBlock[] = [];
  if (items.length) blocks.push({ type: "list", items, ordered: true });
  if (forms.length) {
    blocks.push({ type: "list", items: forms.map((f) => ({ text: `${L.schoolForms}: ${f.name_ko}` })) });
  }
  return blocks;
}

// ── 로더 ──────────────────────────────────────────────────────────────

export async function loadBrochure(
  supabase: Client,
  specId: string,
  opts: { dept?: string | null; term?: string | null }
): Promise<BrochureModel | null> {
  const { data: spec } = await supabase.from("study_admission_specs").select("id, university_id, eligibility").eq("id", specId).maybeSingle();
  if (!spec) return null;

  const [{ data: uni }, departments, terms, rowsByDept, filesByDept, catalog, { data: offerings }] = await Promise.all([
    supabase.from("universities").select("id, name_ko, name_vi, region_vi, logo_url, dormitory_desc_vi").eq("id", spec.university_id).maybeSingle(),
    loadSpecDepartments(supabase, specId),
    loadSpecTerms(supabase, specId),
    loadDocItemRowsByDepartment(supabase, specId),
    loadFormFilesByDepartment(supabase, spec.university_id),
    loadDocCatalog(supabase),
    supabase.from("study_offerings").select("department_id, term, intake_quota, status").eq("university_id", spec.university_id).neq("status", "archived"),
  ]);

  const sortedTerms = [...terms].sort((a, b) => termSortKey(b.term) - termSortKey(a.term));
  const term = sortedTerms.find((t) => t.term === opts.term) ?? sortedTerms[0] ?? null;

  const deptParam = opts.dept && departments.some((d) => d.id === opts.dept) ? opts.dept : "all";
  const chosen = deptParam === "all" ? departments.filter((d) => d.is_active) : departments.filter((d) => d.id === deptParam);

  const universityName = clean(uni?.name_vi) ?? uni?.name_ko ?? "";
  const specElig = nonEmpty(spec.eligibility) ? (spec.eligibility as Elig) : null;
  const dormDefault = clean(uni?.dormitory_desc_vi);

  const quotaOf = (departmentId: number): number | null => {
    if (!term) return null;
    const list = (offerings ?? []).filter((o) => o.department_id === departmentId && o.term === term.term && o.intake_quota != null);
    const pick = list.find((o) => o.status === "published") ?? list[0];
    return pick?.intake_quota ?? null;
  };

  const pages: BrochurePage[] = chosen.map((sd) => {
    const bv = sd.info.brochure_vi ?? {};
    const facts: string[] = [];
    const region = clean(uni?.region_vi);
    if (region) facts.push(`${L.region}: ${region}`);
    if (sd.kind === "regular" && sd.info.years) facts.push(L.years(sd.info.years));
    const faculty = viOnly(sd.info.faculty);
    if (faculty) facts.push(faculty);
    const track = viOnly(sd.info.track);
    if (track) facts.push(track);

    const raw: BrochureSection[] = [
      { title: L.secEligibility, blocks: eligibilityBlocks(sd, specElig) },
      { title: L.secTuition, blocks: tuitionBlocks(sd, dormDefault) },
      { title: L.secSchedule, blocks: scheduleBlocks(sd, term) },
      { title: L.secCareer, blocks: clean(bv.career_outlook) ? [{ type: "text", text: clean(bv.career_outlook)! }] : [] },
      { title: L.secStrengths, blocks: clean(bv.school_strengths) ? [{ type: "text", text: clean(bv.school_strengths)! }] : [] },
      { title: L.secDocuments, blocks: documentBlocks(rowsByDept.get(sd.id) ?? [], catalog, filesByDept.get(sd.id) ?? []) },
    ];
    return {
      sdId: sd.id,
      universityName,
      departmentName: clean(sd.name_vi) ?? sd.name_ko,
      termLabel: term ? termLabelVi(term.term) : "",
      courseLabel: sd.kind === "language" ? L.courseLanguage : L.courseRegular,
      quota: quotaOf(sd.department_id),
      facts,
      intro: clean(bv.program_intro),
      sections: raw.filter((s) => s.blocks.length > 0),
    };
  });

  return {
    specId,
    universityNameKo: uni?.name_ko ?? "",
    logoUrl: uni?.logo_url ?? null,
    term: term?.term ?? null,
    termOptions: sortedTerms.map((t) => ({ value: t.term, label: `${t.term} · ${termLabelVi(t.term)}` })),
    deptOptions: [
      { value: "all", label: "전체 학과 (활성)" },
      ...departments.map((d) => ({ value: d.id, label: `${d.name_ko}${d.kind === "language" ? " (어학당)" : ""}${d.is_active ? "" : " · 비활성"}` })),
    ],
    dept: deptParam,
    pages,
  };
}
