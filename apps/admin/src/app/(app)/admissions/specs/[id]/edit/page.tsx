/**
 * /admissions/specs/[id]/edit — 모집요강 편집 (대학당 1개 · 학과별 서류 · 학기별 일정).
 *   기본 탭: 요강 공통 (통째 저장)
 *   학과 탭: 어학당 + 일반학과, 학과마다 따로 저장 (자격은 학과별, 어학당은 어학연수 프로그램 포함)
 *   학기 탭: 학기마다 일정(일반학과·어학당 따로) + 모집 학과
 *   ?tab=departments|terms 로 시작 탭 지정.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { loadFormDocKeys } from "@/lib/admission/form-doc-keys";
import { loadDocCatalog, type LegacyDoc, type SpecDocItemRow } from "@/lib/admission/spec-doc-items";
import {
  loadDocItemRowsByDepartment,
  loadFormFilesByDepartment,
  loadSpecDepartments,
  loadSpecTerms,
  type SpecDepartmentKind,
  type SpecFormFile,
} from "@/lib/admission/spec-departments";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { SpecDepartmentEditor, type CopySourceUniversity, type ImportSources } from "@/components/admission/spec-department-editor";
import { LegacyDocRows, type LegacyDocRow } from "@/components/admission/legacy-doc-rows";
import { isFormDoc } from "@/lib/admission/classify-documents";
import { SpecTermEditor, type TermDept, type TermOffering } from "@/components/admission/spec-term-editor";

import { EditSpecForm, type EditableSpec, type EditTab } from "./edit-form";

export const dynamic = "force-dynamic";

/** Supabase 1000행 제한을 넘는 목록 — 페이지로 끝까지 읽는다 */
async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  const size = 1000;
  const out: T[] = [];
  for (let from = 0; from < 50_000; from += size) {
    const { data } = await page(from, from + size - 1);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < size) break;
  }
  return out;
}

