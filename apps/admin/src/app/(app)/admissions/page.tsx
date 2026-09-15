/**
 * /admissions — 입학서류 메뉴 (재편).
 *   3분할 탭: [작성 서류 양식] / [발급 서류] / [모집요강 서류]
 *   각 탭: 검색 + 대학 필터. 행 클릭 → 개별 서류 상세.
 *   (구 대학별 요약 표·전체 모아보기·공용 제출서류 섹션 제거 — 개별 상세로 통합.)
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { Download, Plus, Search } from "lucide-react";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
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
import { Card } from "@/components/ui/card";
import { DocsManager, type DocItem, type DocStandard } from "./docs/docs-manager";
import { UnlinkedDocsPanel, type UnlinkedDoc } from "./docs/unlinked-docs";
import type { DocVariant } from "./docs/actions";

export const dynamic = "force-dynamic";

type Tab = "forms" | "docs" | "guidelines";

export default async function AdmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; uni?: string }>;
}) {
  const sp = await searchParams;
  const tab: Tab =
    sp.tab === "guidelines" ? "guidelines" : sp.tab === "docs" ? "docs" : "forms";
  const q = (sp.q ?? "").trim().toLowerCase();
  const uniFilter = (sp.uni ?? "").trim();

  const supabaseUser = await createClient();
  const {
    data: { user },
  } = await supabaseUser.auth.getUser();
  if (!user) redirect("/login?redirect=/admissions");

  const supabase = createAdminClient();

  const [
    { data: universities },
    { data: forms },
    { data: specs },
  ] = await Promise.all([
    supabase.from("universities").select("id, name_ko").order("name_ko"),
    supabase
      .from("study_admission_form_files")
      .select(
        "id, university_id, name_ko, file_name, file_url, department_name, applies_to_department_ids, uploaded_at"
      )
      .eq("is_current", true)
      .order("uploaded_at", { ascending: false }),
    supabase
      .from("study_admission_specs")
      .select("id, university_id, term, source_file_url, created_at, status")
      .order("created_at", { ascending: false }),
  ]);

  // 제출서류 탭 — 서류 카탈로그 · 서류 항목 · 요강별 사용 수 (0060)
  const [{ data: docStdRows }, { data: docItemRows }, { data: specItemRows }] =
    tab === "docs"
      ? await Promise.all([
          supabase.from("study_doc_standards").select("*").order("sort_order").order("name_ko"),
          supabase.from("study_doc_items").select("*").order("sort_order").order("name_ko"),
          supabase.from("study_spec_doc_items").select("item_key, guide_override_ko, guide_override_vi, overrides"),
        ])
      : [{ data: null }, { data: null }, { data: null }];
  const docStandards: DocStandard[] = (docStdRows ?? []).map((r) => ({
    key: r.key, name_ko: r.name_ko, name_vi: r.name_vi, is_form_doc: r.is_form_doc,
    issuing_country: r.issuing_country, issuer_ko: r.issuer_ko, issuer_vi: r.issuer_vi,
    validity_days: r.validity_days, notarization: r.notarization, original_required: r.original_required,
    issued_within_days: r.issued_within_days, guide_ko: r.guide_ko, guide_vi: r.guide_vi,
    aliases: r.aliases ?? [], is_active: r.is_active,
  }));
  const docItems: DocItem[] = (docItemRows ?? []).map((r) => ({
    key: r.key, name_ko: r.name_ko, name_vi: r.name_vi, guide_ko: r.guide_ko, guide_vi: r.guide_vi,
    variants: (Array.isArray(r.variants) ? r.variants : []) as DocVariant[], is_active: r.is_active,
  }));
  const docUsage: Record<string, number> = {};
  const docOverridden: Record<string, number> = {};
  for (const r of specItemRows ?? []) {
    docUsage[r.item_key] = (docUsage[r.item_key] ?? 0) + 1;
    const ov = (r.overrides ?? {}) as Record<string, unknown>;
    if (r.guide_override_ko || r.guide_override_vi || Object.keys(ov).length > 0)
      docOverridden[r.item_key] = (docOverridden[r.item_key] ?? 0) + 1;
  }

  const uniName = new Map((universities ?? []).map((u) => [u.id, u.name_ko]));

  // 제출서류 탭 — 표준에 연결되지 않은 요강 서류 (0060 이 못 옮긴 것). 운영자가 붙인다.
  const { data: specDocRows } =
    tab === "docs"
      ? await supabase
          .from("study_admission_specs")
          .select("id, university_id, term, required_documents")
          .order("university_id")
      : { data: null };
  const unlinkedDocs: UnlinkedDoc[] = [];
  for (const s of specDocRows ?? []) {
    const arr = Array.isArray(s.required_documents) ? (s.required_documents as Record<string, unknown>[]) : [];
    arr.forEach((d, i) => {
      const std = String(d.std_key ?? "").trim();
      const name = String(d.name_ko ?? "").trim();
      if (!name || (std && std !== "__none__")) return;
      unlinkedDocs.push({
        specId: s.id,
        universityName: uniName.get(s.university_id) ?? `대학 #${s.university_id}`,
        term: s.term,
        docIndex: i,
        key: String(d.key ?? "other"),
        name_ko: name,
        notes: String(d.notes ?? "").trim() || null,
        target_person: String(d.target_person ?? "").trim() || null,
      });
    });
  }
  const nameOf = (uid: number | null) =>
    uid == null ? "공용" : uniName.get(uid) ?? `대학 #${uid}`;

  const uniMatch = (uid: number | null) =>
    !uniFilter ||
    (uniFilter === "shared" ? uid == null : String(uid) === uniFilter);

  const formRows = (forms ?? []).filter(
    (f) =>
      uniMatch(f.university_id) &&
      (!q || `${f.name_ko} ${f.file_name}`.toLowerCase().includes(q))
  );
  const specRows = (specs ?? []).filter(
    (s) => uniMatch(s.university_id) && (!q || s.term.toLowerCase().includes(q))
  );

  const counts = {
    forms: (forms ?? []).length,
    guidelines: (specs ?? []).length,
    docs: docItems.length,
  };

  const tabs: Array<{ key: Tab; label: string; count: number }> = [
    { key: "forms", label: "작성 서류 양식", count: counts.forms },
    { key: "docs", label: "제출서류", count: counts.docs },
    { key: "guidelines", label: "모집요강 서류", count: counts.guidelines },
  ];

  const deptScope = (
    departmentName: string | null,
    ids: number[] | null
  ): string => {
    if (departmentName) return departmentName;
    if (ids && ids.length > 0) return `${ids.length}개 학과`;
    return "모든 학과";
  };

  return (
    <>
      <PageHeader
        title="입학서류"
        description="작성 서류 양식 · 제출서류 · 모집요강 서류"
        breadcrumbs={[{ label: "입학서류" }]}
        actions={
          tab === "docs" ? null : tab === "forms" ? (
            <Link href="/admissions/forms/new" className={buttonVariants()}>
              <Plus className="size-4" />
              양식 추가
            </Link>
          ) : (
            <Link href="/admissions/new" className={buttonVariants()}>
              <Plus className="size-4" />
              모집요강 추가
            </Link>
          )
        }
      />
      <div className="p-6 space-y-4">
        {/* 탭 */}
        <div className="flex flex-wrap gap-1 border-b">
          {tabs.map((t) => {
            const active = t.key === tab;
            const params = new URLSearchParams();
            params.set("tab", t.key);
            if (uniFilter) params.set("uni", uniFilter);
            return (
              <Link
                key={t.key}
                href={`/admissions?${params.toString()}`}
                className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}{" "}
                <span className="text-xs text-muted-foreground">({t.count})</span>
              </Link>
            );
          })}
        </div>

        {/* 검색 + 대학 필터 */}
        {tab !== "docs" ? (
        <form method="get" action="/admissions" className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="tab" value={tab} />
          <div className="min-w-60 flex-1">
            <label className="mb-1 block text-xs text-muted-foreground">
              검색 ({tab === "guidelines" ? "학기" : "서류명"})
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input name="q" defaultValue={sp.q ?? ""} className="pl-8" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">대학</label>
            <select
              name="uni"
              defaultValue={uniFilter}
              className="h-8 min-w-40 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">전체</option>
              {(universities ?? []).map((u) => (
                <option key={u.id} value={String(u.id)}>
                  {u.name_ko}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className={buttonVariants()}>
            적용
          </button>
          {(q || uniFilter) && (
            <Link
              href={`/admissions?tab=${tab}`}
              className={buttonVariants({ variant: "ghost" })}
            >
              초기화
            </Link>
          )}
        </form>
        ) : null}

        {/* 탭별 리스트 */}
        {tab === "docs" ? (
          <div className="space-y-4">
            <UnlinkedDocsPanel docs={unlinkedDocs} standards={docStandards} />
            <DocsManager standards={docStandards} items={docItems} usage={docUsage} overridden={docOverridden} />
          </div>
        ) : null}
        {tab === "forms" ? (
          <Card className="overflow-hidden p-0">
            {formRows.length === 0 ? (
              <Empty />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>서류명</TableHead>
                    <TableHead className="w-40">대학</TableHead>
                    <TableHead className="w-32">적용학과</TableHead>
                    <TableHead className="w-40">파일명</TableHead>
                    <TableHead className="w-28">업로드일</TableHead>
                    <TableHead className="w-20 text-center">다운로드</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {formRows.map((f) => {
                    const href = `/admissions/forms/${f.id}`;
                    return (
                      <TableRow key={f.id} className="cursor-pointer">
                        <TableCell className="font-medium">
                          <Link href={href} className="hover:text-primary">
                            {f.name_ko}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm">
                          <Link href={href} className="block">
                            {nameOf(f.university_id)}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          <Link href={href} className="block">
                            {deptScope(f.department_name, f.applies_to_department_ids)}
                          </Link>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <Link href={href} className="block truncate" title={f.file_name}>
                            {f.file_name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <Link href={href} className="block">
                            {new Date(f.uploaded_at).toLocaleDateString("ko-KR")}
                          </Link>
                        </TableCell>
                        <TableCell className="text-center">
                          <a
                            href={f.file_url}
                            target="_blank"
                            rel="noreferrer"
                            download
                            className={buttonVariants({ variant: "outline", size: "sm" })}
                          >
                            <Download className="size-4" />
                          </a>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Card>
        ) : null}

        {tab === "guidelines" ? (
          <Card className="overflow-hidden p-0">
            {specRows.length === 0 ? (
              <Empty />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>대학교</TableHead>
                    <TableHead className="w-32">학기</TableHead>
                    <TableHead className="w-28">업로드일</TableHead>
                    <TableHead className="w-24 text-center">다운로드</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {specRows.map((s) => {
                    const href = `/admissions/specs/${s.id}`;
                    return (
                      <TableRow key={s.id} className="cursor-pointer">
                        <TableCell className="font-medium">
                          <Link href={href} className="hover:text-primary">
                            {nameOf(s.university_id)}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm">
                          <Link href={href} className="block">
                            {s.term}
                          </Link>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <Link href={href} className="block">
                            {new Date(s.created_at).toLocaleDateString("ko-KR")}
                          </Link>
                        </TableCell>
                        <TableCell className="text-center">
                          {s.source_file_url ? (
                            <a
                              href={s.source_file_url}
                              target="_blank"
                              rel="noreferrer"
                              download
                              className={buttonVariants({ variant: "outline", size: "sm" })}
                            >
                              <Download className="size-4" />
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Card>
        ) : null}
      </div>
    </>
  );
}

function Empty() {
  return (
    <div className="p-12 text-center text-sm text-muted-foreground">
      해당하는 서류가 없습니다.
    </div>
  );
}
