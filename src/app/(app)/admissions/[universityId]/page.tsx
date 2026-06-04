/**
 * /admissions/[universityId] — 대학 기준 입학서류 통합 화면 (B1).
 *
 *   한 대학의 [모집요강(specs) + 필수서류 + 양식파일(forms)] 을 한 곳에서.
 *   - 모집요강: study_admission_specs (term/program/status) → spec 상세는 /admissions/specs/[id]
 *   - 필수서류: 대표 spec(승인 우선)의 required_documents → 양식 key 와 매칭 표시
 *   - 양식파일: study_admission_form_files (FormFilesManager 재사용, 학과 override)
 *
 *   "대학교" 메뉴(마스터 데이터)와 분리 — 여기는 입학 서류 운영 전용.
 */

import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { Plus, Pencil, ExternalLink, CheckCircle2, Circle } from "lucide-react";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FormFilesManager } from "@/app/(app)/universities/[id]/forms/forms-manager";

export const dynamic = "force-dynamic";

const PROGRAM_TYPE_LABEL: Record<string, string> = {
  language_program: "어학연수 (D-4)",
  associate_2yr: "전문학사 2년",
  bachelor_3yr_extension: "전공심화 (2+2)",
  bachelor_4yr: "학사 4년",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "초안",
  reviewing: "검수 중",
  approved: "승인",
  archived: "보관",
};

const NOTARIZATION_LABEL: Record<string, string> = {
  none: "없음",
  translation_notarization: "번역 공증",
  consul: "영사확인",
  consul_for_vietnam: "베트남 영사확인",
  apostille: "아포스티유",
  apostille_or_consul: "아포스티유 또는 영사확인",
};

type RequiredDoc = {
  key?: string;
  name_ko?: string;
  required?: boolean;
  notarization?: string;
  language?: string;
  notes?: string | null;
};

function statusBadge(status: string) {
  const label = STATUS_LABEL[status] ?? status;
  switch (status) {
    case "approved":
      return (
        <Badge className="bg-success/10 text-success border-success/20">
          {label}
        </Badge>
      );
    case "reviewing":
      return (
        <Badge className="bg-warning/10 text-warning border-warning/20">
          {label}
        </Badge>
      );
    case "draft":
      return <Badge variant="outline">{label}</Badge>;
    default:
      return (
        <Badge variant="outline" className="text-muted-foreground">
          {label}
        </Badge>
      );
  }
}

