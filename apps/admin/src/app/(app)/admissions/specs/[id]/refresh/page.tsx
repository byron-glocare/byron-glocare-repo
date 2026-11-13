/**
 * /admissions/specs/[id]/refresh — 원본으로 갱신.
 *   저장된 모집요강 원본을 다시 AI 추출 → 지금 입력값과 다른 항목만 나란히 보여주고, 사람이 고른 항목만 적용한다.
 *   기본은 아무것도 고르지 않는다(수기로 보완한 값을 덮어쓰지 않게).
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { loadSpecDepartments, loadSpecTerms } from "@/lib/admission/spec-departments";
import { termLabelKo } from "@/lib/study/term-label";
import type { RefreshDept, RefreshTerm } from "@/lib/admission/spec-refresh";

import { RefreshPanel } from "./refresh-panel";

export const dynamic = "force-dynamic";

export default async function SpecRefreshPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: spec } = await supabase
    .from("study_admission_specs")
    .select("id, university_id, eligibility, source_file_url")
    .eq("id", id)
    .maybeSingle();
  if (!spec) notFound();

  const [{ data: uni }, departments, terms] = await Promise.all([
    supabase.from("universities").select("name_ko").eq("id", spec.university_id).maybeSingle(),
    loadSpecDepartments(supabase, id),
    loadSpecTerms(supabase, id),
  ]);

  const depts: RefreshDept[] = departments.map((d) => ({
    id: d.id,
    kind: d.kind,
    name_ko: d.name_ko,
    info: d.info as Record<string, unknown>,
    tuition: d.tuition,
    scholarships: d.scholarships,
    eligibility: d.eligibility,
  }));
  const termRows: RefreshTerm[] = terms.map((t) => ({ id: t.id, term: t.term, schedule: t.schedule, schedule_language: t.schedule_language }));
  const hasSource = typeof spec.source_file_url === "string" && /^https?:\/\//.test(spec.source_file_url);
  const name = uni?.name_ko ?? "모집요강";

  return (
    <div className="flex flex-col">
      <PageHeader
        title="원본으로 갱신"
        description={`${name} — 보관된 원본을 다시 읽어, 지금 입력값과 다른 항목만 보여줍니다. 고른 항목만 바뀝니다.`}
        breadcrumbs={[
          { label: "입학서류", href: "/admissions" },
          { label: name, href: `/admissions/${spec.university_id}` },
          { label: "모집요강", href: `/admissions/specs/${id}` },
          { label: "원본으로 갱신" },
        ]}
        actions={
          <Link href={`/admissions/specs/${id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            <ArrowLeft className="size-4" />
            모집요강으로
          </Link>
        }
      />
      <div className="p-6">
        {hasSource ? (
          <RefreshPanel
            specId={id}
            depts={depts}
            terms={termRows.map((t) => ({ ...t, label: termLabelKo(t.term) }))}
            specEligibility={(spec.eligibility ?? null) as Record<string, unknown> | null}
          />
        ) : (
          <p className="rounded-md border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            보관된 원본 파일이 없습니다. 모집요강 화면에서 먼저 <b>원본 올리기</b>를 해 주세요.
          </p>
        )}
      </div>
    </div>
  );
}
