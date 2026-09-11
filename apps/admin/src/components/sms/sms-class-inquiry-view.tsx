"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Send } from "lucide-react";

import {
  ClassInquiryDialog,
  type InquiryCenter,
} from "@/components/sms/class-inquiry-dialog";
import { pickCenterSmsPhone, SMS_RECIPIENT_LABEL } from "@/lib/sms-recipient";
import { formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type CenterRow = InquiryCenter & {
  region: string | null;
  lastSentAt: string | null;
};

export function SmsClassInquiryView({ centers }: { centers: CenterRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState<CenterRow | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return centers;
    return centers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.region ?? "").toLowerCase().includes(q)
    );
  }, [centers, query]);

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="교육원 이름 / 지역 검색"
            className="pl-8"
          />
        </div>

        <div className="overflow-hidden rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>교육원</TableHead>
                <TableHead>지역</TableHead>
                <TableHead>수신 번호</TableHead>
                <TableHead>최근 문의 발송</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    검색 결과가 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((c) => {
                  const selected = pickCenterSmsPhone(c);
                  const phone = selected?.phone ?? c.phone ?? "";
                  const label = selected
                    ? SMS_RECIPIENT_LABEL[selected.source]
                    : "대표 연락처";
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="text-sm font-medium">
                        {c.name}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {c.region ?? "—"}
                      </TableCell>
                      <TableCell>
                        {phone ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-mono">{phone}</span>
                            <Badge variant="outline" className="text-xs">
                              {label}
                            </Badge>
                          </div>
                        ) : (
                          <span className="text-sm text-destructive">
                            번호 없음
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {c.lastSentAt ? formatDateTime(c.lastSentAt) : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setTarget(c)}
                          >
                            <Send className="size-3" />
                            발송
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {target && (
          <ClassInquiryDialog
            center={target}
            open={!!target}
            onOpenChange={(open) => {
              if (!open) setTarget(null);
            }}
            onSent={() => router.refresh()}
          />
        )}
      </CardContent>
    </Card>
  );
}
