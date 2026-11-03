/**
 * /managed-students/terms — 학기 종료 관리.
 *   학생이 지원한 학기를 어드민이 직접 종료한다: 학기 전체 일괄, 또는 대학별 개별. 언제든 되돌릴 수 있다.
 *   지원한 학기가 모두 종료된 학생은 유학생 목록 기본 화면(진행 중)에서 빠진다.
 *   날짜로 자동 종료하지 않는다(2026-11-03 결정) — 끝났는지는 사람이 정한다. 개강일은 판단을 돕는 참고로 보여준다.
 */

import Link from "next/link";

import { createAdminClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { termLabelKo } from "@/lib/study/term-label";
import { TermCloseButton } from "./term-close-button";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  university: string;
  students: Set<string>;
  closedAt: string | null;
  start: string | null;
};

export default async function TermsPage() {
  const admin = createAdminClient();
  const { data: apps } = await admin
    .from("study_applications")
    .select("student_id, admission_spec_id, term")
    .neq("status", "cancelled");
  const specIds = Array.from(new Set((apps ?? []).map((a) => a.admission_spec_id).filter((x): x is string => !!x)));

  const [{ data: terms }, { data: specs }] =
    specIds.length > 0
      ? await Promise.all([
          admin.from("study_spec_terms").select("id, spec_id, term, closed_at, schedule, schedule_language").in("spec_id", specIds),
          admin.from("study_admission_specs").select("id, university_id").in("id", specIds),
        ])
      : [{ data: [] }, { data: [] }];
  const uniIds = Array.from(new Set((specs ?? []).map((s) => s.university_id)));
  const { data: unis } =
    uniIds.length > 0 ? await admin.from("universities").select("id, name_ko").in("id", uniIds) : { data: [] };
  const uniName = new Map((unis ?? []).map((u) => [u.id, u.name_ko]));
  const uniBySpec = new Map((specs ?? []).map((s) => [s.id, uniName.get(s.university_id) ?? "대학"]));

  // 학기 → 대학 줄. 지원이 있는 학기만.
  const byTerm = new Map<string, Row[]>();
  for (const t of terms ?? []) {
    const students = new Set(
      (apps ?? []).filter((a) => a.admission_spec_id === t.spec_id && a.term === t.term).map((a) => a.student_id)
    );
    if (students.size === 0) continue;
    const list = byTerm.get(t.term) ?? [];
    list.push({
      id: t.id,
      university: uniBySpec.get(t.spec_id) ?? "대학",
      students,
      closedAt: t.closed_at,
      start: firstStart(t.schedule, t.schedule_language),
    });
    byTerm.set(t.term, list);
  }
  const groups = Array.from(byTerm.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([term, rows]) => ({ term, rows: rows.sort((a, b) => a.university.localeCompare(b.university, "ko")) }));

  return (
    <>
      <PageHeader
        title="학기 종료 관리"
        description="지원한 학기가 모두 종료된 학생은 유학생 목록 기본 화면에서 빠집니다"
        breadcrumbs={[{ href: "/managed-students", label: "유학생" }, { label: "학기 종료 관리" }]}
        actions={
          <Link href="/managed-students" className={buttonVariants({ variant: "outline", size: "sm" })}>
            유학생 목록
          </Link>
        }
      />
      <div className="space-y-4 p-6">
        {groups.length === 0 ? (
          <Card className="p-12 text-center text-sm text-muted-foreground">지원이 들어온 학기가 없습니다.</Card>
        ) : (
          groups.map(({ term, rows }) => {
            const open = rows.filter((r) => !r.closedAt);
            const closed = rows.filter((r) => r.closedAt);
            const label = termLabelKo(term);
            const total = new Set(rows.flatMap((r) => Array.from(r.students))).size;
            return (
              <Card key={term} className="gap-0 p-0">
                <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
                  <h2 className="text-sm font-semibold">{label}</h2>
                  <span className="text-xs text-muted-foreground">
                    대학 {rows.length}곳 · 학생 {total}명
                  </span>
                  {open.length === 0 ? <Badge variant="secondary">전체 종료</Badge> : null}
                  <div className="ml-auto flex gap-2">
                    {closed.length > 0 ? (
                      <TermCloseButton
                        ids={closed.map((r) => r.id)}
                        closed={false}
                        variant="ghost"
                        label="전체 되돌리기"
                        confirmText={`${label} 종료를 대학 ${closed.length}곳 모두 되돌릴까요?`}
                      />
                    ) : null}
                    {open.length > 0 ? (
                      <TermCloseButton
                        ids={open.map((r) => r.id)}
                        closed
                        variant="default"
                        label="학기 전체 종료"
                        confirmText={`${label} 학기를 대학 ${open.length}곳 모두 종료할까요?\n이 학기에만 지원한 학생은 유학생 목록에서 빠집니다. 나중에 되돌릴 수 있습니다.`}
                      />
                    ) : null}
                  </div>
                </div>
                <ul className="divide-y divide-border">
                  {rows.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                      <span className="text-sm font-medium">{r.university}</span>
                      <span className="text-xs text-muted-foreground">
                        학생 {r.students.size}명{r.start ? ` · 개강 ${r.start}` : ""}
                      </span>
                      <span className="ml-auto flex items-center gap-2">
                        {r.closedAt ? (
                          <span className="text-xs text-muted-foreground">{formatDate(r.closedAt)} 종료</span>
                        ) : null}
                        <TermCloseButton
                          ids={[r.id]}
                          closed={!r.closedAt}
                          variant={r.closedAt ? "ghost" : "outline"}
                          label={r.closedAt ? "되돌리기" : "종료"}
                          confirmText={
                            r.closedAt
                              ? `${r.university} ${label} 종료를 되돌릴까요?`
                              : `${r.university} ${label}을(를) 종료할까요?\n나중에 되돌릴 수 있습니다.`
                          }
                        />
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })
        )}
      </div>
    </>
  );
}

/** 참고용 개강일 — 정규·어학당 일정 중 있는 것 (둘 다 있으면 빠른 날) */
function firstStart(schedule: unknown, language: unknown): string | null {
  const dates = [schedule, language]
    .map((s) => (s as { semester_start?: unknown } | null)?.semester_start)
    .filter((d): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort();
  return dates[0] ?? null;
}
