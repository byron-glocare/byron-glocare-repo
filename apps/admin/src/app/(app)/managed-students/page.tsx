import Link from "next/link";
import { Download, Search } from "lucide-react";

import { createAdminClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import {
  filterStudents,
  listFilterQuery,
  loadStudentApplications,
  parseListFilter,
} from "@/lib/study/student-applications";
import { termLabelKo } from "@/lib/study/term-label";

export const dynamic = "force-dynamic";

const VISA_LABEL: Record<string, string> = {
  "D-4": "D-4",
  "D-2": "D-2",
  none: "없음",
  other: "기타",
};
const LOC_LABEL: Record<string, string> = {
  VN: "베트남",
  KR: "한국",
  other: "기타",
};

const selectClass = "h-8 rounded-md border border-input bg-background px-2 text-sm";

/**
 * /managed-students — 유학생 목록.
 *   검색 조건(2026-10-30 학생관리업무 반영): 이름·연락처·이메일, 유학센터, 위치,
 *   과정(D-2 학과 / D-4 어학당), 학기, 대학, 학과. 학기·대학·학과·과정은 '같은 지원 하나'가 모두 맞아야 통과.
 *   엑셀 두 가지: 목록 엑셀(지금 조건 그대로, 6칸) / 지원자 명단 엑셀(대학 제출용 43칸, 학기·대학만 반영).
 *   표는 화면 높이 안에서 스크롤 — 가로 스크롤바가 늘 화면 아래에 보이고 머리줄은 고정.
 */
export default async function ManagedStudentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filter = parseListFilter(await searchParams);

  // service-role 로 모든 org 학생 조회 (admin = glocare_admin, 읽기 전용)
  const admin = createAdminClient();

  const [{ data: students }, { data: orgs }, { data: files }, appsByStudent] = await Promise.all([
    admin
      .from("study_managed_students")
      .select("id, org_id, source, name, phone, email, current_visa, location, created_at")
      .order("created_at", { ascending: false }),
    admin.from("study_center_orgs").select("id, name_ko, name_vi"),
    admin.from("study_student_submission_files").select("student_id"),
    loadStudentApplications(admin),
  ]);

  const orgMap = new Map((orgs ?? []).map((o) => [o.id, o.name_ko || o.name_vi]));
  const fileCount = new Map<string, number>();
  for (const f of files ?? []) fileCount.set(f.student_id, (fileCount.get(f.student_id) ?? 0) + 1);

  // 필터 선택지 — 실제 지원에 쓰인 값만
  const allApps = Array.from(appsByStudent.values()).flat();
  const termOptions = Array.from(new Set(allApps.map((a) => a.term).filter(Boolean))).sort((a, b) => b.localeCompare(a));
  const uniOptions = Array.from(
    new Map(allApps.filter((a) => a.universityId != null).map((a) => [a.universityId as number, a.university])).entries()
  ).sort((a, b) => a[1].localeCompare(b[1], "ko"));
  const deptOptions = Array.from(
    new Set(
      allApps
        .filter((a) => !filter.university || String(a.universityId ?? "") === filter.university)
        .map((a) => a.dept)
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, "ko"));
  const orgOptions = [...orgMap.entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1]), "ko"));

  const rows = filterStudents(students ?? [], filter, appsByStudent);
  const hasFilter = Object.values(filter).some(Boolean);
  const total = (students ?? []).length;
  const qs = listFilterQuery(filter);
  // 지원자 명단 엑셀(43칸)은 학기·대학 조건만 받는다
  const rosterQs = new URLSearchParams({
    ...(filter.term ? { term: filter.term } : {}),
    ...(filter.university ? { u: filter.university } : {}),
  }).toString();

  return (
    <>
      <PageHeader
        title="유학생"
        description="유학센터에서 등록한 전체 유학생 — 조회 및 다운로드"
        breadcrumbs={[{ label: "유학생" }]}
      />
      <div className="p-6 space-y-4">
        <form method="get" className="flex flex-wrap items-end gap-2">
          <div className="min-w-56 flex-1">
            <label htmlFor="ms-q" className="mb-1 block text-xs text-muted-foreground">
              검색 (이름 · 연락처 · 이메일)
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="ms-q" name="q" defaultValue={filter.q ?? ""} placeholder="이름 / 010... / 이메일" className="pl-8" />
            </div>
          </div>
          <Field label="과정" id="ms-course">
            <select id="ms-course" name="course" defaultValue={filter.course ?? ""} className={`${selectClass} min-w-28`}>
              <option value="">전체</option>
              <option value="D-2">D-2 (학과)</option>
              <option value="D-4">D-4 (어학당)</option>
            </select>
          </Field>
          <Field label="학기" id="ms-term">
            <select id="ms-term" name="term" defaultValue={filter.term ?? ""} className={`${selectClass} min-w-28`}>
              <option value="">전체</option>
              {termOptions.map((t) => (
                <option key={t} value={t}>
                  {termLabelKo(t)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="대학" id="ms-u">
            <select id="ms-u" name="u" defaultValue={filter.university ?? ""} className={`${selectClass} min-w-40`}>
              <option value="">전체</option>
              {uniOptions.map(([id, name]) => (
                <option key={id} value={String(id)}>
                  {name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="학과(전공)" id="ms-dept">
            <select id="ms-dept" name="dept" defaultValue={filter.dept ?? ""} className={`${selectClass} min-w-40`}>
              <option value="">전체</option>
              {deptOptions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </Field>
          <Field label="유학센터" id="ms-org">
            <select id="ms-org" name="org" defaultValue={filter.org ?? ""} className={`${selectClass} min-w-40`}>
              <option value="">전체</option>
              <option value="self">본사 직접 (B2C)</option>
              {orgOptions.map(([id, name]) => (
                <option key={id} value={String(id)}>
                  {name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="위치" id="ms-loc">
            <select id="ms-loc" name="loc" defaultValue={filter.loc ?? ""} className={`${selectClass} min-w-24`}>
              <option value="">전체</option>
              {Object.entries(LOC_LABEL).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <button type="submit" className={buttonVariants()}>
            적용
          </button>
          {hasFilter ? (
            <Link href="/managed-students" className={buttonVariants({ variant: "ghost" })}>
              초기화
            </Link>
          ) : null}
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <p className="mr-auto text-sm text-muted-foreground">
            {hasFilter ? `${rows.length}명 / 총 ${total}명` : `총 ${total}명`}
          </p>
          <a
            href={`/managed-students/list-export${qs ? `?${qs}` : ""}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
            title="지금 조건의 목록 — 이름·주민번호·진행단계·유학센터·대학교·전공"
          >
            <Download className="size-3.5" />
            목록 엑셀
          </a>
          <a
            href={`/managed-students/export${rosterQs ? `?${rosterQs}` : ""}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
            title="대학 제출용 43칸 양식 — 학기·대학 조건만 반영, 지원서(취소 제외)가 있는 학생만"
          >
            <Download className="size-3.5" />
            지원자 명단 엑셀
          </a>
        </div>

        {rows.length === 0 ? (
          <Card className="p-12 text-center text-sm text-muted-foreground">
            {hasFilter ? "조건에 맞는 유학생이 없습니다." : "등록된 유학생이 없습니다."}
          </Card>
        ) : (
          <Card className="p-0">
            {/* 화면 높이 안에서 스크롤 → 가로 스크롤바가 늘 보이고 머리줄은 고정 */}
            <div className="max-h-[calc(100svh-17rem)] min-h-64 overflow-auto rounded-xl">
              <table className="w-full caption-bottom text-sm">
                <TableHeader>
                  <TableRow className="[&>th]:sticky [&>th]:top-0 [&>th]:z-10 [&>th]:bg-card">
                    <TableHead className="min-w-40">이름</TableHead>
                    <TableHead className="min-w-80">지원 대학 · 학과 · 학기</TableHead>
                    <TableHead className="min-w-44">유학센터</TableHead>
                    <TableHead className="w-20">현재 비자</TableHead>
                    <TableHead className="w-16 text-center">서류</TableHead>
                    <TableHead className="w-28">등록일</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((s) => {
                    const n = fileCount.get(s.id) ?? 0;
                    const apps = appsByStudent.get(s.id) ?? [];
                    const href = `/managed-students/${s.id}`;
                    return (
                      <TableRow key={s.id} className="cursor-pointer">
                        <TableCell className="font-medium">
                          <Link href={href} className="inline-flex items-center gap-2 hover:text-primary">
                            {s.name}
                            {s.source === "self" ? (
                              <Badge variant="outline" className="text-[10px]">
                                B2C
                              </Badge>
                            ) : null}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm">
                          <Link href={href} className="block space-y-0.5">
                            {apps.length === 0 ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              apps.map((a, i) => (
                                <div key={i} className="flex items-baseline gap-1.5 leading-snug">
                                  {a.priority ? (
                                    <span className="shrink-0 text-[11px] text-muted-foreground">{a.priority}지망</span>
                                  ) : null}
                                  {a.course ? (
                                    <span className="shrink-0 rounded border border-border px-1 text-[10px] text-muted-foreground">
                                      {a.course}
                                    </span>
                                  ) : null}
                                  <span>
                                    {a.university}
                                    <span className="text-muted-foreground">
                                      {a.dept ? ` · ${a.dept}` : ""}
                                      {a.termLabel ? ` · ${a.termLabel}` : ""}
                                    </span>
                                  </span>
                                </div>
                              ))
                            )}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          <Link href={href} className="block">
                            {(s.org_id ? orgMap.get(s.org_id) : null) ?? (s.source === "self" ? "본사 직접 (B2C)" : "—")}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm">
                          <Link href={href} className="block">
                            {s.current_visa ? VISA_LABEL[s.current_visa] ?? s.current_visa : "—"}
                          </Link>
                        </TableCell>
                        <TableCell className="text-center">
                          {n > 0 ? <Badge variant="secondary">{n}</Badge> : <span className="text-xs text-muted-foreground">0</span>}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDate(s.created_at)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}
