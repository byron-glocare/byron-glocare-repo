"use client";

import Link from "next/link";
import { MessageSquarePlus, Pencil } from "lucide-react";

import type { Consultation } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";

type Props = {
  customerId: string;
  consultations: Consultation[];
};

export function CustomerConsultationsTab({
  customerId,
  consultations,
}: Props) {
  const sorted = consultations
    .slice()
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          상담 이력 {consultations.length}건 · 삭제 불가, 수정만 가능
        </div>
        <Link
          href={`/consultations/new?customer_id=${customerId}`}
          className={buttonVariants()}
        >
          <MessageSquarePlus className="size-4" />새 상담 일지 작성
        </Link>
      </div>

      {sorted.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            이전 상담 기록이 없습니다.
          </CardContent>
        </Card>
      ) : (
        <ol className="space-y-3">
          {sorted.map((c) => (
            <li
              key={c.id}
              className="rounded-md border border-border bg-card p-4 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <Badge variant="outline" className="text-xs">
                  {formatDateTime(c.created_at)}
                </Badge>
                <Link
                  href={`/consultations/${c.id}/edit`}
                  className={buttonVariants({ variant: "ghost", size: "sm" })}
                >
                  <Pencil className="size-3" />
                  수정
                </Link>
              </div>

              {/* 태그 */}
              {c.tags && c.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {c.tags.map((t) => (
                    <Badge
                      key={t}
                      variant="outline"
                      className="text-[11px] bg-muted"
                    >
                      {t}
                    </Badge>
                  ))}
                </div>
              )}

              {/* 한국어 */}
              {c.content_kr && (
                <p className="text-sm whitespace-pre-wrap">{c.content_kr}</p>
              )}

              {/* 베트남어 원문 접이식 */}
              {c.content_vi && (
                <details className="group">
                  <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                    원문 보기 (Tiếng Việt)
                  </summary>
                  <p className="text-sm whitespace-pre-wrap mt-1 pl-3 border-l-2 border-border">
                    {c.content_vi}
                  </p>
                </details>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
