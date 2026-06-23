"use client";

import { useState } from "react";
import { Eye, X, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type SmsHistoryRow = {
  id: string;
  sentAt: string;
  type: string;
  target: string;
  content: string;
  recipients: string[];
};

export function SmsHistoryView({ rows }: { rows: SmsHistoryRow[] }) {
  const [open, setOpen] = useState<SmsHistoryRow | null>(null);

  return (
    <>
      <div className="overflow-hidden rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-40">발송일시</TableHead>
              <TableHead className="w-36">타입</TableHead>
              <TableHead>대상</TableHead>
              <TableHead className="w-44 text-right">본문</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="text-sm">{m.sentAt}</TableCell>
                <TableCell>
                  <Badge variant="outline">{m.type}</Badge>
                </TableCell>
                <TableCell className="text-sm">{m.target}</TableCell>
                <TableCell className="text-right">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setOpen(m)}
                  >
                    <Eye className="size-3.5" />
                    본문 보기
                    {m.recipients.length > 0 ? (
                      <Badge variant="secondary" className="ml-1">
                        {m.recipients.length}명
                      </Badge>
                    ) : null}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(null)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-foreground">
                  {open.target}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {open.sentAt} · {open.type}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(null)}
                className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="닫기"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {open.recipients.length > 0 ? (
                <div>
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Users className="size-3.5" />
                    수신 학생 {open.recipients.length}명
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {open.recipients.map((r, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {r}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}

              <div>
                <div className="mb-1.5 text-xs font-medium text-muted-foreground">
                  발송 본문
                </div>
                <div className="whitespace-pre-wrap break-words rounded-md border border-border bg-muted/30 p-3 text-sm leading-relaxed">
                  {open.content}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
