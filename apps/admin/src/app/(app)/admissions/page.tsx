/**
 * /admissions — 입학서류 "모아보기" (B5, study_documents 뷰 기반).
 *
 *   모집요강(guideline) + 양식(form) + 직접제출(submission) 을 한 뷰로 통합.
 *   - 상단: 대학별 집계 요약 (3종 문서 카운트)
 *   - 하단: 전체 문서 통합 목록 (종류 필터 + 검색) — 각 문서는 관리 허브로 링크
 *
 *   IA: "대학교" 메뉴 = 마스터 관리 / "입학서류" 메뉴 = 통합 뷰.
 *   실제 추가·편집은 /admissions/[universityId] 관리 허브에서.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, FileText, ClipboardList, ImageIcon } from "lucide-react";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
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
import { Card } from "@/components/ui/card";
import { DocumentsExplorer, type DocItem } from "./documents-explorer";
import {
  RequiredSubmissionsManager,
  type SubmissionRow,
  type DataTypeOption,
} from "@/components/admission/required-submissions-manager";

export const dynamic = "force-dynamic";

type UniRow = {
  id: number;
  name_ko: string;
  active: boolean;
  specTotal: number;
  specApproved: number;
  formCount: number;
  submissionCount: number;
  lastActivity: string | null;
};

export default async function AdmissionsPage() {
  // 어드민 인증
  const supabaseUser = await createClient();
  const {
    data: { user },
  } = await supabaseUser.auth.getUser();
  if (!user) redirect("/login?redirect=/admissions");

  const supabase = createAdminClient();

  // 통합 뷰 — 모든 입학서류 문서 (guideline/form/submission)
  const { data: docs } = await supabase
    .from("study_documents")
    .select("id, doc_type, university_id, department_label, name, status, updated_at");

  // 공용(university_id NULL) 직접제출 문서는 별도 '공용 제출서류' 섹션에서 다룸 →
  //   대학별 요약·모아보기에서는 제외.
  const docRows = (docs ?? []).filter((d) => d.university_id != null);

  // 공용 제출서류 + 표준데이터 카탈로그 (공용 섹션 관리용)
  const [{ data: globalSubRows }, { data: catalogRows }] = await Promise.all([
    supabase
      .from("study_required_submissions")
      .select("*")
      .is("university_id", null)
      .is("base_submission_id", null)
      .order("sort_order")
      .order("created_at", { ascending: false }),
    supabase
      .from("study_student_data_types")
      .select("key, label_ko, category, is_essay_basis")
      .eq("is_active", true)
      .order("category")
      .order("sort_order"),
  ]);

  // 대학별 집계
  const agg = new Map<
    number,
    {
      specTotal: number;
      specApproved: number;
      formCount: number;
      submissionCount: number;
      lastActivity: string | null;
    }
  >();
  function bump(uid: number) {
    if (!agg.has(uid))
      agg.set(uid, {
        specTotal: 0,
        specApproved: 0,
        formCount: 0,
        submissionCount: 0,
        lastActivity: null,
      });
    return agg.get(uid)!;
  }
  for (const d of docRows) {
    const a = bump(d.university_id);
    if (d.doc_type === "guideline") {
      a.specTotal += 1;
      if (d.status === "approved") a.specApproved += 1;
    } else if (d.doc_type === "form") {
      // 현행 양식만 카운트 (이력 제외)
      if (d.status === "current") a.formCount += 1;
    } else if (d.doc_type === "submission") {
      a.submissionCount += 1;
    }
    if (d.updated_at && (!a.lastActivity || d.updated_at > a.lastActivity)) {
      a.lastActivity = d.updated_at;
    }
  }

  const universityIds = Array.from(agg.keys());
  const { data: universities } =
    universityIds.length > 0
      ? await supabase
          .from("universities")
          .select("id, name_ko, active")
          .in("id", universityIds)
      : { data: [] as Array<{ id: number; name_ko: string; active: boolean }> };

  const uniName = new Map<number, string>(
    (universities ?? []).map((u) => [u.id, u.name_ko])
  );

  const rawRows: UniRow[] = (universities ?? []).map((u) => {
    const a = agg.get(u.id)!;
    return {
      id: u.id,
      name_ko: u.name_ko,
      active: u.active,
      specTotal: a.specTotal,
      specApproved: a.specApproved,
      formCount: a.formCount,
      submissionCount: a.submissionCount,
      lastActivity: a.lastActivity,
    };
  });

  // 같은 이름의 대학이 2개(이름 변형으로 자동 생성된 비노출 사본 등)면 한 줄로 합침.
  //   카운트는 합산, 링크는 노출(active) 레코드를 우선 canonical 로.
  const normName = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
  const mergedByName = new Map<string, UniRow>();
  for (const r of rawRows) {
    const k = normName(r.name_ko);
    const ex = mergedByName.get(k);
    if (!ex) {
      mergedByName.set(k, { ...r });
      continue;
    }
    ex.specTotal += r.specTotal;
    ex.specApproved += r.specApproved;
    ex.formCount += r.formCount;
    ex.submissionCount += r.submissionCount;
    if ((r.lastActivity ?? "") > (ex.lastActivity ?? "")) {
      ex.lastActivity = r.lastActivity;
    }
    // canonical 선택: 노출(active) 레코드를 대표로
    if (r.active && !ex.active) {
      ex.id = r.id;
      ex.active = true;
      ex.name_ko = r.name_ko;
    }
  }
  const rows: UniRow[] = Array.from(mergedByName.values()).sort((x, y) =>
    (y.lastActivity ?? "").localeCompare(x.lastActivity ?? "")
  );

  // 양식 문서명은 업로드한 실제 파일명으로 표시 (뷰의 name=name_ko 대신 file_name)
  const formIds = docRows
    .filter((d) => d.doc_type === "form")
    .map((d) => d.id);
  const { data: formFiles } =
    formIds.length > 0
      ? await supabase
          .from("study_admission_form_files")
          .select("id, file_name")
          .in("id", formIds)
      : { data: [] as Array<{ id: string; file_name: string }> };
  const fileNameById = new Map(
    (formFiles ?? []).map((f) => [f.id, f.file_name])
  );

  // 통합 탐색용 — 대학명 결합 (이력 양식은 모아보기에서 제외)
  const documents: DocItem[] = docRows
    .filter((d) => !(d.doc_type === "form" && d.status === "archived"))
    .map((d) => ({
      id: d.id,
      doc_type: d.doc_type as DocItem["doc_type"],
      university_id: d.university_id,
      university_name: uniName.get(d.university_id) ?? `대학 #${d.university_id}`,
      department_label: d.department_label,
      name:
        d.doc_type === "form"
          ? fileNameById.get(d.id) ?? d.name
          : d.name,
      status: d.status,
      updated_at: d.updated_at,
    }));

  const totalSpecs = docRows.filter((d) => d.doc_type === "guideline").length;
  const totalForms = docRows.filter(
    (d) => d.doc_type === "form" && d.status === "current"
  ).length;
  const totalSubs = docRows.filter((d) => d.doc_type === "submission").length;

  // 공용 제출서류 (전체 대학 공통)
  const globalSubmissions: SubmissionRow[] = (globalSubRows ?? []).map((r) => ({
    id: r.id,
    department_id: r.department_id,
    base_submission_id: r.base_submission_id,
    name_ko: r.name_ko,
    name_vi: r.name_vi,
    target_person: r.target_person,
    target_person_note: r.target_person_note,
    sample_image_url: r.sample_image_url,
    issuance_requirements: r.issuance_requirements ?? {},
    required_data_type_keys: r.required_data_type_keys ?? [],
    aliases: r.aliases ?? [],
    applies_to_languages: r.applies_to_languages ?? [],
    applies_to_locations: r.applies_to_locations ?? [],
    sort_order: r.sort_order,
    is_active: r.is_active,
    status: r.status,
  }));
  const catalog: DataTypeOption[] = (catalogRows ?? []).map((d) => ({
    key: d.key,
    label_ko: d.label_ko,
    category: d.category,
    is_essay_basis: d.is_essay_basis,
  }));

  return (
    <>
      <PageHeader
        title="입학서류"
        description={`대학 ${rows.length}곳 · 모집요강 ${totalSpecs}건 · 양식 ${totalForms}개 · 직접제출 ${totalSubs}건`}
        breadcrumbs={[{ label: "입학서류" }]}
        actions={
          <Link href="/admissions/new" className={buttonVariants()}>
            <Plus className="size-4" />
            모집요강 추가
          </Link>
        }
      />
      <div className="p-6 space-y-6">
        {rows.length === 0 ? (
          <Card className="p-12 text-center text-sm text-muted-foreground">
            등록된 입학서류가 없습니다.{" "}
            <Link href="/admissions/new" className="text-primary hover:underline">
              PDF 업로드 후 AI 추출 시작 →
            </Link>
          </Card>
        ) : (
          <>
            {/* 대학별 요약 */}
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-foreground">
                대학별 요약
              </h2>
              <Card className="overflow-hidden p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>대학교</TableHead>
                      <TableHead className="w-40 text-center">모집요강</TableHead>
                      <TableHead className="w-24 text-center">양식</TableHead>
                      <TableHead className="w-24 text-center">직접제출</TableHead>
                      <TableHead className="w-28">최근 갱신</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => {
                      const href = `/admissions/${r.id}`;
                      return (
                        <TableRow key={r.id} className="cursor-pointer">
                          <TableCell className="font-medium">
                            <Link
                              href={href}
                              className="flex items-center gap-2 hover:text-primary"
                            >
                              {r.name_ko}
                              {!r.active ? (
                                <Badge
                                  variant="outline"
                                  className="text-muted-foreground"
                                >
                                  비노출
                                </Badge>
                              ) : null}
                            </Link>
                          </TableCell>
                          <TableCell className="text-center text-sm">
                            <Link
                              href={href}
                              className="inline-flex items-center justify-center gap-1.5"
                            >
                              <ClipboardList className="size-3.5 text-muted-foreground" />
                              {r.specTotal}건
                              {r.specApproved > 0 ? (
                                <span className="text-success">
                                  (승인 {r.specApproved})
                                </span>
                              ) : null}
                            </Link>
                          </TableCell>
                          <TableCell className="text-center text-sm">
                            <Link
                              href={href}
                              className="inline-flex items-center justify-center gap-1.5"
                            >
                              <FileText className="size-3.5 text-muted-foreground" />
                              {r.formCount}개
                            </Link>
                          </TableCell>
                          <TableCell className="text-center text-sm">
                            <Link
                              href={href}
                              className="inline-flex items-center justify-center gap-1.5"
                            >
                              <ImageIcon className="size-3.5 text-muted-foreground" />
                              {r.submissionCount}건
                            </Link>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            <Link href={href} className="block">
                              {r.lastActivity
                                ? new Date(r.lastActivity).toLocaleDateString(
                                    "ko-KR"
                                  )
                                : "—"}
                            </Link>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Card>
            </section>

            {/* 전체 문서 통합 목록 */}
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-foreground">
                전체 문서 모아보기
              </h2>
              <DocumentsExplorer documents={documents} />
            </section>
          </>
        )}

        {/* 공용 제출서류 (전체 대학 공통) — 출입국 등 공통 요구 서류 */}
        <section className="space-y-2 border-t pt-6">
          <h2 className="text-sm font-semibold text-foreground">
            공용 제출서류
          </h2>
          <RequiredSubmissionsManager
            universityId={null}
            mode="global"
            departments={[]}
            dataTypes={catalog}
            submissions={globalSubmissions}
          />
        </section>
      </div>
    </>
  );
}
