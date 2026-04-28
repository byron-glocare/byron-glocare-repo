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
    // hero 가 'N' 이 아닌 것 우선 (Hero 영역 노출), 그 안에서 값 오름차순
    // 그 다음 'N' 인 것은 id 내림차순
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
            등록된 사례가 없습니다.
          </Card>
        ) : (
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead className="w-20 text-center">노출</TableHead>
                  <TableHead className="w-20">썸네일</TableHead>
                  <TableHead className="w-28">카테고리</TableHead>
                  <TableHead>제목 (한)</TableHead>
                  <TableHead className="w-44">TikTok</TableHead>
                  <TableHead className="w-20 text-center">상태</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cases.map((c) => (
                  <TableRow key={c.id} className="hover:bg-muted/30">
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      <Link
                        href={`/study-cases/${c.id}`}
                        className="hover:text-primary"
                      >
                        {c.id}
                      </Link>
                    </TableCell>
                    <TableCell className="text-center">
                      <HeroBadge hero={c.hero} />
                    </TableCell>
                    <TableCell>
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
                    </TableCell>
                    <TableCell className="text-xs">
                      {dash(c.category_ko)}
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link
                        href={`/study-cases/${c.id}`}
                        className="hover:text-primary"
                      >
                        {c.title_ko ?? (
                          <span className="text-muted-foreground italic">
                            (제목 없음)
                          </span>
                        )}
                      </Link>
                      {c.title_vi && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {c.title_vi}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground truncate max-w-[180px]">
                      {c.tiktok_url ? (
                        <a
                          href={c.tiktok_url}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-primary"
                        >
                          링크 →
                        </a>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {c.active ? (
                        <Badge className="bg-success/10 text-success border-success/20">
                          활성
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          숨김
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
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
