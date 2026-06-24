"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
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

  // submitted 시 학생 입력 전체 미리보기
  const parsedData = draft?.data
    ? resumeDraftDataSchema.safeParse(draft.data)
    : null;
  const studentData = parsedData?.success ? parsedData.data : null;
  const hasPhoto = !!draft?.photo_path;

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

        {/* 링크 영역 — submitted/expired 무관 항상 표시 (admin 도 수정 가능) */}
        {draft && link && (
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
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 h-9 px-3 rounded-md border border-input bg-background text-xs font-medium hover:bg-muted/30"
              title="관리자 모드로 학생 폼을 열어 직접 수정할 수 있습니다."
            >
              <ExternalLink className="size-4" />
              관리자 수정
            </a>
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
                title="학생이 쓴 원본 텍스트로 AI 가 다시 한국어 자기소개 본문을 작성합니다."
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                자기소개 다시 다듬기 (AI)
              </Button>
            </>
          )}
        </div>

        {/* 사진 표시 */}
        {submitted && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">사진:</span>
            {hasPhoto ? (
              <Badge className="bg-success/10 text-success border-success/20">
                <Check className="size-3" />
                업로드됨
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                없음
              </Badge>
            )}
          </div>
        )}

        {/* 학생 입력 전체 미리보기 */}
        {submitted && studentData && (
          <details className="text-xs" open>
            <summary className="cursor-pointer font-medium text-foreground hover:text-primary">
              학생 입력 내용 보기
            </summary>
            <div className="mt-2 space-y-3 bg-muted/40 rounded-md p-3">
              <PreviewSection title="개인 정보">
                <PreviewRow label="이름 (베)" value={studentData.name_vi} />
                <PreviewRow label="이름 (한)" value={studentData.name_kr} />
                <PreviewRow label="생년월일" value={studentData.birth_date} />
                <PreviewRow label="전화" value={studentData.phone} />
                <PreviewRow label="이메일" value={studentData.email} />
                <PreviewRow label="주소" value={studentData.address} />
                <PreviewRow label="한 줄 자기소개" value={studentData.one_liner} />
              </PreviewSection>

              {studentData.educations.length > 0 && (
                <PreviewList
                  title={`학력 (${studentData.educations.length})`}
                  rows={studentData.educations.map((e) => ({
                    head: `${e.school || "—"} · ${e.major || "—"}`,
                    sub: `${e.start_year || "?"} ~ ${e.end_year || "?"} · ${e.status || "—"}`,
                  }))}
                />
              )}
              {studentData.careers.length > 0 && (
                <PreviewList
                  title={`경력 (${studentData.careers.length})`}
                  rows={studentData.careers.map((c) => ({
                    head: `${c.workplace || "—"} · ${c.role || "—"}`,
                    sub: `${c.period || "—"} · ${c.status || "—"}`,
                    detail: c.detail,
                  }))}
                />
              )}
              {studentData.certifications.length > 0 && (
                <PreviewList
                  title={`자격증 (${studentData.certifications.length})`}
                  rows={studentData.certifications.map((c) => ({
                    head: c.name || "—",
                    sub: `${c.date || "—"} · ${c.detail || "—"}`,
                  }))}
                />
              )}
              {studentData.skills.length > 0 && (
                <PreviewList
                  title={`기술·어학 (${studentData.skills.length})`}
                  rows={studentData.skills.map((s) => ({
                    head: s.name || "—",
                    sub: `${s.detail || "—"} · ${s.level || "—"}`,
                  }))}
                />
              )}
              {studentData.activities.length > 0 && (
                <PreviewList
                  title={`기타 활동 (${studentData.activities.length})`}
                  rows={studentData.activities.map((a) => ({
                    head: a.name || "—",
                    sub: a.period,
                    detail: a.detail,
                  }))}
                />
              )}

              {studentData.narrative_polished && (
                <PreviewSection title="자기소개 본문 (AI 다듬기 후 — docx 에 들어가는 텍스트)">
                  <pre className="whitespace-pre-wrap font-sans text-foreground bg-background rounded-md p-3 max-h-60 overflow-y-auto border border-border">
                    {studentData.narrative_polished}
                  </pre>
                </PreviewSection>
              )}
              {studentData.narrative_raw && (
                <PreviewSection title="자기소개 본문 (학생 원본)">
                  <pre className="whitespace-pre-wrap font-sans text-muted-foreground bg-background rounded-md p-3 max-h-40 overflow-y-auto border border-border">
                    {studentData.narrative_raw}
                  </pre>
                </PreviewSection>
              )}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

// =============================================================================
// 미리보기 sub-components
// =============================================================================

function PreviewSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
        {title}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function PreviewRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground w-24 shrink-0">{label}</span>
      <span className="text-foreground">{value || "—"}</span>
    </div>
  );
}

function PreviewList({
  title,
  rows,
}: {
  title: string;
  rows: { head: string; sub?: string; detail?: string }[];
}) {
  return (
    <PreviewSection title={title}>
      <ul className="space-y-1.5">
        {rows.map((r, i) => (
          <li
            key={i}
            className="border-l-2 border-border pl-2 space-y-0.5"
          >
            <div className="text-foreground font-medium">{r.head}</div>
            {r.sub && <div className="text-muted-foreground">{r.sub}</div>}
            {r.detail && (
              <div className="text-muted-foreground whitespace-pre-wrap">
                {r.detail}
              </div>
            )}
          </li>
        ))}
      </ul>
    </PreviewSection>
  );
}
