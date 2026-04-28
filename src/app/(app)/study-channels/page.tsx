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
import { dash } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function StudyChannelsPage() {
  const supabase = await createClient();

  const { data: channels, error } = await supabase
    .from("study_channels")
    .select("*")
    .order("sort_order")
    .order("id");

  return (
    <>
      <PageHeader
        title="SNS 채널"
        description="유학 도메인 — 홈페이지 /about 페이지의 SNS 채널 그리드"
        breadcrumbs={[{ label: "SNS 채널" }]}
        actions={
          <Link href="/study-channels/new" className={buttonVariants()}>
            <Plus className="size-4" />
            채널 등록
          </Link>
        }
      />
      <div className="p-6 space-y-4">
        {error ? (
          <Card className="p-6 text-sm text-destructive">
            데이터를 불러오지 못했습니다: {error.message}
          </Card>
        ) : !channels || channels.length === 0 ? (
          <Card className="p-12 text-center text-sm text-muted-foreground">
            등록된 채널이 없습니다.
          </Card>
        ) : (
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead className="w-12">아이콘</TableHead>
                  <TableHead className="w-24">유형</TableHead>
                  <TableHead>이름</TableHead>
                  <TableHead className="w-36">핸들</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead className="w-16 text-center">정렬</TableHead>
                  <TableHead className="w-16 text-center">상태</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {channels.map((c) => (
                  <TableRow key={c.id} className="hover:bg-muted/30">
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      <Link
                        href={`/study-channels/${c.id}`}
                        className="hover:text-primary"
                      >
                        {c.id}
                      </Link>
                    </TableCell>
                    <TableCell>{c.icon ?? "🔗"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {dash(c.type)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/study-channels/${c.id}`}
                        className="hover:text-primary font-medium"
                      >
                        {c.name_ko ?? c.name_vi ?? "(이름 없음)"}
                      </Link>
                      {c.name_vi && c.name_ko !== c.name_vi && (
                        <div className="text-xs text-muted-foreground">
                          {c.name_vi}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {dash(c.handle)}
                    </TableCell>
                    <TableCell className="text-xs truncate max-w-xs">
                      {c.url ? (
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-primary"
                        >
                          {c.url}
                        </a>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">
                      {c.sort_order}
                    </TableCell>
                    <TableCell className="text-center">
                      {c.active ? (
                        <Badge className="bg-success/10 text-success border-success/20">
                          활성
                        </Badge>
                      ) : (
                        <Badge variant="outline">숨김</Badge>
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
