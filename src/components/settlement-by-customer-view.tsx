"use client";

/**
 * 정산 > 교육생별 정산 탭. 모든 교육생을 한 표에 나열, 각 정산 상태
 * (예약금 / 소개비 / 이벤트 / 웰컴팩) 를 한 눈에. 검색 + 단계 / 정산 상태 필터.
 *
 * 값은 server (page.tsx) 가 computeSettlementSummary 로 미리 계산해서 전달.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { dash } from "@/lib/format";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;

type SettlementFlag = "완료" | "미완료" | "대상아님";

export type ByCustomerRow = {
  id: string;
  code: string;
  name_vi: string | null;
  name_kr: string | null;
  stageLabel: string;
  stageKey: string;
  centerName: string | null;
  careHomeName: string | null;
  reservation: SettlementFlag;
  commission: SettlementFlag;
  event: SettlementFlag;
  welcomePack: SettlementFlag;
};

type Props = {
  rows: ByCustomerRow[];
};

const STAGE_KEYS = [
  "접수중",
  "교육예약중",
  "교육중",
  "취업중",
  "근무중",
  "근무종료",
  "대기중",
  "종료",
] as const;

const FLAG_FIELDS: {
  key: "reservation" | "commission" | "event" | "welcomePack";
  label: string;
}[] = [
  { key: "commission", label: "소개비" },
  { key: "event", label: "이벤트" },
  { key: "welcomePack", label: "웰컴팩" },
];

export function SettlementByCustomerView({ rows }: Props) {
  const [q, setQ] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [commissionFilter, setCommissionFilter] = useState<string>("all");
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [welcomePackFilter, setWelcomePackFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (needle) {
        const hay = [r.name_vi, r.name_kr, r.code]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (stageFilter !== "all" && r.stageKey !== stageFilter) return false;
      if (commissionFilter !== "all" && r.commission !== commissionFilter)
        return false;
      if (eventFilter !== "all" && r.event !== eventFilter) return false;
      if (welcomePackFilter !== "all" && r.welcomePack !== welcomePackFilter)
        return false;
      return true;
    });
  }, [
    rows,
    q,
    stageFilter,
    commissionFilter,
    eventFilter,
    welcomePackFilter,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  function resetFilters() {
    setQ("");
    setStageFilter("all");
    setCommissionFilter("all");
    setEventFilter("all");
    setWelcomePackFilter("all");
    setPage(1);
  }

  const hasAnyFilter =
    !!q ||
    stageFilter !== "all" ||
    commissionFilter !== "all" ||
    eventFilter !== "all" ||
    welcomePackFilter !== "all";

  return (
    <div className="space-y-4">
      {/* 검색 + 필터 */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-60">
          <label className="text-xs text-muted-foreground block mb-1">
            검색 (이름 · 코드)
          </label>
          <div className="relative">
            <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="이름 / CVN..."
              className="pl-8"
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">
            현재 단계
          </label>
          <select
            value={stageFilter}
            onChange={(e) => {
              setStageFilter(e.target.value);
              setPage(1);
            }}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm min-w-32"
          >
            <option value="all">전체</option>
            {STAGE_KEYS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <FilterSelect
          label="소개비"
          value={commissionFilter}
          onChange={(v) => {
            setCommissionFilter(v);
            setPage(1);
          }}
        />
        <FilterSelect
          label="이벤트"
          value={eventFilter}
          onChange={(v) => {
            setEventFilter(v);
            setPage(1);
          }}
        />
        <FilterSelect
          label="웰컴팩"
          value={welcomePackFilter}
          onChange={(v) => {
            setWelcomePackFilter(v);
            setPage(1);
          }}
        />
        {hasAnyFilter && (
          <button
            type="button"
            onClick={resetFilters}
            className={buttonVariants({ variant: "ghost" })}
          >
            초기화
          </button>
        )}
      </div>

      <div className="text-xs text-muted-foreground">
        전체 {filtered.length}명 (rows {rows.length}명 중)
      </div>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center text-sm text-muted-foreground space-y-2">
          <div>
            {hasAnyFilter
              ? "조건에 맞는 교육생이 없습니다."
              : "등록된 교육생이 없습니다."}
          </div>
          <div className="text-[11px] text-muted-foreground/70">
            (server 전달 row {rows.length}건 · 필터 후 {filtered.length}건)
          </div>
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">베트남 이름</TableHead>
                    <TableHead className="w-28">한국 이름</TableHead>
                    <TableHead className="w-36">현재 단계</TableHead>
                    <TableHead className="w-40">교육원</TableHead>
                    <TableHead className="w-40">요양원</TableHead>
                    <TableHead className="w-24 text-center">
                      소개비 정산
                    </TableHead>
                    <TableHead className="w-24 text-center">
                      이벤트 정산
                    </TableHead>
                    <TableHead className="w-24 text-center">
                      웰컴팩 정산
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/customers/${r.id}`}
                          className="hover:text-primary"
                        >
                          {dash(r.name_vi)}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/customers/${r.id}`}
                          className="block"
                        >
                          {dash(r.name_kr)}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/customers/${r.id}`}
                          className="block"
                        >
                          <StageBadge
                            stageKey={r.stageKey}
                            label={r.stageLabel}
                          />
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.centerName ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.careHomeName ?? "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <FlagBadge flag={r.commission} />
                      </TableCell>
                      <TableCell className="text-center">
                        <FlagBadge flag={r.event} />
                      </TableCell>
                      <TableCell className="text-center">
                        <FlagBadge flag={r.welcomePack} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                이전
              </button>
              <span className="text-sm text-muted-foreground">
                {safePage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                다음
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground block mb-1">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 rounded-md border border-input bg-background px-2 text-sm min-w-24"
      >
        <option value="all">전체</option>
        <option value="완료">완료</option>
        <option value="미완료">미완료</option>
        <option value="대상아님">대상아님</option>
      </select>
    </div>
  );
}

function FlagBadge({ flag }: { flag: SettlementFlag }) {
  const cls =
    flag === "완료"
      ? "bg-success/10 text-success border-success/20"
      : flag === "미완료"
        ? "bg-warning/10 text-warning border-warning/20"
        : "bg-muted text-muted-foreground border-border";
  return (
    <Badge variant="outline" className={cls}>
      {flag}
    </Badge>
  );
}

function StageBadge({
  stageKey,
  label,
}: {
  stageKey: string;
  label: string;
}) {
  const cls =
    stageKey === "종료"
      ? "bg-destructive/10 text-destructive border-destructive/20"
      : stageKey === "대기중"
        ? "bg-warning/10 text-warning border-warning/20"
        : stageKey === "근무종료"
          ? "bg-muted text-muted-foreground border-border"
          : stageKey === "근무중" || stageKey === "취업중"
            ? "bg-success/10 text-success border-success/20"
            : "bg-info/10 text-info border-info/20";
  const text = stageKey === "종료" || stageKey === "대기중" ? stageKey : label;
  return (
    <Badge variant="outline" className={cn(cls, "text-xs")}>
      {text}
    </Badge>
  );
}
