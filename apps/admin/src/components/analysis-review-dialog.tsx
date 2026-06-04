"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Loader2, Sparkles, X } from "lucide-react";

import { applyAnalysisSuggestions } from "@/app/(app)/customers/actions";
import type { ConsultationAnalysis } from "@/lib/consultation-tags";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// =============================================================================
// 필드 라벨 매핑
// =============================================================================

const CUSTOMER_LABELS: Record<string, string> = {
  topik_level: "TOPIK 급수",
  visa_type: "비자",
  desired_region: "희망 지역",
  desired_period: "희망 시기",
  desired_time: "희망 시간대",
  birth_year: "출생년도",
};

const FLAG_LABELS: Record<string, string> = {
  intake_abandoned: "접수포기",
  study_abroad_consultation: "유학상담으로 전환",
  training_center_finding: "교육원 발굴 필요",
  class_schedule_confirmation_needed: "강의 일정 확인 필요",
  training_reservation_abandoned: "교육 예약포기",
  certificate_acquired: "자격증 취득",
  training_dropped: "교육 드랍",
  welcome_pack_abandoned: "웰컴팩 예약포기",
  care_home_finding: "요양원 발굴 필요",
  resume_sent: "이력서 발송",
  interview_passed: "면접 합격",
};

// 민감도 높은 (직접 검토 필요) 플래그 — 기본 OFF
const SENSITIVE_FLAGS = new Set([
  "intake_abandoned",
  "study_abroad_consultation",
  "training_reservation_abandoned",
  "training_dropped",
  "welcome_pack_abandoned",
]);

// =============================================================================
// Dialog
// =============================================================================

type Props = {
  open: boolean;
  customerId: string;
  analysis: ConsultationAnalysis;
  onClose: (applied: boolean) => void;
};

export function AnalysisReviewDialog({
  open,
  customerId,
  analysis,
  onClose,
}: Props) {
  const [pending, startTransition] = useTransition();

  // 각 제안 항목별 체크 상태 초기화
  // null/undefined/빈 값인 제안은 제거 (Claude 가 필드만 반환하고 값을 비워둔 경우)
  const customerKeys = (
    Object.keys(
      analysis.suggestions.customer
    ) as (keyof ConsultationAnalysis["suggestions"]["customer"])[]
  ).filter((k) => {
    const v = analysis.suggestions.customer[k];
    return v !== null && v !== undefined && v !== "";
  });
  const flagKeys = (
    Object.keys(
      analysis.suggestions.status_flags
    ) as (keyof ConsultationAnalysis["suggestions"]["status_flags"])[]
  ).filter((k) => {
    const v = analysis.suggestions.status_flags[k];
    return v !== null && v !== undefined;
  });

  const initialChecks = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const k of customerKeys) map[`c:${k}`] = true;
    for (const k of flagKeys) {
      // 민감한 종료 플래그는 기본 OFF (사용자 재확인 강제)
      map[`f:${k}`] = !SENSITIVE_FLAGS.has(k);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis]);

  const [checks, setChecks] = useState<Record<string, boolean>>(initialChecks);

  const checkedCount = Object.values(checks).filter(Boolean).length;

  function handleApply() {
    const selectedCustomer: Record<string, unknown> = {};
    for (const k of customerKeys) {
      if (checks[`c:${k}`]) {
        selectedCustomer[k] = analysis.suggestions.customer[k];
      }
    }
    const selectedFlags: Record<string, unknown> = {};
    for (const k of flagKeys) {
      if (checks[`f:${k}`]) {
        selectedFlags[k] = analysis.suggestions.status_flags[k];
      }
    }

    startTransition(async () => {
      const result = await applyAnalysisSuggestions(customerId, {
        customer:
          selectedCustomer as ConsultationAnalysis["suggestions"]["customer"],
        status_flags:
          selectedFlags as ConsultationAnalysis["suggestions"]["status_flags"],
      });
      if (!result.ok) {
        toast.error("적용 실패", { description: result.error });
        return;
      }
      onClose(true);
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose(false)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            AI 분석 결과 검토
          </DialogTitle>
          <DialogDescription>
            상담 내용에서 추출된 변경사항. 체크된 항목만 고객 정보/진행 단계에
            반영됩니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {/* 단계 요약 */}
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1.5">
              이 상담이 다루는 단계
            </div>
            <div className="flex flex-wrap gap-1.5">
              {analysis.stages.map((s) => (
                <Badge
                  key={s}
                  variant="outline"
                  className="bg-info/10 text-info border-info/20"
                >
                  {s}
                </Badge>
              ))}
            </div>
          </div>

          {/* 태그 */}
          {analysis.tags.length > 0 && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1.5">
                추출된 태그 (상담 일지에 자동 저장됨)
              </div>
              <div className="flex flex-wrap gap-1">
                {analysis.tags.map((t) => (
                  <Badge
                    key={t}
                    variant="outline"
                    className="text-xs bg-muted"
                  >
                    {t}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* 고객 정보 제안 */}
          {customerKeys.length > 0 && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-2">
                고객 기본 정보 업데이트 제안
              </div>
              <ul className="space-y-1.5">
                {customerKeys.map((k) => {
                  const value = analysis.suggestions.customer[k];
                  return (
                    <SuggestionRow
                      key={`c:${k}`}
                      label={CUSTOMER_LABELS[k] ?? k}
                      valueDisplay={String(value ?? "—")}
                      checked={checks[`c:${k}`] ?? false}
                      onChange={(v) =>
                        setChecks((s) => ({ ...s, [`c:${k}`]: v }))
                      }
                    />
                  );
                })}
              </ul>
            </div>
          )}

          {/* 플래그 제안 */}
          {flagKeys.length > 0 && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-2">
                진행 단계 플래그 업데이트 제안
              </div>
              <ul className="space-y-1.5">
                {flagKeys.map((k) => {
                  const value = analysis.suggestions.status_flags[k];
                  const sensitive = SENSITIVE_FLAGS.has(k);
                  return (
                    <SuggestionRow
                      key={`f:${k}`}
                      label={FLAG_LABELS[k] ?? k}
                      valueDisplay={
                        value === true ? "ON" : value === false ? "OFF" : "—"
                      }
                      badge={sensitive ? "검토 필요" : undefined}
                      checked={checks[`f:${k}`] ?? false}
                      onChange={(v) =>
                        setChecks((s) => ({ ...s, [`f:${k}`]: v }))
                      }
                    />
                  );
                })}
              </ul>
            </div>
          )}

          {customerKeys.length === 0 && flagKeys.length === 0 && (
            <div className="text-sm text-muted-foreground py-4 text-center">
              상담 내용에서 추출된 업데이트 제안이 없습니다.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onClose(false)}
            disabled={pending}
          >
            <X className="size-4" />
            무시하고 닫기
          </Button>
          <Button
            type="button"
            onClick={handleApply}
            disabled={pending || checkedCount === 0}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            {checkedCount}개 적용
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SuggestionRow({
  label,
  valueDisplay,
  checked,
  onChange,
  badge,
}: {
  label: string;
  valueDisplay: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  badge?: string;
}) {
  return (
    <li
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-md border transition-colors",
        checked
          ? "border-primary/30 bg-primary/5"
          : "border-border bg-background"
      )}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{label}</span>
          {badge && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning/10 text-warning border border-warning/20">
              {badge}
            </span>
          )}
        </div>
        <div className="text-xs text-muted-foreground truncate">
          → {valueDisplay}
        </div>
      </div>
    </li>
  );
}
