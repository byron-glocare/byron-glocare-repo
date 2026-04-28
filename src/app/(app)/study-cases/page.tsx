import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { dash } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function StudyCasesPage() {
  const supabase = await createClient();

  const { data: cases, error } = await supabase
    .from("study_cases")
    .select(
      "id, active, hero, tiktok_url, tiktok_thumb, category_ko, category_vi, title_ko, title_vi"
    )
    .order("hero", { ascending: true })
    .order("id", { ascending: false });

  return (
    <>
      <PageHeader
        title="사례"
        description="유학 도메인 — 취업 사례 (홈페이지 Hero / Cases 섹션)"
        breadcrumbs={[{ label: "사례" }]}
        actions={
          <Link href="/study-cases/new" className={buttonVariants()}>
            <Plus className="size-4" />
            사례 등록
          </Link>
        }
      />
      <div className="p-6 space-y-4">
        {error ? (
          <Card className="p-6 text-sm text-destructive">
            데이터를 불러오지 못했습니다: {error.message}
          </Card>
        ) : !cases || cases.length === 0 ? (
          <Card className="p-12 text-center text-sm text-muted-foreground">
            등록된 사례가 없습니다.{" "}
            <Link
              href="/study-cases/new"
              className="text-primary hover:underline"
            >
              첫 사례 등록하기 →
            </Link>
          </Card>
        ) : (
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20 text-center">노출</TableHead>
                  <TableHead className="w-20">썸네일</TableHead>
                  <TableHead className="w-28">카테고리</TableHead>
                  <TableHead>제목 (한)</TableHead>
                  <TableHead className="w-32">TikTok</TableHead>
                  <TableHead className="w-20 text-center">상태</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cases.map((c) => {
                  const href = `/study-cases/${c.id}`;
                  return (
                    <TableRow key={c.id} className="cursor-pointer">
                      <TableCell className="text-center">
                        <Link href={href} className="block">
                          <HeroBadge hero={c.hero} />
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={href} className="block">
                          {c.tiktok_thumb ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={c.tiktok_thumb}
                              alt=""
                              referrerPolicy="no-referrer"
                              className="h-12 w-9 rounded object-cover bg-muted"
                            />
                          ) : (
                            <div className="h-12 w-9 rounded bg-muted/50 flex items-center justify-center text-xs text-muted-foreground">
                              —
                            </div>
                          )}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs">
                        <Link href={href} className="block">
                          {dash(c.category_ko)}
                        </Link>
                      </TableCell>
                      <TableCell className="font-medium">
                        <Link href={href} className="hover:text-primary">
                          {c.title_ko ?? (
                            <span className="text-muted-foreground italic">
                              (제목 없음)
                            </span>
                          )}
                        </Link>
                        {c.title_vi && (
                          <Link
                            href={href}
                            className="block text-xs text-muted-foreground mt-0.5"
                          >
                            {c.title_vi}
                          </Link>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {c.tiktok_url ? (
                          <a
                            href={c.tiktok_url}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:text-primary"
                          >
                            영상 →
                          </a>
                        ) : (
                          <Link href={href} className="block">
                            —
                          </Link>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Link href={href} className="block">
                          {c.active ? (
                            <Badge className="bg-success/10 text-success border-success/20">
                              활성
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-muted-foreground"
                            >
                              숨김
                            </Badge>
                          )}
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

function HeroBadge({ hero }: { hero: string }) {
  if (hero === "N") {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        Cases
      </Badge>
    );
  }
  return (
    <Badge className="bg-coral/10 text-primary border-primary/30">
      Hero {hero}
    </Badge>
  );
}
