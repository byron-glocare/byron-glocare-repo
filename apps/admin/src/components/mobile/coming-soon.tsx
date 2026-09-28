import Link from "next/link";
import { ChevronLeft } from "lucide-react";

/** 모바일 페이지 스텁 — Phase 1/2 에서 실제 화면으로 교체. */
export function ComingSoon({
  title,
  backHref,
}: {
  title: string;
  backHref: string;
}) {
  return (
    <div className="space-y-4">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        뒤로
      </Link>
      <h1 className="text-lg font-semibold">{title}</h1>
      <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        준비 중입니다.
      </div>
    </div>
  );
}
