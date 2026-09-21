/**
 * /offerings — 모집 (0067 학과 모델).
 *   대학마다 격자: 행 = 요강 학과(어학당 먼저, 일반학과), 열 = 학기.
 *   칸 = 그 학과가 그 학기에 모집하는지(study_offerings 행) + 상태(초안/오픈/마감)
 *        + 지원자 수 · 글로케어 모집 인원(intake_quota, 오픈 필수) · 학교 전체 정원(total_quota, 0069).
 *   요강 연결은 대학의 요강(보관 아님 1개)으로 자동 — 운영자가 고르지 않는다.
 */

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { OfferingsManager, type OfferingRow, type UniversityBlock, type GridRow } from "./offerings-manager";

export const dynamic = "force-dynamic";

export default async function OfferingsPage({
  searchParams,
}: {
  searchParams: Promise<{ u?: string }>;
}) {
  const sp = await searchParams;
  const filterUni = sp.u ? Number(sp.u) : null;
  const supabase = await createClient();

  const [
    { data: universities },
    { data: departments },
    { data: specs },
    { data: specDepts },
    { data: specTerms },
    { data: offerings, error },
    { data: allSpecs },
    { data: applications },
  ] = await Promise.all([
    supabase.from("universities").select("id, name_ko, active").order("name_ko", { ascending: true }),
    supabase.from("departments").select("id, university_id, name_ko, active").order("sort_order", { ascending: true }),
    supabase
      .from("study_admission_specs")
      .select("id, university_id, status, updated_at")
      .neq("status", "archived")
      .order("updated_at", { ascending: false }),
    supabase
      .from("study_spec_departments")
      .select("id, spec_id, department_id, kind, is_active, sort_order")
      .order("sort_order", { ascending: true }),
    supabase.from("study_spec_terms").select("spec_id, term"),
    supabase
      .from("study_offerings")
      .select(
        "id, university_id, department_id, term, intake_quota, total_quota, status, source_spec_id, available_languages, location_options, sort_order, notes"
      )
      .order("created_at", { ascending: false }),
    // 지원자 수 집계용 — 보관 요강에 걸린 옛 지원서도 대학을 알아야 하므로 전체 요강
    supabase.from("study_admission_specs").select("id, university_id"),
    supabase
      .from("study_applications")
      .select("offering_id, admission_spec_id, target_department_id, term")
      .neq("status", "cancelled"),
  ]);

  // 모집 칸별 지원자 수 — offering_id 가 있으면 그것, 없으면 (요강의 대학, 지망 학과, 학기) 로 맞춘다
  const uniBySpec = new Map((allSpecs ?? []).map((s) => [s.id, s.university_id]));
  const offeringIdByCell = new Map<string, string>();
  const offeringIds = new Set<string>();
  for (const o of offerings ?? []) {
    offeringIdByCell.set(`${o.university_id}|${o.department_id}|${o.term}`, o.id);
    offeringIds.add(o.id);
  }
  const applicantCount = new Map<string, number>();
  for (const a of applications ?? []) {
    let oid: string | undefined;
    if (a.offering_id && offeringIds.has(a.offering_id)) oid = a.offering_id;
    else if (!a.offering_id && a.target_department_id != null && a.term) {
      const uni = uniBySpec.get(a.admission_spec_id);
      if (uni != null) oid = offeringIdByCell.get(`${uni}|${a.target_department_id}|${a.term}`);
    }
    if (oid) applicantCount.set(oid, (applicantCount.get(oid) ?? 0) + 1);
  }

  // 대학 → 요강 (대학당 1개. 혹시 여럿이면 최신 것)
  const specByUni = new Map<number, { id: string; status: string }>();
  for (const s of specs ?? []) {
    if (!specByUni.has(s.university_id)) specByUni.set(s.university_id, { id: s.id, status: s.status });
  }
  const deptById = new Map((departments ?? []).map((d) => [d.id, d]));
  const specDeptsBySpec = new Map<string, NonNullable<typeof specDepts>>();
  for (const sd of specDepts ?? []) {
    const list = specDeptsBySpec.get(sd.spec_id) ?? [];
    list.push(sd);
    specDeptsBySpec.set(sd.spec_id, list);
  }
  const termsBySpec = new Map<string, Set<string>>();
  for (const t of specTerms ?? []) {
    const set = termsBySpec.get(t.spec_id) ?? new Set<string>();
    set.add(t.term);
    termsBySpec.set(t.spec_id, set);
  }
  const offeringsByUni = new Map<number, OfferingRow[]>();
  for (const o of offerings ?? []) {
    const list = offeringsByUni.get(o.university_id) ?? [];
    list.push({ ...(o as Omit<OfferingRow, "applicant_count">), applicant_count: applicantCount.get(o.id) ?? 0 });
    offeringsByUni.set(o.university_id, list);
  }

  const blocks: UniversityBlock[] = [];
  for (const u of universities ?? []) {
    const spec = specByUni.get(u.id) ?? null;
    const uniOfferings = offeringsByUni.get(u.id) ?? [];
    if (!spec && uniOfferings.length === 0) continue;
    if (filterUni && u.id !== filterUni) continue;

    const rows: GridRow[] = [];
    const seen = new Set<number>();
    const sds = spec ? (specDeptsBySpec.get(spec.id) ?? []) : [];
    // 어학당 먼저, 그 다음 일반학과(sort_order)
    const sorted = [...sds].sort((a, b) =>
      a.kind === b.kind ? a.sort_order - b.sort_order : a.kind === "language" ? -1 : 1
    );
    for (const sd of sorted) {
      const d = deptById.get(sd.department_id);
      seen.add(sd.department_id);
      rows.push({
        department_id: sd.department_id,
        name_ko: d?.name_ko ?? `학과 #${sd.department_id}`,
        kind: sd.kind,
        spec_department_id: sd.id,
        in_spec: true,
        is_active: sd.is_active,
      });
    }
    // 요강 밖의 학과는 이미 모집이 있을 때만 (읽기·상태변경 가능, 새 칸 추가는 불가)
    for (const o of uniOfferings) {
      if (seen.has(o.department_id)) continue;
      seen.add(o.department_id);
      const d = deptById.get(o.department_id);
      rows.push({
        department_id: o.department_id,
        name_ko: d?.name_ko ?? `학과 #${o.department_id}`,
        kind: null,
        spec_department_id: null,
        in_spec: false,
        is_active: d?.active ?? false,
      });
    }

    const termSet = new Set<string>(spec ? termsBySpec.get(spec.id) ?? [] : []);
    for (const o of uniOfferings) termSet.add(o.term);
    const terms = Array.from(termSet).sort((a, b) => b.localeCompare(a));

    blocks.push({
      university: { id: u.id, name_ko: u.name_ko, active: u.active },
      spec,
      rows,
      terms,
      offerings: uniOfferings,
    });
  }

  return (
    <>
      <PageHeader
        title="모집"
        description="학과별로 어느 학기에 모집하는지 — 오픈하면 유학센터·학생이 지원할 수 있습니다"
        breadcrumbs={[{ label: "모집" }]}
      />
      <div className="p-6">
        {error ? (
          <Card className="p-6 text-sm text-destructive">데이터를 불러오지 못했습니다: {error.message}</Card>
        ) : (
          <OfferingsManager
            blocks={blocks}
            universities={(universities ?? []).map((u) => ({ id: u.id, name_ko: u.name_ko }))}
            filterUniversityId={filterUni}
          />
        )}
      </div>
    </>
  );
}
