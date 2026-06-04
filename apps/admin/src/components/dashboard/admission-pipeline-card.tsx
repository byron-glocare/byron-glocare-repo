import Link from "next/link";
import { ClipboardList } from "lucide-react";

import { Card } from "@/components/ui/card";

export type AdmissionPipeline = {
  draft: number;
  reviewing: number;
  approved: number;
  archived: number;
};

const STATUS_META = [
  { key: "draft", label: "초안", color: "bg-slate-400" },
  { key: "reviewing", label: "검수 중", color: "bg-amber-500" },
  { key: "approved", label: "승인", color: "bg-emerald-500" },
  { key: "archived", label: "보관", color: "bg-slate-300" },
] as const;

export function AdmissionPipelineCard({
  pipeline,
}: {
  pipeline: AdmissionPipeline;
}) {
  const total =
    pipeline.draft + pipeline.reviewing + pipeline.approved + pipeline.archived;

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <ClipboardList className="size-3.5" />
          모집요강 파이프라인
        </div>
        <Link
          href="/admissions"
          className="text-[10px] text-primary hover:underline"
        >
          전체 보기 →
        </Link>
      </div>

      {total === 0 ? (
        <p className="text-xs text-muted-foreground">등록된 모집요강 없음</p>
      ) : (
        <>
          {/* 진행률 바 */}
          <div className="mb-3 flex h-2 overflow-hidden rounded-full bg-muted">
            {STATUS_META.map((s) => {
              const v = pipeline[s.key];
              if (v === 0) return null;
              return (
                <div
                  key={s.key}
                  className={s.color}
                  style={{ width: `${(v / total) * 100}%` }}
                  title={`${s.label}: ${v}`}
                />
              );
            })}
          </div>

          <dl className="grid grid-cols-2 gap-2 text-sm">
            {STATUS_META.map((s) => (
              <div key={s.key} className="flex items-center justify-between">
                <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className={`size-2 rounded-full ${s.color}`} />
                  {s.label}
                </dt>
                <dd className="font-semibold">{pipeline[s.key]}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-2 border-t pt-2 text-[10px] text-muted-foreground">
            총 {total}건 · 승인률{" "}
            {total > 0 ? Math.round((pipeline.approved / total) * 100) : 0}%
          </div>
        </>
      )}
    </Card>
  );
}
