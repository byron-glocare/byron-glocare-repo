/**
 * /admissions — 입학서류 홈 (대학 기준 통합).
 *
 *   모집요강(study_admission_specs) 또는 양식파일(study_admission_form_files)이
 *   하나라도 있는 대학을 목록으로 보여준다. 대학을 클릭하면
 *   /admissions/[universityId] 에서 [모집요강 + 필수서류 + 양식파일] 을 한 화면에.
 *
 *   "대학교" 메뉴(마스터 데이터 추가/편집)와 역할을 분리 —
 *   여기는 등록된 대학의 입학 관련 서류를 운영하는 곳.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, FileText, ClipboardList } from "lucide-react";

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

export const dynamic = "force-dynamic";

type UniRow = {
  id: number;
  name_ko: string;
  active: boolean;
  specTotal: number;
  specApproved: number;
  formCount: number;
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

  const [{ data: specs }, { data: forms }] = await Promise.all([
    supabase
      .from("study_admission_specs")
      .select("id, university_id, status, updated_at"),
    supabase
      .from("study_admission_form_files")
      .select("university_id, uploaded_at")
      .eq("is_current", true),
  ]);

  // 대학별 집계
  const agg = new Map<
    number,
    {
      specTotal: number;
      specApproved: number;
      formCount: number;
      lastActivity: string | null;
    }
  >();
  function bump(uid: number) {
    if (!agg.has(uid))
      agg.set(uid, {
        specTotal: 0,
        specApproved: 0,
        formCount: 0,
        lastActivity: null,
      });
    return agg.get(uid)!;
  }
  function touch(
    a: { lastActivity: string | null },
    ts: string | null | undefined
  ) {
    if (ts && (!a.lastActivity || ts > a.lastActivity)) a.lastActivity = ts;
  }
  for (const s of specs ?? []) {
    const a = bump(s.university_id);
    a.specTotal += 1;
    if (s.status === "approved") a.specApproved += 1;
    touch(a, s.updated_at);
  }
  for (const f of forms ?? []) {
    const a = bump(f.university_id);
    a.formCount += 1;
    touch(a, f.uploaded_at);
  }

  const universityIds = Array.from(agg.keys());
  const { data: universities } =
    universityIds.length > 0
      ? await supabase
          .from("universities")
          .select("id, name_ko, active")
          .in("id", universityIds)
      : { data: [] as Array<{ id: number; name_ko: string; active: boolean }> };

  const rows: UniRow[] = (universities ?? [])
    .map((u) => {
      const a = agg.get(u.id)!;
      return {
        id: u.id,
        name_ko: u.name_ko,
        active: u.active,
        specTotal: a.specTotal,
        specApproved: a.specApproved,
        formCount: a.formCount,
        lastActivity: a.lastActivity,
      };
    })
    .sort((x, y) => (y.lastActivity ?? "").localeCompare(x.lastActivity ?? ""));

  const totalSpecs = specs?.length ?? 0;
  const totalForms = forms?.length ?? 0;

  return (
    <>
      <PageHeader
        title="입학서류"
        description={`등록된 대학의 모집요강 + 양식파일 관리 (대학 ${rows.length}곳 · 모집요강 ${totalSpecs}건 · 양식 ${totalForms}개)`}
        breadcrumbs={[{ label: "입학서류" }]}
        actions={
          <Link href="/admissions/new" className={buttonVariants()}>
            <Plus className="size-4" />
            모집요강 추가
          </Link>
        }
      />
      <div className="p-6 space-y-4">
        {rows.length === 0 ? (
          <Card className="p-12 text-center text-sm text-muted-foreground">
            등록된 모집요강·양식이 없습니다.{" "}
            <Link href="/admissions/new" className="text-primary hover:underline">
              PDF 업로드 후 AI 추출 시작 →
            </Link>
          </Card>
        ) : (
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>대학교</TableHead>
                  <TableHead className="w-40 text-center">모집요강</TableHead>
                  <TableHead className="w-28 text-center">양식</TableHead>
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
        )}
      </div>
    </>
  );
}
