import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, FileText, Plus } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { UniversityForm } from "@/components/university-form";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { UniversityInput } from "@/lib/validators";
import {
  classifyRequiredDocs,
  type RequiredDoc,
} from "@/lib/admission/classify-documents";
import {
  buildSubmissionIndex,
  matchIssuedDoc,
} from "@/lib/admission/match-submissions";
import { IssuedDocActions } from "./issued-doc-actions";

export const dynamic = "force-dynamic";

const PROGRAM_TYPE_LABEL: Record<string, string> = {
  language_program: "어학연수 (D-4)",
  associate_2yr: "전문학사 2년",
  bachelor_3yr_extension: "전공심화 (2+2)",
  bachelor_4yr: "학사 4년",
};

const SPEC_STATUS_LABEL: Record<string, string> = {
  draft: "초안",
  reviewing: "검수 중",
  approved: "승인",
  archived: "보관",
};

export default async function UniversityEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) notFound();

  const supabase = await createClient();
  const [
    { data: row, error },
    { data: depts },
    { data: specs },
    { data: offerings },
    { data: formFiles },
    { data: submissions },
  ] = await Promise.all([
      supabase.from("universities").select("*").eq("id", numericId).single(),
      supabase
        .from("departments")
        .select(
          "id, active, icon, name_ko, name_vi, category, course, badge, sort_order, study_period"
        )
        .eq("university_id", numericId)
        .order("sort_order"),
      supabase
        .from("study_admission_specs")
        .select("id, term, program_type, admission_category, status, departments, required_documents, updated_at")
        .eq("university_id", numericId)
        .order("updated_at", { ascending: false }),
      supabase
        .from("study_offerings")
        .select("department_id, term, status")
        .eq("university_id", numericId),
      supabase
        .from("study_admission_form_files")
        .select(
          "id, name_ko, key, department_name, applies_to_terms, applies_to_department_ids, file_url, file_name, is_current, uploaded_at"
        )
        .eq("university_id", numericId)
        .eq("is_current", true)
        .order("uploaded_at", { ascending: false }),
      supabase
        .from("study_required_submissions")
        .select(
          "id, university_id, base_submission_id, department_id, name_ko, std_key, aliases, sample_image_url, status, is_active, sort_order"
        )
        .or(`university_id.eq.${numericId},university_id.is.null`)
        .eq("is_active", true)
        .order("sort_order"),
    ]);

  if (error || !row) notFound();

  const deptNameById = new Map((depts ?? []).map((d) => [d.id, d.name_ko]));

  // 학과별 모집(노출 중) 학기 태그 + 모집 노출 여부
  const publishedTermsByDept = new Map<number, string[]>();
  for (const o of offerings ?? []) {
    if (o.status !== "published" || o.department_id == null) continue;
    const arr = publishedTermsByDept.get(o.department_id) ?? [];
    if (!arr.includes(o.term)) arr.push(o.term);
    publishedTermsByDept.set(o.department_id, arr);
  }
  // 모집 노출 중인 학과 우선 → 그다음 노출 순서
  const sortedDepts = (depts ?? []).slice().sort((a, b) => {
    const ap = publishedTermsByDept.has(a.id) ? 0 : 1;
    const bp = publishedTermsByDept.has(b.id) ? 0 : 1;
    return ap - bp || a.sort_order - b.sort_order;
  });

  // 모집요강 = 학기별 1줄. 같은 학기에 요강이 여러 개면 최신을 대표로, 나머지는 +N.
  //   (specs 는 updated_at desc 정렬 → 각 term 의 첫 항목이 최신)
  const termGroups = (() => {
    type Spec = NonNullable<typeof specs>[number];
    const byTerm = new Map<string, Spec[]>();
    for (const s of specs ?? []) {
      const arr = byTerm.get(s.term) ?? [];
      arr.push(s);
      byTerm.set(s.term, arr);
    }
    return Array.from(byTerm.entries())
      .map(([term, list]) => {
        const rep = list[0];
        const deptNames = new Set<string>();
        for (const sp of list) {
          const ds = Array.isArray(sp.departments)
            ? (sp.departments as Array<{ name?: string }>)
            : [];
          for (const d of ds) if (d?.name) deptNames.add(d.name);
        }
        return { term, rep, extra: list.length - 1, deptNames: Array.from(deptNames) };
      })
      .sort((a, b) => b.term.localeCompare(a.term));
  })();

  // 제출서류 = 최신 모집요강(승인 우선)의 required_documents 파생 + 자동분류
  const repSpec =
    (specs ?? []).find((s) => s.status === "approved") ?? (specs ?? [])[0];
  const { forms: derivedForms, issued: derivedIssued } = classifyRequiredDocs(
    (repSpec?.required_documents as RequiredDoc[]) ?? []
  );
  // 관리 상태 오버레이용 인덱스
  const formByKey = new Map(
    (formFiles ?? []).map((f) => [f.key as string, f] as const)
  );
  // 발급서류 매칭 인덱스 (공용 마스터 + 대학별 조정본, std_key→이름/별칭)
  const submissionIndex = buildSubmissionIndex(
    (submissions ?? []).map((s) => ({
      id: s.id,
      university_id: s.university_id,
      base_submission_id: s.base_submission_id,
      name_ko: s.name_ko,
      std_key: s.std_key ?? null,
      aliases: s.aliases ?? [],
      sample_image_url: s.sample_image_url,
      status: s.status,
    }))
  );

  const defaultValues: Partial<UniversityInput> = {
    active: row.active,
    name_ko: row.name_ko,
    name_vi: row.name_vi,
    region_ko: row.region_ko,
    region_vi: row.region_vi,
    logo_url: row.logo_url,
    photo_url: row.photo_url,
    website_url: row.website_url,
    desc_ko: row.desc_ko,
    desc_vi: row.desc_vi,
    class_days_ko: row.class_days_ko,
    class_days_vi: row.class_days_vi,
    transport_bus: row.transport_bus,
    transport_subway: row.transport_subway,
    transport_train: row.transport_train,
    transport_desc_ko: row.transport_desc_ko,
    transport_desc_vi: row.transport_desc_vi,
    dormitory: row.dormitory,
    dormitory_desc_ko: row.dormitory_desc_ko,
    dormitory_desc_vi: row.dormitory_desc_vi,
    feature_transport: row.feature_transport,
    feature_parttime: row.feature_parttime,
    feature_housing: row.feature_housing,
    feature_dormitory: row.feature_dormitory,
    strengths: row.strengths,
    tags_ko: row.tags_ko,
    tags_vi: row.tags_vi,
    categories: row.categories,
    emoji: row.emoji,
  };

  return (
    <>
      <PageHeader
        title={row.name_ko}
        description={`대학 #${numericId}`}
        breadcrumbs={[
          { href: "/universities", label: "대학교" },
          { label: row.name_ko },
        ]}
        actions={
          <Link
            href={`/admissions/new?university_id=${numericId}`}
            className={buttonVariants()}
          >
            <Plus className="size-4" />
            새학기 모집요강 추가
          </Link>
        }
      />
      <div className="p-6 space-y-6">
        <UniversityForm
          mode="edit"
          universityId={numericId}
          defaultValues={defaultValues}
        />

        <Card className="overflow-hidden p-0">
          <div className="p-4 flex items-center justify-between border-b">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-base">학과</h2>
              <Badge variant="secondary">{depts?.length ?? 0}</Badge>
            </div>
            <Link
              href={`/departments/new?university_id=${numericId}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Plus className="size-4" />
              학과 추가
            </Link>
          </div>
          {!depts || depts.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              등록된 학과가 없습니다.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">아이콘</TableHead>
                  <TableHead>학과명</TableHead>
                  <TableHead className="w-24">과정</TableHead>
                  <TableHead>모집학기</TableHead>
                  <TableHead className="w-24 text-center">노출 순서</TableHead>
                  <TableHead className="w-20 text-center">상태</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedDepts.map((d) => {
                  const href = `/departments/${d.id}`;
                  const terms = publishedTermsByDept.get(d.id) ?? [];
                  return (
                    <TableRow key={d.id} className="cursor-pointer">
                      <TableCell>
                        <Link href={href} className="block">
                          {d.icon ?? "📚"}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={href} className="hover:text-primary font-medium">
                          {d.name_ko}
                        </Link>
                        {d.name_vi && (
                          <Link
                            href={href}
                            className="block text-xs text-muted-foreground"
                          >
                            {d.name_vi}
                          </Link>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <Link href={href} className="block">
                          {d.study_period ? d.study_period : "—"}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={href} className="flex flex-wrap gap-1">
                          {terms.length === 0 ? (
                            <span className="text-xs text-muted-foreground">
                              모집 없음
                            </span>
                          ) : (
                            terms
                              .slice()
                              .sort((a, b) => b.localeCompare(a))
                              .map((t) => (
                                <Badge
                                  key={t}
                                  className="border-success/20 bg-success/10 text-[10px] text-success"
                                >
                                  {t}
                                </Badge>
                              ))
                          )}
                        </Link>
                      </TableCell>
                      <TableCell className="text-center text-xs text-muted-foreground">
                        <Link href={href} className="block">
                          {d.sort_order}
                        </Link>
                      </TableCell>
                      <TableCell className="text-center">
                        <Link href={href} className="block">
                          {d.active ? (
                            <Badge className="bg-success/10 text-success border-success/20">
                              활성
                            </Badge>
                          ) : (
                            <Badge variant="outline">숨김</Badge>
                          )}
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>

        {/* 모집요강 — 모집요강 메뉴와 연동 */}
        <Card className="overflow-hidden p-0">
          <div className="p-4 flex items-center justify-between border-b">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-base">모집요강</h2>
              <Badge variant="secondary">{termGroups.length} 학기</Badge>
            </div>
            <Link
              href={`/admissions?uni=${numericId}&tab=guidelines`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <FileText className="size-4" />
              입학서류에서 보기
            </Link>
          </div>
          {!specs || specs.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              등록된 모집요강이 없습니다.{" "}
              <Link href={`/admissions/new?university_id=${numericId}`} className="text-primary hover:underline">
                PDF 업로드로 추가 →
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">학기</TableHead>
                  <TableHead className="w-40">과정</TableHead>
                  <TableHead>학과</TableHead>
                  <TableHead className="w-24 text-center">상태</TableHead>
                  <TableHead className="w-28">갱신</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {termGroups.map(({ term, rep, extra, deptNames }) => {
                  const href = `/admissions/specs/${rep.id}`;
                  return (
                    <TableRow key={term} className="cursor-pointer">
                      <TableCell className="text-sm">
                        <Link href={href} className="block hover:text-primary font-medium">
                          {term}
                          {extra > 0 ? (
                            <span className="ml-1 text-xs font-normal text-muted-foreground">
                              +{extra}개 요강
                            </span>
                          ) : null}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">
                        <Link href={href} className="block">
                          {PROGRAM_TYPE_LABEL[rep.program_type] ?? rep.program_type}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <Link href={href} className="block">
                          {deptNames.length === 0
                            ? "—"
                            : deptNames.slice(0, 3).join(" · ") +
                              (deptNames.length > 3 ? ` +${deptNames.length - 3}` : "")}
                        </Link>
                      </TableCell>
                      <TableCell className="text-center">
                        <Link href={href} className="block">
                          {rep.status === "approved" ? (
                            <Badge className="bg-success/10 text-success border-success/20">
                              {SPEC_STATUS_LABEL[rep.status] ?? rep.status}
                            </Badge>
                          ) : (
                            <Badge variant="outline">
                              {SPEC_STATUS_LABEL[rep.status] ?? rep.status}
                            </Badge>
                          )}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <Link href={href} className="block">
                          {new Date(rep.updated_at).toLocaleDateString("ko-KR")}
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>

        {/* 제출서류 — 최신 모집요강 required_documents 파생 + 자동분류(직접작성/발급) */}
        <Card className="overflow-hidden p-0">
          <div className="border-b p-4">
            <h2 className="text-base font-semibold">제출서류</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {repSpec
                ? `최신 모집요강(${repSpec.term}) 기준으로 자동 분류된 목록입니다. 각 서류를 눌러 양식 업로드·발급 조건을 관리하세요.`
                : "모집요강을 먼저 등록하면 제출서류 목록이 표시됩니다."}
            </p>
          </div>

          {!repSpec ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              등록된 모집요강이 없습니다.{" "}
              <Link
                href={`/admissions/new?university_id=${numericId}`}
                className="text-primary hover:underline"
              >
                새학기 모집요강 추가 →
              </Link>
            </div>
          ) : (
            <>
              {/* 1) 직접작성 서류 */}
              <div className="border-b">
                <div className="flex items-center gap-2 px-4 py-2.5">
                  <h3 className="text-sm font-semibold">직접작성 서류 (학교 양식)</h3>
                  <Badge variant="secondary">{derivedForms.length}</Badge>
                </div>
                {derivedForms.length === 0 ? (
                  <div className="px-4 pb-4 text-xs text-muted-foreground">
                    모집요강에 직접작성 양식이 없습니다.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>서류명</TableHead>
                        <TableHead className="w-24 text-center">상태</TableHead>
                        <TableHead className="w-40">파일</TableHead>
                        <TableHead className="w-28 text-center">관리</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {derivedForms.map((doc) => {
                        const file = formByKey.get(doc.key);
                        return (
                          <TableRow key={`form-${doc.key}-${doc.name_ko}`}>
                            <TableCell className="font-medium">
                              {doc.name_ko}_{row.name_ko}
                            </TableCell>
                            <TableCell className="text-center">
                              {file ? (
                                <Badge className="border-success/20 bg-success/10 text-success">
                                  사용
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-amber-600">
                                  미등록
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {file ? (
                                <a
                                  href={file.file_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  download
                                  className="inline-flex items-center gap-1 text-primary hover:underline"
                                  title={file.file_name}
                                >
                                  <Download className="size-3.5" />
                                  {file.file_name}
                                </a>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <Link
                                href={
                                  file
                                    ? `/admissions/forms/${file.id}`
                                    : `/admissions/forms/new?university_id=${numericId}`
                                }
                                className="text-xs text-primary hover:underline"
                              >
                                {file ? "편집" : "양식 업로드"} →
                              </Link>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>

              {/* 2) 발급 서류 */}
              <div>
                <div className="flex items-center gap-2 px-4 py-2.5">
                  <h3 className="text-sm font-semibold">발급 서류</h3>
                  <Badge variant="secondary">{derivedIssued.length}</Badge>
                </div>
                {derivedIssued.length === 0 ? (
                  <div className="px-4 pb-4 text-xs text-muted-foreground">
                    모집요강에 발급 서류가 없습니다.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>서류명</TableHead>
                        <TableHead className="w-28 text-center">구분</TableHead>
                        <TableHead className="w-24 text-center">샘플</TableHead>
                        <TableHead className="w-28 text-center">관리</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {derivedIssued.map((doc) => {
                        const m = matchIssuedDoc(doc, submissionIndex);
                        const sample =
                          m.submission?.sample_image_url ??
                          m.master?.sample_image_url ??
                          null;
                        return (
                          <TableRow key={`issued-${doc.key}-${doc.name_ko}`}>
                            <TableCell className="font-medium">
                              {doc.name_ko}
                            </TableCell>
                            <TableCell className="text-center">
                              {m.kind === "university" ? (
                                m.master ? (
                                  <Badge className="border-success/20 bg-success/10 text-success">
                                    공용 기반(조정)
                                  </Badge>
                                ) : (
                                  <Badge className="border-success/20 bg-success/10 text-success">
                                    대학 전용
                                  </Badge>
                                )
                              ) : m.kind === "shared" ? (
                                <Badge variant="outline">공용 표준</Badge>
                              ) : (
                                <Badge variant="outline" className="text-amber-600">
                                  미등록
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {sample ? (
                                <Badge className="border-success/20 bg-success/10 text-success">
                                  있음
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">없음</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <IssuedDocActions
                                kind={m.kind}
                                universityId={numericId}
                                submissionId={m.submission?.id ?? null}
                                masterId={m.master?.id ?? null}
                                docName={doc.name_ko}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
            </>
          )}
        </Card>
      </div>
    </>
  );
}
