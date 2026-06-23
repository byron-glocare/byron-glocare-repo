import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, FileText } from "lucide-react";

import { createAdminClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { dash, formatDate, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

const STUDENT_FILES_BUCKET = "student-files";

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

function bytes(n: number | null): string {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default async function ManagedStudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data: student } = await admin
    .from("study_managed_students")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!student) notFound();

  const [{ data: org }, { data: files }] = await Promise.all([
    admin
      .from("study_center_orgs")
      .select("name_ko, name_vi")
      .eq("id", student.org_id)
      .maybeSingle(),
    admin
      .from("study_student_submission_files")
      .select("id, doc_key, file_path, file_name, size_bytes, created_at")
      .eq("student_id", id)
      .order("created_at", { ascending: false }),
  ]);

  // 업로드 서류 다운로드용 서명 URL (1시간)
  const signed = await Promise.all(
    (files ?? []).map(async (f) => {
      const { data } = await admin.storage
        .from(STUDENT_FILES_BUCKET)
        .createSignedUrl(f.file_path, 60 * 60);
      return { ...f, url: data?.signedUrl ?? null };
    })
  );

  const orgName = org?.name_ko || org?.name_vi || "—";
  const info: { label: string; value: string }[] = [
    { label: "유학센터", value: orgName },
    { label: "생년월일", value: dash(formatDate(student.dob)) },
    { label: "전화", value: dash(student.phone) },
    { label: "이메일", value: dash(student.email) },
    {
      label: "TOPIK",
      value: student.topik_level ? `${student.topik_level}급` : "—",
    },
    {
      label: "비자",
      value: student.current_visa
        ? VISA_LABEL[student.current_visa] ?? student.current_visa
        : "—",
    },
    {
      label: "위치",
      value: student.location
        ? LOC_LABEL[student.location] ?? student.location
        : "—",
    },
    { label: "등록일", value: formatDateTime(student.created_at) },
  ];

  return (
    <>
      <PageHeader
        title={student.name}
        description="유학생 상세 — 조회 전용"
        breadcrumbs={[
          { href: "/managed-students", label: "유학생" },
          { label: student.name },
        ]}
      />
      <div className="p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">기본 정보</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
              {info.map((i) => (
                <div key={i.label}>
                  <dt className="text-xs text-muted-foreground">{i.label}</dt>
                  <dd className="mt-0.5 text-sm">{i.value}</dd>
                </div>
              ))}
            </dl>
            {student.notes ? (
              <div className="mt-4">
                <dt className="text-xs text-muted-foreground">메모</dt>
                <dd className="mt-0.5 whitespace-pre-wrap text-sm">
                  {student.notes}
                </dd>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3">
            <CardTitle className="text-base">업로드한 제출서류</CardTitle>
            {signed.length > 0 ? (
              <a
                href={`/managed-students/${id}/download-all`}
                className={buttonVariants({ variant: "default", size: "sm" })}
              >
                <Download className="size-3.5" />
                전체 다운로드 (zip)
              </a>
            ) : null}
          </CardHeader>
          <CardContent>
            {signed.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                업로드된 서류가 없습니다.
              </p>
            ) : (
              <div className="divide-y divide-border rounded-md border border-border">
                {signed.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between gap-3 p-3"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                          {f.file_name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {f.doc_key ? (
                            <Badge variant="outline" className="mr-1 text-[10px]">
                              {f.doc_key}
                            </Badge>
                          ) : null}
                          {bytes(f.size_bytes)} · {formatDate(f.created_at)}
                        </div>
                      </div>
                    </div>
                    {f.url ? (
                      <a
                        href={f.url}
                        className={buttonVariants({
                          variant: "outline",
                          size: "sm",
                        })}
                      >
                        <Download className="size-3.5" />
                        다운로드
                      </a>
                    ) : (
                      <span className="text-xs text-destructive">링크 오류</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 확정된 작성서류 — Phase 2 에서 추가 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">확정 작성서류</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="py-6 text-center text-sm text-muted-foreground">
              유학센터에서 ‘확정’한 작성서류가 여기에 표시됩니다. (준비 중)
            </p>
          </CardContent>
        </Card>

        <Link
          href="/managed-students"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          ← 목록으로
        </Link>
      </div>
    </>
  );
}
