/**
 * 고객 리스트 서버 컴포넌트. /customers 페이지뿐 아니라
 * 교육원/요양원 상세의 "소속 교육생" 탭에 embed 된다.
 *
 * 고정 필터 (교육원 상세면 training_center_id, 요양원 상세면 care_home_id) 는
 * props 로 주입 — 해당 드롭다운 UI 는 자동으로 숨겨짐.
 */

import Link from "next/link";
import { Search } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import {
  computeCustomerStatus,
  type StageSummary,
} from "@/lib/customer-status";

const PAGE_SIZE = 50;

const STAGE_ORDER_MAP: Record<StageSummary["currentStage"], number> = {
  접수중: 1,
  접수완료_대기: 2,
  교육예약중: 3,
  교육중: 4,
  취업중: 5,
  근무중: 6,
  근무종료: 7,
  대기중: 8,
  종료: 9,
};

export type CustomerListFilters = {
  q?: string;
  stage?: string;
  center?: string;
  care?: string;
  page?: string;
};

export type CustomerListProps = {
  /** 검색 파라미터 (원본 searchParams 그대로 전달) */
  filters: CustomerListFilters;
  /** 폼 제출/리셋 시 이동할 base URL (예: "/customers", "/training-centers/abc") */
  basePath: string;
  /** 다른 non-list 쿼리 파라미터 (예: {tab: "students"}) — 폼 hidden 로 유지 */
  preservedParams?: Record<string, string>;
  /** 고정 필터. 주입된 필드는 드롭다운 UI 자동 숨김. */
  fixed?: {
    trainingCenterId?: string;
    careHomeId?: string;
  };
  /** 요약 스트립 표시 여부 (기본 true) */
  showSummary?: boolean;
};

