import { FileSearch, FileText, Sparkles } from "lucide-react";

import { Card } from "@/components/ui/card";

export type AiUsageStats = {
  /** 누적 모집요강 AI 추출 (study_admission_specs.ai_extraction_log IS NOT NULL) */
  specsExtractedCount: number;
  /** 누적 양식 AI 분석 (essay_questions 있는 form_files 수) */
  formsAnalyzedCount: number;
  /** 누적 작문 생성 (study_student_essay_drafts) */
  essaysGeneratedCount: number;
  /** 누적 토큰 사용량 (input + output, 추정치) */
  estimatedTokens: number;
};

const fmtTokens = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
      ? `${(n / 1_000).toFixed(0)}K`
      : n.toString();

export function AiUsageCard({ stats }: { stats: AiUsageStats }) {
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Sparkles className="size-3.5 text-purple-600" />
        AI 사용 누적
      </div>
      <dl className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <FileSearch className="size-3" />
            모집요강 추출
          </dt>
          <dd className="font-semibold">{stats.specsExtractedCount}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <FileText className="size-3" />
            양식 분석
          </dt>
          <dd className="font-semibold">{stats.formsAnalyzedCount}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Sparkles className="size-3" />
            작문 생성
          </dt>
          <dd className="font-semibold">{stats.essaysGeneratedCount}</dd>
        </div>
      </dl>
      <div className="mt-3 border-t pt-2 text-[10px] text-muted-foreground">
        총 토큰: {fmtTokens(stats.estimatedTokens)} ·{" "}
        예상 비용 ≈ ${((stats.estimatedTokens / 1_000_000) * 4).toFixed(2)}
      </div>
    </Card>
  );
}