export default async function UniversityAdmissionPage({
  params,
}: {
  params: Promise<{ universityId: string }>;
}) {
  const { universityId } = await params;
  const uid = Number(universityId);
  if (!Number.isFinite(uid)) notFound();

  // 어드민 인증
  const supabaseUser = await createClient();
  const {
    data: { user },
  } = await supabaseUser.auth.getUser();
  if (!user) redirect(`/login?redirect=/admissions/${universityId}`);

  const supabase = createAdminClient();

  const { data: university } = await supabase
    .from("universities")
    .select("id, name_ko, active")
    .eq("id", uid)
    .single();
  if (!university) notFound();

  // 모집요강 + 학과 + 양식 + 카탈로그 동시 로드
  const [
    { data: specRows },
    { data: deptRows },
    { data: cur },
    { data: arch },
    { data: dt },
  ] = await Promise.all([
    supabase
      .from("study_admission_specs")
      .select(
        "id, term, admission_category, program_type, status, departments, required_documents, approved_at, updated_at"
      )
      .eq("university_id", uid)
      .order("updated_at", { ascending: false }),
    supabase
      .from("departments")
      .select("id, name_ko, active, sort_order")
      .eq("university_id", uid)
      .eq("active", true)
      .order("sort_order"),
    supabase
      .from("study_admission_form_files")
      .select("*")
      .eq("university_id", uid)
      .eq("is_current", true)
      .order("department_name", { ascending: true, nullsFirst: true })
      .order("key"),
    supabase
      .from("study_admission_form_files")
      .select("*")
      .eq("university_id", uid)
      .eq("is_current", false)
      .order("uploaded_at", { ascending: false })
      .limit(50),
    supabase
      .from("study_student_data_types")
      .select("key, label_ko, category, is_essay_basis")
      .eq("is_active", true)
      .order("category")
      .order("sort_order"),
  ]);

  const specs = specRows ?? [];
  const depts = (deptRows ?? []).map((d) => ({ id: d.id, name_ko: d.name_ko }));

  type FormFileRow = {
    id: string;
    department_name: string | null;
    key: string;
    name_ko: string;
    file_url: string;
    file_name: string;
    size_bytes: number | null;
    uploaded_at: string;
    notes: string | null;
    required_data_type_keys: string[] | null;
    essay_questions: unknown;
  };
  const currentFiles = (cur ?? []) as FormFileRow[];
  const archivedFiles = (arch ?? []) as Array<{
    id: string;
    department_name: string | null;
    key: string;
    name_ko: string;
    file_url: string;
    file_name: string;
    uploaded_at: string;
  }>;
  const dataTypes = (dt ?? []) as Array<{
    key: string;
    label_ko: string;
    category: string;
    is_essay_basis: boolean;
  }>;

  // 대표 spec 선택: 승인 우선, 없으면 최신 갱신
  const repSpec =
    specs.find((s) => s.status === "approved") ?? specs[0] ?? null;
  const requiredDocs: RequiredDoc[] = Array.isArray(repSpec?.required_documents)
    ? (repSpec!.required_documents as RequiredDoc[])
    : [];

  // 양식 key 집합 (필수서류 ↔ 양식 매칭 표시용)
  const formKeys = new Set(currentFiles.map((f) => f.key));

  const approvedCount = specs.filter((s) => s.status === "approved").length;

  return (
    <>
      <PageHeader
        title={university.name_ko}
        description={`모집요강 ${specs.length}건 · 승인 ${approvedCount}건 · 양식 ${currentFiles.length}개`}
        breadcrumbs={[
          { label: "입학서류", href: "/admissions" },
          { label: university.name_ko },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href={`/universities/${uid}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <ExternalLink className="size-4" />
              대학 마스터
            </Link>
            <Link
              href={`/admissions/new?university_id=${uid}`}
              className={buttonVariants({ size: "sm" })}
            >
              <Plus className="size-4" />
              모집요강 추가
            </Link>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {!university.active ? (
          <Card className="border-amber-300 bg-amber-50/60 p-3 text-xs text-amber-800">
            이 대학은 <strong>비노출(active=false)</strong> 상태입니다 — 학생
            포털에 노출되지 않습니다. 노출하려면 대학 마스터에서 활성화하세요.
          </Card>
        ) : null}

        {/* 1) 모집요강 */}
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">모집요강</h2>
          {specs.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              등록된 모집요강이 없습니다.{" "}
              <Link
                href={`/admissions/new?university_id=${uid}`}
                className="text-primary hover:underline"
              >
                모집요강 추가 →
              </Link>
            </Card>
          ) : (
            <Card className="overflow-hidden p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-40">과정</TableHead>
                    <TableHead className="w-28">학기</TableHead>
                    <TableHead>학과</TableHead>
                    <TableHead className="w-24 text-center">상태</TableHead>
                    <TableHead className="w-28">갱신</TableHead>
                    <TableHead className="w-16 text-center">편집</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {specs.map((s) => {
                    const href = `/admissions/specs/${s.id}`;
                    const ds = Array.isArray(s.departments)
                      ? (s.departments as Array<{ name?: string }>)
                      : [];
                    const deptNames = ds
                      .map((d) => d?.name)
                      .filter(Boolean) as string[];
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="text-sm">
                          <Link href={href} className="block hover:text-primary">
                            {PROGRAM_TYPE_LABEL[s.program_type] ??
                              s.program_type}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm">
                          <Link href={href} className="block">
                            {s.term}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm">
                          <Link href={href} className="block">
                            {deptNames.length === 0
                              ? "—"
                              : deptNames.length <= 3
                                ? deptNames.join(" · ")
                                : `${deptNames.slice(0, 3).join(" · ")} +${deptNames.length - 3}`}
                          </Link>
                        </TableCell>
                        <TableCell className="text-center">
                          <Link href={href} className="block">
                            {statusBadge(s.status)}
                          </Link>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <Link href={href} className="block">
                            {new Date(s.updated_at).toLocaleDateString("ko-KR")}
                          </Link>
                        </TableCell>
                        <TableCell className="text-center">
                          <Link
                            href={`/admissions/specs/${s.id}/edit`}
                            className="inline-flex text-muted-foreground hover:text-primary"
                          >
                            <Pencil className="size-4" />
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </section>

        {/* 2) 필수서류 (대표 spec 기준) */}
        {requiredDocs.length > 0 ? (
          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground">필수 서류</h2>
              {repSpec ? (
                <span className="text-xs text-muted-foreground">
                  ({repSpec.term} · {STATUS_LABEL[repSpec.status] ?? repSpec.status}{" "}
                  모집요강 기준)
                </span>
              ) : null}
            </div>
            <Card className="p-0 overflow-hidden">
              <ul className="divide-y divide-border">
                {requiredDocs.map((doc, i) => {
                  const hasForm = doc.key ? formKeys.has(doc.key) : false;
                  return (
                    <li
                      key={`${doc.key ?? "doc"}-${i}`}
                      className="flex items-center justify-between gap-3 px-4 py-2.5"
                    >
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">
                          {doc.name_ko ?? doc.key ?? "—"}
                        </span>
                        {doc.required === false ? (
                          <Badge variant="outline" className="text-xs">
                            선택
                          </Badge>
                        ) : null}
                        {doc.notarization && doc.notarization !== "none" ? (
                          <span className="text-xs text-muted-foreground">
                            ·{" "}
                            {NOTARIZATION_LABEL[doc.notarization] ??
                              doc.notarization}
                          </span>
                        ) : null}
                      </div>
                      {doc.key ? (
                        hasForm ? (
                          <span className="flex items-center gap-1 text-xs text-success">
                            <CheckCircle2 className="size-3.5" />
                            양식 있음
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Circle className="size-3.5" />
                            양식 없음
                          </span>
                        )
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </Card>
            <p className="text-xs text-muted-foreground">
              ※ &ldquo;양식 있음/없음&rdquo;은 모집요강 서류 key 와 업로드된 양식
              파일의 key 가 일치하는지로 판단합니다. 정밀 매핑은 후속 라운드(B2/B3).
            </p>
          </section>
        ) : null}

        {/* 3) 양식 파일 */}
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">양식 파일</h2>
          <FormFilesManager
            universityId={uid}
            departments={depts}
            dataTypes={dataTypes}
            currentFiles={currentFiles.map((f) => ({
              id: f.id,
              department_name: f.department_name,
              key: f.key,
              name_ko: f.name_ko,
              file_url: f.file_url,
              file_name: f.file_name,
              size_bytes: f.size_bytes,
              uploaded_at: f.uploaded_at,
              notes: f.notes,
              required_data_type_keys: f.required_data_type_keys ?? [],
              essay_questions_count: Array.isArray(f.essay_questions)
                ? f.essay_questions.length
                : 0,
            }))}
            archivedFiles={archivedFiles.map((f) => ({
              id: f.id,
              department_name: f.department_name,
              key: f.key,
              name_ko: f.name_ko,
              file_url: f.file_url,
              file_name: f.file_name,
              uploaded_at: f.uploaded_at,
            }))}
          />
        </section>
      </div>
    </>
  );
}
