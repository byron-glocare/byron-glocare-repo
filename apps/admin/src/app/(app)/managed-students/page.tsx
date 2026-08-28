import Link from "next/link";
import { Search } from "lucide-react";

import { createAdminClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { dash, formatDate } from "@/lib/format";

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

type SearchParams = Promise<{ q?: string; org?: string; loc?: string }>;

export default async function ManagedStudentsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const orgFilter = (sp.org ?? "").trim();
  const locFilter = (sp.loc ?? "").trim();

  // service-role 로 모든 org 학생 조회 (admin = glocare_admin, 읽기 전용)
  const admin = createAdminClient();

  const [{ data: students }, { data: orgs }, { data: files }] =
    await Promise.all([
      admin
        .from("study_managed_students")
        .select(
          "id, org_id, source, name, dob, phone, email, topik_level, current_visa, location, created_at"
        )
        .order("created_at", { ascending: false }),
      admin.from("study_center_orgs").select("id, name_ko, name_vi"),
      admin.from("study_student_submission_files").select("student_id"),
    ]);

  const orgMap = new Map(
    (orgs ?? []).map((o) => [o.id, o.name_ko || o.name_vi])
  );
  const fileCount = new Map<string, number>();
  for (const f of files ?? [])
    fileCount.set(f.student_id, (fileCount.get(f.student_id) ?? 0) + 1);

  // 유학센터 필터는 "본사 직접(B2C)" 도 고를 수 있어야 해서 self 를 특수값으로 둔다.
  const norm = (v: string) => v.toLowerCase();
  const needle = norm(q);
  const rows = (students ?? []).filter((s) => {
    if (needle) {
      const hay = norm(
        [s.name, s.phone, s.email].filter(Boolean).join(" ")
      );
      if (!hay.includes(needle)) return false;
    }
    if (orgFilter) {
      if (orgFilter === "self") {
        if (s.source !== "self") return false;
      } else if (String(s.org_id ?? "") !== orgFilter) return false;
    }
    if (locFilter && (s.location ?? "") !== locFilter) return false;
    return true;
  });

  const orgOptions = [...orgMap.entries()].sort((a, b) =>
    String(a[1]).localeCompare(String(b[1]), "ko")
  );
  const hasFilter = !!(q || orgFilter || locFilter);
  const total = (students ?? []).length;

  return (
    <>
      <PageHeader
        title="유학생"
        description="유학센터에서 등록한 전체 유학생 — 조회 및 다운로드"
        breadcrumbs={[{ label: "유학생" }]}
      />
      <div className="p-6 space-y-4">
        <form method="get" className="flex flex-wrap items-end gap-2">
          <div className="min-w-60 flex-1">
            <label className="mb-1 block text-xs text-muted-foreground">
              검색 (이름 · 연락처 · 이메일)
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                name="q"
                defaultValue={q}
                placeholder="이름 / 010... / 이메일"
                className="pl-8"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              유학센터
            </label>
            <select
              name="org"
              defaultValue={orgFilter}
              className="h-8 min-w-44 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">전체</option>
              <option value="self">본사 직접 (B2C)</option>
              {orgOptions.map(([id, name]) => (
                <option key={id} value={String(id)}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              위치
            </label>
            <select
              name="loc"
              defaultValue={locFilter}
              className="h-8 min-w-28 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">전체</option>
              {Object.entries(LOC_LABEL).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className={buttonVariants()}>
            적용
          </button>
          {hasFilter ? (
            <Link
              href="/managed-students"
              className={buttonVariants({ variant: "ghost" })}
            >
              초기화
            </Link>
          ) : null}
        </form>

        <p className="text-sm text-muted-foreground">
          {hasFilter ? `${rows.length}명 / 총 ${total}명` : `총 ${total}명`}
        </p>
        {rows.length === 0 ? (
          <Card className="p-12 text-center text-sm text-muted-foreground">
            {hasFilter ? "조건에 맞는 유학생이 없습니다." : "등록된 유학생이 없습니다."}
          </Card>
        ) : (
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead className="w-48">유학센터</TableHead>
                  <TableHead className="w-32">생년월일</TableHead>
                  <TableHead className="w-36">연락처</TableHead>
                  <TableHead className="w-20">TOPIK</TableHead>
                  <TableHead className="w-24">비자</TableHead>
                  <TableHead className="w-20">위치</TableHead>
                  <TableHead className="w-20 text-center">서류</TableHead>
                  <TableHead className="w-28">등록일</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((s) => {
                  const n = fileCount.get(s.id) ?? 0;
                  return (
                    <TableRow key={s.id} className="cursor-pointer">
                      <TableCell className="font-medium">
                        <Link
                          href={`/managed-students/${s.id}`}
                          className="inline-flex items-center gap-2 hover:text-primary"
                        >
                          {s.name}
                          {s.source === "self" ? (
                            <Badge variant="outline" className="text-[10px]">
                              B2C
                            </Badge>
                          ) : null}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <Link href={`/managed-students/${s.id}`} className="block">
                          {(s.org_id ? orgMap.get(s.org_id) : null) ??
                            (s.source === "self" ? "본사 직접 (B2C)" : "—")}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">
                        <Link href={`/managed-students/${s.id}`} className="block">
                          {dash(formatDate(s.dob))}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">
                        <Link href={`/managed-students/${s.id}`} className="block">
                          {dash(s.phone)}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">
                        <Link href={`/managed-students/${s.id}`} className="block">
                          {s.topik_level ? `${s.topik_level}급` : "—"}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">
                        <Link href={`/managed-students/${s.id}`} className="block">
                          {s.current_visa ? VISA_LABEL[s.current_visa] ?? s.current_visa : "—"}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">
                        <Link href={`/managed-students/${s.id}`} className="block">
                          {s.location ? LOC_LABEL[s.location] ?? s.location : "—"}
                        </Link>
                      </TableCell>
                      <TableCell className="text-center">
                        {n > 0 ? (
                          <Badge variant="secondary">{n}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(s.created_at)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </>
  );
}
