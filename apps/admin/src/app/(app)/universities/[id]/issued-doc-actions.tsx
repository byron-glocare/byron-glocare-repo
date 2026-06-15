"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { linkSharedSubmissionAction } from "@/app/(app)/admissions/[universityId]/submissions-actions";

/**
 * U2: 대학 상세 발급서류 표의 "관리" 셀.
 *   - university: 등록된 대학별 발급서류 편집
 *   - shared    : 공용 표준 보기 + "이 대학에 연결(대학별 조정)"
 *   - unmatched : 신규 등록(서류명 프리필)
 */
export function IssuedDocActions({
  kind,
  universityId,
  submissionId,
  masterId,
  docName,
}: {
  kind: "university" | "shared" | "unmatched";
  universityId: number;
  submissionId: string | null;
  masterId: string | null;
  docName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [linking, setLinking] = useState(false);

  if (kind === "university" && submissionId) {
    return (
      <Link
        href={`/admissions/submissions/${submissionId}`}
        className="text-xs text-primary hover:underline"
      >
        편집 →
      </Link>
    );
  }

  if (kind === "shared" && masterId) {
    return (
      <div className="flex flex-col items-center gap-1">
        <button
          type="button"
          disabled={linking}
          onClick={() => {
            setLinking(true);
            startTransition(async () => {
              const res = await linkSharedSubmissionAction(universityId, masterId);
              if (res.ok && res.id) {
                toast.success("이 대학에 연결했습니다. 세부조건을 조정하세요.");
                router.push(`/admissions/submissions/${res.id}`);
              } else {
                toast.error("연결 실패", { description: res.error });
                setLinking(false);
              }
            });
          }}
          className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
        >
          {linking || pending ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="size-3 animate-spin" />
              연결 중…
            </span>
          ) : (
            "대학별 조정 →"
          )}
        </button>
        <Link
          href={`/admissions/submissions/${masterId}`}
          className="text-[11px] text-muted-foreground hover:underline"
        >
          공용 보기
        </Link>
      </div>
    );
  }

  // unmatched
  return (
    <Link
      href={`/admissions/submissions/new?uni=${universityId}&name=${encodeURIComponent(docName)}`}
      className="text-xs text-primary hover:underline"
    >
      발급서류 등록 →
    </Link>
  );
}