/** 서버 데이터 버전 — 카드 key 용 (짧은 해시) */
function rev(v: unknown): string {
  const s = JSON.stringify(v ?? null);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export default async function EditAdmissionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const initialTab: EditTab = sp.tab === "departments" || sp.tab === "terms" ? sp.tab : "basic";
  const supabase = await createClient();

  const { data: spec } = await supabase.from("study_admission_specs").select("*").eq("id", id).maybeSingle();
  if (!spec) notFound();

  const [
    { data: university },
    { data: masters },
    docCatalog,
    formDocKeys,
    departments,
    terms,
    rowsByDept,
    filesByDept,
    { data: offeringRows },
    { data: otherSpecs },
  ] = await Promise.all([
    supabase.from("universities").select("id, name_ko").eq("id", spec.university_id).maybeSingle(),
    supabase.from("departments").select("id, name_ko, active").eq("university_id", spec.university_id).order("sort_order").order("id"),
    loadDocCatalog(supabase),
    loadFormDocKeys(supabase),
    loadSpecDepartments(supabase, id),
    loadSpecTerms(supabase, id),
    loadDocItemRowsByDepartment(supabase, id),
    loadFormFilesByDepartment(supabase, spec.university_id),
    supabase.from("study_offerings").select("id, department_id, term, status, intake_quota, total_quota").eq("university_id", spec.university_id),
    supabase
      .from("study_admission_specs")
      .select("id, university_id, universities(name_ko)")
      .neq("status", "archived")
      .neq("id", id)
      .order("university_id"),
  ]);

  // 가져오기(복사) 원본 — 다른 대학의 활성 요강 학과들
  const otherIds = (otherSpecs ?? []).map((s) => s.id);
  const { data: otherDepts } = otherIds.length
    ? await supabase
        .from("study_spec_departments")
        .select("id, spec_id, kind, sort_order, departments(name_ko)")
        .in("spec_id", otherIds)
        .order("sort_order")
    : { data: [] as never[] };
  const copySources: CopySourceUniversity[] = (otherSpecs ?? []).map((s) => ({
    university_id: s.university_id,
    name_ko: (s.universities as unknown as { name_ko: string } | null)?.name_ko ?? `대학 #${s.university_id}`,
    departments: ((otherDepts ?? []) as unknown as Array<{ id: string; spec_id: string; kind: SpecDepartmentKind; departments: { name_ko: string } | null }>)
      .filter((d) => d.spec_id === s.id)
      .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "language" ? -1 : 1))
      .map((d) => ({ id: d.id, name_ko: d.departments?.name_ko ?? "학과", kind: d.kind })),
  }));

  // 가져오기(문서 단위 복사) 원본 — 이 요강 + 다른 활성 요강의 학과·현행 양식·발급서류 항목 행, 학기(일정 복사용)
  const uniNameBySpec = new Map<string, { university_id: number; name: string }>([
    [id, { university_id: spec.university_id, name: university?.name_ko ?? `대학 #${spec.university_id}` }],
  ]);
  for (const s of otherSpecs ?? []) {
    uniNameBySpec.set(s.id, { university_id: s.university_id, name: (s.universities as unknown as { name_ko: string } | null)?.name_ko ?? `대학 #${s.university_id}` });
  }
  const allSpecIds = Array.from(uniNameBySpec.keys());
  type DeptLite = { id: string; spec_id: string; kind: SpecDepartmentKind; departments: { name_ko: string } | null };
  const allDepts: DeptLite[] = [
    ...departments.map((d) => ({ id: d.id, spec_id: id, kind: d.kind, departments: { name_ko: d.name_ko } })),
    ...((otherDepts ?? []) as unknown as DeptLite[]),
  ];
  const deptById = new Map(allDepts.map((d) => [d.id, d]));
  const [importFormRows, importItemRows, termRows] = await Promise.all([
    fetchAll((from, to) =>
      supabase
        .from("study_admission_form_files")
        .select("id, name_ko, file_name, is_essay, spec_department_id")
        .eq("is_current", true)
        .not("spec_department_id", "is", null)
        .order("id")
        .range(from, to)
    ),
    fetchAll((from, to) =>
      supabase
        .from("study_spec_doc_items")
        .select("id, item_key, spec_department_id")
        .in("spec_id", allSpecIds)
        .not("spec_department_id", "is", null)
        .order("id")
        .range(from, to)
    ),
    fetchAll((from, to) => supabase.from("study_spec_terms").select("id, term, spec_id").in("spec_id", allSpecIds).order("id").range(from, to)),
  ]);
  const importSources: ImportSources = {
    depts: allDepts.map((d) => {
      const u = uniNameBySpec.get(d.spec_id);
      return { id: d.id, name: d.departments?.name_ko ?? "학과", kind: d.kind, university_id: u?.university_id ?? 0, university: u?.name ?? "?" };
    }),
    forms: importFormRows
      .filter((f) => f.spec_department_id && deptById.has(f.spec_department_id))
      .map((f) => ({ id: f.id, sd: f.spec_department_id as string, name: f.name_ko, file: f.file_name, essay: !!f.is_essay })),
    items: importItemRows
      .filter((r) => r.spec_department_id && deptById.has(r.spec_department_id))
      .map((r) => ({ id: r.id, sd: r.spec_department_id as string, key: r.item_key })),
  };
  const sourceTerms = termRows.map((t) => ({ id: t.id, term: t.term, spec_id: t.spec_id, university_name: uniNameBySpec.get(t.spec_id)?.name ?? "?" }));

  // 옛 JSONB 작성서류·미연결 줄 — 배열 index 를 함께 보낸다(줄마다 학과로 옮기거나 지운다)
  const legacyAll = (Array.isArray(spec.required_documents) ? spec.required_documents : []) as LegacyDoc[];
  const legacyRows: LegacyDocRow[] = [];
  legacyAll.forEach((d, index) => {
    const std = String(d.std_key ?? "").trim();
    const form = isFormDoc(d, formDocKeys);
    if (!form && std !== "" && std !== "__none__") return;
    legacyRows.push({
      index,
      name_ko: String(d.name_ko ?? "").trim(),
      notes: String(d.notes ?? "").trim() || null,
      notarization: String(d.notarization ?? "").trim() || null,
      required: d.required !== false,
      kind: form ? "form" : "unlinked",
    });
  });

  const docRowsByDept: Record<string, SpecDocItemRow[]> = {};
  for (const [k, v] of rowsByDept) docRowsByDept[k] = v;
  const formFilesByDept: Record<string, SpecFormFile[]> = {};
  for (const [k, v] of filesByDept) formFilesByDept[k] = v;

  const deptRevisions: Record<string, string> = {};
  for (const d of departments) {
    deptRevisions[d.id] = rev([d.department_id, d.info, d.tuition, d.scholarships, d.eligibility, d.is_active, docRowsByDept[d.id] ?? [], (formFilesByDept[d.id] ?? []).map((f) => f.id)]);
  }
  const termRevisions: Record<string, string> = {};
  for (const t of terms) termRevisions[t.id] = rev([t.term, t.schedule, t.schedule_language, t.notes]);

  const offerings: TermOffering[] = (offeringRows ?? []).map((o) => ({ id: o.id, department_id: o.department_id, term: o.term, status: o.status, intake_quota: o.intake_quota, total_quota: o.total_quota }));
  const termDepts: TermDept[] = departments.map((d) => ({ id: d.id, department_id: d.department_id, name_ko: d.name_ko, kind: d.kind, is_active: d.is_active }));

  return (
    <>
      <PageHeader
        title="모집요강 편집"
        description={`${university?.name_ko ?? "?"} · 학과 ${departments.length} · 학기 ${terms.length}`}
        breadcrumbs={[
          { label: "입학서류", href: "/admissions" },
          { label: university?.name_ko ?? "상세", href: `/admissions/specs/${id}` },
          { label: "편집" },
        ]}
        actions={
          <Link href={`/admissions/specs/${id}/brochure`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            <FileText className="size-4" />
            모집요강 PDF (베트남어)
          </Link>
        }
      />
      <div className="p-6">
        <EditSpecForm
          spec={spec as EditableSpec}
          universityName={university?.name_ko ?? `대학 #${spec.university_id}`}
          terms={terms.map((t) => t.term)}
          legacyCount={legacyRows.length}
          legacyPanel={
            legacyRows.length > 0 ? (
              <LegacyDocRows
                specId={id}
                universityId={spec.university_id}
                rows={legacyRows}
                items={docCatalog.items.filter((i) => i.is_active).map((i) => ({ key: i.key, name_ko: i.name_ko }))}
                departments={departments.map((d) => ({ id: d.id, name_ko: d.name_ko, kind: d.kind }))}
              />
            ) : null
          }
          initialTab={initialTab}
          counts={{ departments: departments.length, terms: terms.length }}
          departmentsPanel={
            <SpecDepartmentEditor
              specId={id}
              universityId={spec.university_id}
              departments={departments}
              masters={(masters ?? []).map((m) => ({ id: m.id, name_ko: m.name_ko, active: m.active }))}
              docRowsByDept={docRowsByDept}
              formFilesByDept={formFilesByDept}
              catalog={docCatalog}
              copySources={copySources}
              importSources={importSources}
              revisions={deptRevisions}
              specEligibility={spec.eligibility && typeof spec.eligibility === "object" && Object.keys(spec.eligibility as object).length ? (spec.eligibility as never) : null}
            />
          }
          termsPanel={<SpecTermEditor specId={id} terms={terms} departments={termDepts} offerings={offerings} revisions={termRevisions} sourceTerms={sourceTerms} />}
        />
      </div>
    </>
  );
}
