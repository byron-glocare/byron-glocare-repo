"use client";

/** 모집요강 PDF 도구줄 — 학과·학기 선택(URL 갱신) + 인쇄(PDF 저장). 인쇄 시 숨김. */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ArrowLeft, Loader2, Printer } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";

type Option = { value: string; label: string };

const selectClass = "rounded-md border border-input bg-background px-2 py-1.5 text-sm";

export function BrochureToolbar({
  specId,
  dept,
  term,
  deptOptions,
  termOptions,
  pageCount,
}: {
  specId: string;
  dept: string;
  term: string | null;
  deptOptions: Option[];
  termOptions: Option[];
  pageCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const go = (next: { dept?: string; term?: string }) => {
    const qs = new URLSearchParams();
    const d = next.dept ?? dept;
    const t = next.term ?? term ?? "";
    if (d && d !== "all") qs.set("dept", d);
    if (t) qs.set("term", t);
    const s = qs.toString();
    startTransition(() => router.replace(`/admissions/specs/${specId}/brochure${s ? `?${s}` : ""}`));
  };

  return (
    <div className="flex flex-wrap items-end gap-3 border-b border-border bg-card px-6 py-4 print:hidden">
      <Link href={`/admissions/specs/${specId}/edit?tab=departments`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
        <ArrowLeft className="size-4" />
        요강 편집
      </Link>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">학과</span>
        <select className={selectClass} value={dept} onChange={(e) => go({ dept: e.target.value })} disabled={pending}>
          {deptOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">학기</span>
        <select className={selectClass} value={term ?? ""} onChange={(e) => go({ term: e.target.value })} disabled={pending || termOptions.length === 0}>
          {termOptions.length === 0 ? <option value="">학기 없음</option> : null}
          {termOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>
      {pending ? <Loader2 className="mb-2 size-4 animate-spin text-muted-foreground" /> : null}
      <div className="ml-auto flex items-center gap-3">
        <span className="text-xs text-muted-foreground">
          {pageCount}개 학과 · 인쇄 창에서 대상 &quot;PDF로 저장&quot;, 용지 A4, 배경 그래픽 켜기
        </span>
        <Button type="button" onClick={() => window.print()} disabled={pageCount === 0}>
          <Printer className="size-4" />
          PDF로 저장 (인쇄)
        </Button>
      </div>
    </div>
  );
}
