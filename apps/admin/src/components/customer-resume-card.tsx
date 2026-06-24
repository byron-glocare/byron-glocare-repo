"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Check,
  Copy,
  Download,
  FileText,
  Link2,
  Loader2,
  RotateCcw,
  Sparkles,
} from "lucide-react";

import {
  createResumeDraft,
  regenerateResumePolish,
} from "@/app/(app)/customers/resume-actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { resumeDraftDataSchema } from "@/lib/validators";
import type { Customer, Json } from "@/types/database";

type Props = {
  customerId: string;
  productType: Customer["product_type"];
  draft: {
    id: string;
    token: string;
    expires_at: string;
    submitted_at: string | null;
    data: Json;
    photo_path: string | null;
  } | null;
};

export function CustomerResumeCard({ customerId, productType, draft }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  const isWelcomePackTarget =
    productType === "웰컴팩" || productType === "교육+웰컴팩";

  if (!isWelcomePackTarget) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="size-4" />
            이력서 작성
          </CardTitle>
          <CardDescription>
            상품에 웰컴팩 포함된 교육생만 사용 — 현재 상품 '
            {productType ?? "없음"}'
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const link = draft
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/r/${draft.token}`
    : null;
  const expired = draft
    ? new Date(draft.expires_at).getTime() < Date.now()
    : false;
  const submitted = !!draft?.submitted_at;

  function handleCreate() {
    startTransition(async () => {
      const r = await createResumeDraft(customerId);
      if (r.ok) {
        toast.success("이력서 작성 링크가 생성되었습니다. (7일 유효)");
        router.refresh();
      } else {
        toast.error("생성 실패", { description: r.error });
      }
    });
  }

  function handleCopy() {
    if (!link) return;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      toast.success("링크 복사됨");
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleDownload() {
    window.open(`/api/customers/${customerId}/resume`, "_blank");
  }

  function handleRepolish() {
    if (!draft) return;
    startTransition(async () => {
      const r = await regenerateResumePolish(customerId, draft.id);
      if (r.ok) {
        toast.success("AI 다듬기 재실행 완료");
        router.refresh();
      } else {
        toast.error("재다듬기 실패", { description: r.error });
      }
    });
  }

  // submitted 시 narrative 미리보기 (polished, 없으면 raw)
  const parsedData = draft?.data
    ? resumeDraftDataSchema.safeParse(draft.data)
    : null;
  const narrativePolished =
    parsedData?.success ? parsedData.data.narrative_polished : "";
  const narrativeRaw =
    parsedData?.success ? parsedData.data.narrative_raw : "";
  const narrativeForPreview = narrativePolished || narrativeRaw;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="size-4" />
          이력서 작성
        </CardTitle>
        <CardDescription>
          학생에게 작성 링크 전달 → 학생이 입력 → docx 다운로드
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* 상태 표시 */}
        <div className="flex items-center gap-2 text-sm">
          {!draft ? (
            <Badge
              variant="outline"
              className="text-muted-foreground border-border"
            >
              링크 없음
            </Badge>
          ) : submitted ? (
            <Badge className="bg-success/10 text-success border-success/20">
              <Check className="size-3" />
              제출 완료 (
              {draft.submitted_at
                ? formatDate(draft.submitted_at.slice(0, 10))
                : "—"}
              )
            </Badge>
          ) : expired ? (
            <Badge className="bg-destructive/10 text-destructive border-destructive/20">
              만료됨 (재발급 필요)
            </Badge>
          ) : (
            <Badge className="bg-info/10 text-info border-info/20">
              <Link2 className="size-3" />
              입력 대기 (만료 {formatDate(draft.expires_at.slice(0, 10))})
            </Badge>
          )}
        </div>

        {/* 링크 영역 */}
        {draft && !submitted && !expired && link && (
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={link}
              className="flex-1 h-9 rounded-md border border-input bg-muted/40 px-3 text-xs font-mono"
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="size-4" />
              ) : (
                <Copy className="size-4" />
              )}
              {copied ? "복사됨" : "복사"}
            </Button>
          </div>
        )}

        {/* 액션 버튼 */}
        <div className="flex flex-wrap gap-2">
          {(!draft || expired) && (
            <Button
              type="button"
              size="sm"
              onClick={handleCreate}
              disabled={pending}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Link2 className="size-4" />
              )}
              {draft ? "링크 재발급 (7일)" : "정보 요청 링크 생성 (7일)"}
            </Button>
          )}
          {draft && !submitted && !expired && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleCreate}
              disabled={pending}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RotateCcw className="size-4" />
              )}
              만료일 7일 연장 (토큰 재발급)
            </Button>
          )}
          {submitted && (
            <>
              <Button type="button" size="sm" onClick={handleDownload}>
                <Download className="size-4" />
                이력서 다운로드 (.docx)
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleRepolish}
                disabled={pending}
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                AI 다듬기 재실행
              </Button>
            </>
          )}
        </div>

        {/* 제출된 narrative 미리보기 */}
        {submitted && narrativeForPreview && (
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              자기소개 본문 미리보기 ({narrativePolished ? "AI 다듬기 후" : "원본"})
            </summary>
            <pre className="mt-2 whitespace-pre-wrap font-sans text-foreground bg-muted/40 rounded-md p-3 max-h-60 overflow-y-auto">
              {narrativeForPreview}
            </pre>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