export async function CustomerListPanel({
  filters,
  basePath,
  preservedParams = {},
  fixed,
  showSummary = true,
}: CustomerListProps) {
  const q = filters.q?.trim() ?? "";
  const centerFilter = fixed?.trainingCenterId ?? filters.center?.trim() ?? "";
  const careFilter = fixed?.careHomeId ?? filters.care?.trim() ?? "";
  const stageFilter = filters.stage?.trim() ?? "";
  const page = Math.max(1, parseInt(filters.page ?? "1", 10) || 1);

  const supabase = await createClient();

  let query = supabase
    .from("customers")
    .select(
      `
      id, code, name_vi, name_kr, phone, birth_year, visa_type,
      training_center_id, training_class_id, care_home_id,
      is_waiting, recontact_date, waiting_memo,
      termination_reason, legacy_status, product_type,
      desired_region, updated_at, created_at,
      class_start_date, class_end_date,
      work_start_date, work_end_date, visa_change_date, interview_date,
      address, gender
      `
    )
    .order("created_at", { ascending: false });

  if (q) {
    const safeQ = q.replace(/[,()]/g, " ").trim();
    if (safeQ) {
      query = query.or(
        `code.ilike.%${safeQ}%,name_kr.ilike.%${safeQ}%,name_vi.ilike.%${safeQ}%,phone.ilike.%${safeQ}%`
      );
    }
  }
  if (centerFilter) query = query.eq("training_center_id", centerFilter);
  if (careFilter) query = query.eq("care_home_id", careFilter);

  const { data: allMatched, error } = await query;

  const [{ data: centers }, { data: homes }, { data: statuses }] =
    await Promise.all([
      supabase.from("training_centers").select("id, name, region"),
      supabase.from("care_homes").select("id, name, region"),
      supabase.from("customer_statuses").select("*"),
    ]);

  const centerMap = new Map((centers ?? []).map((c) => [c.id, c]));
  const homeMap = new Map((homes ?? []).map((h) => [h.id, h]));
  const statusMap = new Map((statuses ?? []).map((s) => [s.customer_id, s]));

  const withStage = (allMatched ?? []).map((c) => {
    const status = statusMap.get(c.id);
    const summary = status
      ? computeCustomerStatus({
          customer: c,
          status,
          reservationPayments: [],
          welcomePackPayment: null,
          smsMessages: [],
        })
      : null;
    return { customer: c, summary };
  });

  const uniqueLabels = new Map<string, StageSummary["currentStage"]>();
  for (const x of withStage) {
    if (x.summary && !uniqueLabels.has(x.summary.label)) {
      uniqueLabels.set(x.summary.label, x.summary.currentStage);
    }
  }
  const labelOptions = Array.from(uniqueLabels.entries())
    .sort((a, b) => {
      const diff = STAGE_ORDER_MAP[a[1]] - STAGE_ORDER_MAP[b[1]];
      return diff !== 0 ? diff : a[0].localeCompare(b[0], "ko");
    })
    .map(([label]) => label);

  const filtered = stageFilter
    ? withStage.filter((x) => x.summary?.label === stageFilter)
    : withStage;

  const count = filtered.length;
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const pageStart = (page - 1) * PAGE_SIZE;
  const pageEnd = pageStart + PAGE_SIZE;
  const customers = filtered.slice(pageStart, pageEnd);

  const hiddenCenter = !!fixed?.trainingCenterId;
  const hiddenCare = !!fixed?.careHomeId;

  const hasAnyUserFilter = !!(
    q ||
    stageFilter ||
    (filters.center && !hiddenCenter) ||
    (filters.care && !hiddenCare)
  );

  // URL 유지 파라미터 (tab 같은 외부 컨텍스트) — 폼 / 페이지 링크에 preserved
  function buildUrl(extra: Record<string, string>): string {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(preservedParams)) {
      if (v) params.set(k, v);
    }
    for (const [k, v] of Object.entries(extra)) {
      if (v) params.set(k, v);
    }
    const s = params.toString();
    return s ? `${basePath}?${s}` : basePath;
  }

  return (
    <div className="space-y-4">
      {/* 검색 + 필터 */}
      <form method="get" action={basePath} className="flex flex-wrap gap-2 items-end">
        {/* preservedParams 를 hidden 으로 유지 */}
        {Object.entries(preservedParams).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <div className="flex-1 min-w-60">
          <label className="text-xs text-muted-foreground block mb-1">
            검색 (코드 · 이름 · 전화)
          </label>
          <div className="relative">
            <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              name="q"
              defaultValue={q}
              placeholder="CVN2508 / 팜 / 010..."
              className="pl-8"
            />
          </div>
        </div>
        {!hiddenCenter && (
          <div>
            <label className="text-xs text-muted-foreground block mb-1">
              교육원
            </label>
            <select
              name="center"
              defaultValue={filters.center ?? ""}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm min-w-40"
            >
              <option value="">전체</option>
              {(centers ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {!hiddenCare && (
          <div>
            <label className="text-xs text-muted-foreground block mb-1">
              요양원
            </label>
            <select
              name="care"
              defaultValue={filters.care ?? ""}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm min-w-40"
            >
              <option value="">전체</option>
              {(homes ?? []).map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="text-xs text-muted-foreground block mb-1">
            현재 단계
          </label>
          <select
            name="stage"
            defaultValue={stageFilter}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm min-w-44"
          >
            <option value="">전체</option>
            {stageFilter && !labelOptions.includes(stageFilter) && (
              <option value={stageFilter}>{stageFilter}</option>
            )}
            {labelOptions.map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className={buttonVariants()}>
          적용
        </button>
        {hasAnyUserFilter && (
          <Link
            href={buildUrl({})}
            className={buttonVariants({ variant: "ghost" })}
          >
            초기화
          </Link>
        )}
      </form>

      {showSummary && (
        <div className="text-xs text-muted-foreground">
          전체 {count}명
        </div>
      )}

      {error ? (
        <Card className="p-6 text-sm text-destructive">
          데이터를 불러오지 못했습니다: {error.message}
        </Card>
      ) : !customers || customers.length === 0 ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">
          {hasAnyUserFilter
            ? "조건에 맞는 고객이 없습니다."
            : "등록된 고객이 없습니다."}
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
                    <TableHead className="w-40">현재 단계</TableHead>
                    <TableHead className="w-16">나이</TableHead>
                    <TableHead className="w-36">전화</TableHead>
                    <TableHead className="w-20">비자</TableHead>
                    <TableHead className="w-24">지역</TableHead>
                    <TableHead className="w-40">교육원</TableHead>
                    <TableHead className="w-40">요양원</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map(({ customer: c, summary }) => {
                    const center = c.training_center_id
                      ? centerMap.get(c.training_center_id)
                      : null;
                    const home = c.care_home_id
                      ? homeMap.get(c.care_home_id)
                      : null;
                    const age = c.birth_year
                      ? new Date().getFullYear() - c.birth_year
                      : null;
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">
                          <Link
                            href={`/customers/${c.id}`}
                            className="hover:text-primary"
                          >
                            {dash(c.name_vi)}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Link href={`/customers/${c.id}`} className="block">
                            {dash(c.name_kr)}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Link href={`/customers/${c.id}`} className="block">
                            {summary && (
                              <StageBadge
                                stage={summary.currentStage}
                                label={summary.label}
                              />
                            )}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Link href={`/customers/${c.id}`} className="block">
                            {age ?? "—"}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Link href={`/customers/${c.id}`} className="block">
                            {dash(c.phone)}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Link href={`/customers/${c.id}`} className="block">
                            {dash(c.visa_type)}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Link href={`/customers/${c.id}`} className="block">
                            {dash(c.desired_region)}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm">
                          <Link href={`/customers/${c.id}`} className="block">
                            {center ? center.name : "—"}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm">
                          <Link href={`/customers/${c.id}`} className="block">
                            {home ? home.name : "—"}
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <PageLink
                href={buildUrl({
                  q,
                  stage: stageFilter,
                  ...(hiddenCenter ? {} : { center: filters.center ?? "" }),
                  ...(hiddenCare ? {} : { care: filters.care ?? "" }),
                  page: String(page - 1),
                })}
                disabled={page === 1}
              >
                이전
              </PageLink>
              <span className="text-sm text-muted-foreground">
                {page} / {totalPages}
              </span>
              <PageLink
                href={buildUrl({
                  q,
                  stage: stageFilter,
                  ...(hiddenCenter ? {} : { center: filters.center ?? "" }),
                  ...(hiddenCare ? {} : { care: filters.care ?? "" }),
                  page: String(page + 1),
                })}
                disabled={page >= totalPages}
              >
                다음
              </PageLink>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StageBadge({
  stage,
  label,
}: {
  stage: StageSummary["currentStage"];
  label: string;
}) {
  const cls =
    stage === "종료"
      ? "bg-destructive/10 text-destructive border-destructive/20"
      : stage === "대기중"
        ? "bg-warning/10 text-warning border-warning/20"
        : stage === "근무종료"
          ? "bg-muted text-muted-foreground border-border"
          : stage === "근무중" || stage === "취업중"
            ? "bg-success/10 text-success border-success/20"
            : "bg-info/10 text-info border-info/20";
  const text = stage === "종료" || stage === "대기중" ? stage : label;
  return (
    <Badge variant="outline" className={cls}>
      {text}
    </Badge>
  );
}

function PageLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className={buttonVariants({ variant: "outline", size: "sm" })}>
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className={buttonVariants({ variant: "outline", size: "sm" })}
    >
      {children}
    </Link>
  );
}
