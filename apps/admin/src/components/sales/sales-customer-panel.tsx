"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft, Loader2, Plus } from "lucide-react";

import {
  setSalesIntakeDecision,
  addSalesConsultation,
} from "@/lib/sales/actions";
import type { IntakeDecision } from "@/lib/sales/types";
import type { ConsultationType } from "@/types/database";

export type SalesCustomerInfo = {
  id: string;
  name_vi: string | null;
  name_kr: string | null;
  phone: string | null;
  desired_region: string | null;
  birth_year: number | null;
  visa_type: string | null;
};

export type SalesConsultation = {
  id: string;
  consultation_type: ConsultationType;
  content_kr: string | null;
  content_vi: string | null;
  created_at: string;
};

const DECISIONS: { key: IntakeDecision; label: string }[] = [
  { key: "yes", label: "등록 예" },
  { key: "persuade", label: "설득 중" },
  { key: "no", label: "등록 아니오" },
  { key: "none", label: "미선택" },
];

export function SalesCustomerPanel({
  customer,
  decision,
  consultations,
}: {
  customer: SalesCustomerInfo;
  decision: IntakeDecision;
  consultations: SalesConsultation[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState<ConsultationType>("training_center");
  const [content, setContent] = useState("");

  const name =
    [customer.name_vi, customer.name_kr].filter(Boolean).join(" / ") ||
    "(이름 없음)";
  const age = customer.birth_year
    ? `${new Date().getFullYear() - customer.birth_year}세`
    : null;

  function pickDecision(d: IntakeDecision) {
    if (d === decision || pending) return;
    startTransition(async () => {
      const r = await setSalesIntakeDecision(customer.id, d);
      if (r.ok) {
        toast.success("등록 상태가 변경되었습니다.");
        router.refresh();
      } else {
        toast.error("변경 실패", { description: r.error });
      }
    });
  }

  function saveConsultation() {
    if (!content.trim()) {
      toast.error("상담 내용을 입력하세요.");
      return;
    }
    startTransition(async () => {
      const r = await addSalesConsultation(customer.id, type, content);
      if (r.ok) {
        toast.success("상담일지가 저장되었습니다.");
        setContent("");
        router.refresh();
      } else {
        toast.error("저장 실패", { description: r.error });
      }
    });
  }

  return (
    <div className="space-y-5">
      <Link
        href="/sales"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        뒤로
      </Link>

      {/* 고객 정보 */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="text-base font-semibold">{name}</div>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {customer.phone && <span>{customer.phone}</span>}
          {customer.desired_region && <span>{customer.desired_region}</span>}
          {age && <span>{age}</span>}
          {customer.visa_type && <span>{customer.visa_type}</span>}
        </div>
      </div>

      {/* 등록 결정 */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">등록 결정</h2>
        <div className="grid grid-cols-2 gap-2">
          {DECISIONS.map((d) => {
            const active = d.key === decision;
            return (
              <button
                key={d.key}
                type="button"
                onClick={() => pickDecision(d.key)}
                disabled={pending}
                className={`rounded-lg border py-3 text-sm font-medium transition-colors disabled:opacity-60 ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground"
                }`}
              >
                {d.label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          &ldquo;설득 중&rdquo;은 진행 단계에 영향을 주지 않습니다(미선택과 동일).
        </p>
      </section>

      {/* 상담일지 입력 */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">상담일지 작성</h2>
        <div className="flex gap-2">
          <TypeChip label="교육원 상담" active={type === "training_center"} onClick={() => setType("training_center")} />
          <TypeChip label="요양원 상담" active={type === "care_home"} onClick={() => setType("care_home")} />
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          placeholder="통화·상담 내용을 기록하세요"
          disabled={pending}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={saveConsultation}
          disabled={pending || !content.trim()}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          상담일지 저장
        </button>
      </section>

      {/* 상담 이력 */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">상담 이력 ({consultations.length})</h2>
        {consultations.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            상담 기록이 없습니다.
          </div>
        ) : (
          <ul className="space-y-2">
            {consultations.map((c) => (
              <li key={c.id} className="rounded-lg border border-border bg-card p-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {c.consultation_type === "care_home" ? "요양원 상담" : "교육원 상담"}
                  </span>
                  <span>{c.created_at.slice(0, 10)}</span>
                </div>
                <div className="mt-1 whitespace-pre-wrap text-sm">
                  {c.content_kr || c.content_vi || "—"}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function TypeChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium ${
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground"
      }`}
    >
      {label}
    </button>
  );
}
