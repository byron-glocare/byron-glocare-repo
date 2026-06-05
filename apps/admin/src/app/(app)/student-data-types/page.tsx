/**
 * /student-data-types — 표준 데이터 타입 카탈로그 (B4-2).
 *   한국 대학 양식이 학생에게 요구하는 정보의 표준화 목록.
 *   카테고리별 그룹 + 신규 추가.
 */

import Link from "next/link";
import { Plus } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
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

const CATEGORY_LABEL: Record<string, string> = {
  identity: "신원",
  education: "학력",
  family: "가족",
  financial: "재정",
  language: "어학",
  contact: "연락처",
  career: "경력·자격",
  essay: "서술형 (작문 기초)",
  document: "첨부 파일",
  other: "기타",
};

const CATEGORY_ORDER = [
  "identity",
  "education",
  "family",
  "financial",
  "language",
  "contact",
  "career",
  "essay",
  "document",
  "other",
];

const INPUT_TYPE_LABEL: Record<string, string> = {
  text: "단문",
  long_text: "장문",
  date: "날짜",
  number: "숫자",
  select: "선택",
  multi_select: "복수선택",
  file: "파일",
  boolean: "예/아니오",
  signature: "서명",
};

export default async function StudentDataTypesPage() {
  const supabase = await createClient();

  const { data: types, error } = await supabase
    .from("study_student_data_types")
    .select("*")
    .order("category", { ascending: true })
    .order("sort_order", { ascending: true });

  // 카테고리별 그룹화
  const byCategory = new Map<string, typeof types>();
  for (const t of types ?? []) {
    if (!byCategory.has(t.category)) byCategory.set(t.category, []);
    byCategory.get(t.category)!.push(t);
  }

  return (
    <>
      <PageHeader
        title="표준 데이터 카탈로그"
        description="한국 대학 양식이 요구하는 학생 정보 표준 — 같은 정보를 여러 양식에서 다시 묻지 않도록"
        breadcrumbs={[{ label: "표준 데이터" }]}
        actions={
          <Link href="/student-data-types/new" className={buttonVariants()}>
            <Plus className="size-4" />
            데이터 타입 추가
          </Link>
        }
      />
      <div className="p-6 space-y-4">
        {error ? (
          <Card className="p-6 text-sm text-destructive">
            데이터를 불러오지 못했습니다: {error.message}
          </Card>
        ) : !types || types.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-sm text-muted-foreground">
              아직 등록된 데이터 타입이 없습니다. SQL 시드를 실행했는지 확인하세요.
            </p>
          </Card>
        ) : (
          CATEGORY_ORDER.filter((c) => byCategory.has(c)).map((cat) => {
            const items = byCategory.get(cat)!;
            return (
              <Card key={cat}>
                <div className="border-b px-4 py-3">
                  <h2 className="text-sm font-semibold">
                    {CATEGORY_LABEL[cat] ?? cat}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      ({items.length})
                    </span>
                  </h2>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-48">key</TableHead>
                      <TableHead>한국어 / 베트남어</TableHead>
                      <TableHead className="w-24">입력</TableHead>
                      <TableHead className="w-20 text-center">작문기초</TableHead>
                      <TableHead className="w-16 text-center">기본필수</TableHead>
                      <TableHead className="w-16 text-center">활성</TableHead>
                      <TableHead className="w-16 text-right"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-mono text-xs">
                          {t.key}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium">{t.label_ko}</span>
                            {t.is_derived ? (
                              <Badge variant="secondary" className="text-[10px]">
                                택1·파생
                              </Badge>
                            ) : null}
                            {t.aliases && t.aliases.length > 0 ? (
                              <Badge variant="outline" className="text-[10px]">
                                별칭 {t.aliases.length}
                              </Badge>
                            ) : null}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {t.label_vi}
                          </div>
                          {t.hint_ko ? (
                            <div className="mt-1 text-xs text-muted-foreground line-clamp-2">
                              💡 {t.hint_ko}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {INPUT_TYPE_LABEL[t.input_type] ?? t.input_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {t.is_essay_basis ? "✓" : "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          {t.is_default_required ? "✓" : "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          {t.is_active ? (
                            <Badge>활성</Badge>
                          ) : (
                            <Badge variant="outline">비활성</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Link
                            href={`/student-data-types/${t.id}/edit`}
                            className={buttonVariants({
                              variant: "outline",
                              size: "sm",
                            })}
                          >
                            편집
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            );
          })
        )}
      </div>
    </>
  );
}
