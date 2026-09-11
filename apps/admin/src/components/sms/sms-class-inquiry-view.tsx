"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Search, Send } from "lucide-react";

import {
  sendClassInquirySms,
  notifyClassInquiryBulkDone,
} from "@/app/(app)/sms/actions";
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
  lastClassIso: string | null;
  lastClassLabel: string | null;
};

export function SmsClassInquiryView({ centers }: { centers: CenterRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState<CenterRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // 일괄 발송 진행 상태 — null 이면 대기
  const [bulk, setBulk] = useState<{
    done: number;
    total: number;
    name: string;
  } | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return centers;
    return centers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.region ?? "").toLowerCase().includes(q)
    );
  }, [centers, query]);

  const phoneOf = (c: CenterRow) =>
    pickCenterSmsPhone(c)?.phone ?? c.phone?.trim() ?? "";

  const selectableIds = useMemo(
    () => filtered.filter((c) => phoneOf(c)).map((c) => c.id),
    [filtered]
  );
  const allChecked =
    selectableIds.length > 0 &&
    selectableIds.every((id) => selectedIds.includes(id));

  function toggleAll() {
    setSelectedIds(allChecked ? [] : selectableIds);
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function runBulk() {
    const targets = centers.filter(
      (c) => selectedIds.includes(c.id) && phoneOf(c)
    );
    if (targets.length === 0) return;
    if (
      !confirm(
        `선택한 ${targets.length}곳에 강의 정보 문의 문자를 순차 발송할까요?\n문구는 교육원마다 5종 중 랜덤으로 선택됩니다.`
      )
    )
      return;

    const failed: string[] = [];
    for (let i = 0; i < targets.length; i++) {
      const c = targets[i];
      setBulk({ done: i, total: targets.length, name: c.name });
      const r = await sendClassInquirySms({
        centerId: c.id,
        selfNotify: false,
      });
      if (!r.ok) failed.push(`${c.name} — ${r.error}`);
    }
    setBulk({ done: targets.length, total: targets.length, name: "" });

    // 건별 노티 대신 요약 셀프 알림 1건
    await notifyClassInquiryBulkDone({
      total: targets.length,
      failed: failed.length,
    }).catch(() => {});

    setBulk(null);
    setSelectedIds([]);
    if (failed.length > 0) {
      toast.error(
        `${targets.length}곳 중 ${failed.length}곳 발송 실패`,
        { description: failed.slice(0, 5).join("\n"), duration: 10000 }
      );
    } else {
      toast.success(`${targets.length}곳에 강의 문의를 발송했습니다.`);
    }
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative max-w-sm flex-1 min-w-52">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="교육원 이름 / 지역 검색"
              className="pl-8"
              disabled={!!bulk}
            />
          </div>
          <div className="flex items-center gap-3">
            {bulk ? (
              <span className="text-sm text-muted-foreground">
                <Loader2 className="mr-1 inline size-3 animate-spin" />
                {bulk.done}/{bulk.total} 발송 중
                {bulk.name ? ` — ${bulk.name}` : ""}
              </span>
            ) : (
              selectedIds.length > 0 && (
                <span className="text-sm text-muted-foreground">
                  {selectedIds.length}곳 선택됨
                </span>
              )
            )}
            <Button
              type="button"
              size="sm"
              onClick={runBulk}
              disabled={selectedIds.length === 0 || !!bulk}
            >
              <Send className="size-3" />
              일괄 발송 ({selectedIds.length})
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={toggleAll}
                    disabled={!!bulk || selectableIds.length === 0}
                    aria-label="전체 선택"
                  />
                </TableHead>
                <TableHead>교육원</TableHead>
                <TableHead>지역</TableHead>
                <TableHead>마지막 강의</TableHead>
                <TableHead>수신 번호</TableHead>
                <TableHead>최근 문의 발송</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
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
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(c.id)}
                          onChange={() => toggleOne(c.id)}
                          disabled={!!bulk || !phone.trim()}
                          aria-label={`${c.name} 선택`}
                        />
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {c.name}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {c.region ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {c.lastClassLabel ?? (
                          <span className="text-warning">등록된 강의 없음</span>
                        )}
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
                            disabled={!!bulk}
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

        <p className="text-xs text-muted-foreground">
          마지막 강의가 오래된(또는 없는) 교육원이 위에 옵니다. 일괄 발송은
          한 곳씩 순차 전송되며, 발송 이력과 최근 문의 발송 시각은 교육원별로
          개별 기록됩니다.
        </p>

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
