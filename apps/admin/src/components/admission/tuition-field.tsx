"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

export type OtherFee = {
  name: string;
  amount: number;
  notes?: string;
};

export type RefundPolicy = {
  before_semester_start?: string | number | null;
  within_30_days?: string | number | null;
  d31_to_60_days?: string | number | null;
  d61_to_90_days?: string | number | null;
  after_90_days?: string | number | null;
  notes?: string | null;
};

export type Tuition = {
  currency?: string;
  unit?: "per_semester" | "per_year" | "per_program" | "pending";
  disclosure_state?: "disclosed" | "pending_until_acceptance";
  application_fee?: number | null;
  admission_fee?: number | null;
  tuition_per_semester?: number | null;
  tuition_per_year?: number | null;
  tuition_by_faculty?: Record<string, number>;
  dorm_fee?: number | null;
  insurance_per_year?: number | null;
  other_fees?: OtherFee[];
  payment_method?: string;
  refund_policy?: RefundPolicy;
  notes?: string;
};

const UNIT_OPTIONS = [
  { value: "per_semester", label: "학기당" },
  { value: "per_year", label: "연간" },
  { value: "per_program", label: "전체 과정" },
  { value: "pending", label: "미확정" },
] as const;

const DISCLOSURE_OPTIONS = [
  { value: "disclosed", label: "공개됨" },
  { value: "pending_until_acceptance", label: "합격 후 공개" },
] as const;

type FacultyRow = { faculty: string; amount: string };

export function TuitionField({
  name,
  initial,
}: {
  name: string;
  initial: Tuition | null | undefined;
}) {
  const [currency, setCurrency] = useState<string>(initial?.currency ?? "KRW");
  const [unit, setUnit] = useState<Tuition["unit"]>(
    initial?.unit ?? "per_semester"
  );
  const [disclosure, setDisclosure] = useState<Tuition["disclosure_state"]>(
    initial?.disclosure_state ?? "disclosed"
  );
  const [appFee, setAppFee] = useState<string>(
    initial?.application_fee == null ? "" : String(initial.application_fee)
  );
  const [admFee, setAdmFee] = useState<string>(
    initial?.admission_fee == null ? "" : String(initial.admission_fee)
  );
  const [perSem, setPerSem] = useState<string>(
    initial?.tuition_per_semester == null
      ? ""
      : String(initial.tuition_per_semester)
  );
  const [perYear, setPerYear] = useState<string>(
    initial?.tuition_per_year == null ? "" : String(initial.tuition_per_year)
  );
  const [dorm, setDorm] = useState<string>(
    initial?.dorm_fee == null ? "" : String(initial.dorm_fee)
  );
  const [ins, setIns] = useState<string>(
    initial?.insurance_per_year == null
      ? ""
      : String(initial.insurance_per_year)
  );
  const [payMethod, setPayMethod] = useState<string>(
    initial?.payment_method ?? ""
  );
  const [notes, setNotes] = useState<string>(initial?.notes ?? "");

  // 학과별 등록금
  const [byFaculty, setByFaculty] = useState<FacultyRow[]>(
    initial?.tuition_by_faculty
      ? Object.entries(initial.tuition_by_faculty).map(([k, v]) => ({
          faculty: k,
          amount: String(v),
        }))
      : []
  );

  // other_fees
  const [otherFees, setOtherFees] = useState<OtherFee[]>(
    initial?.other_fees ?? []
  );

  // refund_policy
  const [refund, setRefund] = useState<RefundPolicy>(
    initial?.refund_policy ?? {}
  );

  const toNumOrNull = (v: string): number | null => {
    if (v === "" || v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const tuitionByFaculty: Record<string, number> = {};
  for (const r of byFaculty) {
    if (r.faculty.trim() === "") continue;
    const n = Number(r.amount);
    if (Number.isFinite(n)) tuitionByFaculty[r.faculty.trim()] = n;
  }

  const refundNorm: RefundPolicy = {};
  (Object.keys(refund) as Array<keyof RefundPolicy>).forEach((k) => {
    const v = refund[k];
    if (v === null || v === undefined || v === "") return;
    // 숫자 파싱 시도
    if (k === "notes") {
      refundNorm[k] = String(v);
    } else {
      const n = Number(v);
      refundNorm[k] = Number.isFinite(n) && String(v).trim() !== "" ? n : String(v);
    }
  });

  const serialized = JSON.stringify({
    currency,
    unit: unit ?? "per_semester",
    disclosure_state: disclosure ?? "disclosed",
    application_fee: toNumOrNull(appFee),
    admission_fee: toNumOrNull(admFee),
    tuition_per_semester: toNumOrNull(perSem),
    tuition_per_year: toNumOrNull(perYear),
    tuition_by_faculty:
      Object.keys(tuitionByFaculty).length > 0 ? tuitionByFaculty : undefined,
    dorm_fee: toNumOrNull(dorm),
    insurance_per_year: toNumOrNull(ins),
    other_fees:
      otherFees.length > 0
        ? otherFees.map((f) => ({
            name: f.name,
            amount: Number(f.amount) || 0,
            notes: f.notes || undefined,
          }))
        : undefined,
    payment_method: payMethod || undefined,
    refund_policy: Object.keys(refundNorm).length > 0 ? refundNorm : undefined,
    notes: notes || undefined,
  });

  return (
    <div className="space-y-4">
      {/* 기본 */}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <FieldSelect
          label="통화"
          value={currency}
          onChange={setCurrency}
          options={[
            { value: "KRW", label: "원 (KRW)" },
            { value: "USD", label: "달러 (USD)" },
            { value: "VND", label: "동 (VND)" },
          ]}
        />
        <FieldSelect
          label="단위"
          value={unit ?? "per_semester"}
          onChange={(v) => setUnit(v as Tuition["unit"])}
          options={[...UNIT_OPTIONS]}
        />
        <FieldSelect
          label="공개 상태"
          value={disclosure ?? "disclosed"}
          onChange={(v) =>
            setDisclosure(v as Tuition["disclosure_state"])
          }
          options={[...DISCLOSURE_OPTIONS]}
        />
        <FieldNumber
          label="원서비"
          value={appFee}
          onChange={setAppFee}
          placeholder="원"
        />
        <FieldNumber
          label="입학금"
          value={admFee}
          onChange={setAdmFee}
          placeholder="원"
        />
        <FieldNumber
          label="기숙사비 (학기당)"
          value={dorm}
          onChange={setDorm}
          placeholder="원"
        />
        <FieldNumber
          label="등록금 (학기당)"
          value={perSem}
          onChange={setPerSem}
          placeholder="원"
        />
        <FieldNumber
          label="등록금 (연간)"
          value={perYear}
          onChange={setPerYear}
          placeholder="원"
        />
        <FieldNumber
          label="보험료 (연간)"
          value={ins}
          onChange={setIns}
          placeholder="원"
        />
      </div>

      {/* 학과별 등록금 */}
      <div className="space-y-2 rounded-md border bg-muted/20 p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">학과별 등록금 (선택)</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setByFaculty([...byFaculty, { faculty: "", amount: "" }])
            }
          >
            <Plus className="size-4" />
            추가
          </Button>
        </div>
        {byFaculty.length === 0 ? (
          <div className="text-xs text-muted-foreground">
            학과별 등록금이 다르면 추가하세요.
          </div>
        ) : (
          <div className="space-y-1">
            {byFaculty.map((r, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  value={r.faculty}
                  onChange={(e) =>
                    setByFaculty(
                      byFaculty.map((x, i) =>
                        i === idx ? { ...x, faculty: e.target.value } : x
                      )
                    )
                  }
                  placeholder="학과명"
                  className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                />
                <input
                  type="number"
                  value={r.amount}
                  onChange={(e) =>
                    setByFaculty(
                      byFaculty.map((x, i) =>
                        i === idx ? { ...x, amount: e.target.value } : x
                      )
                    )
                  }
                  placeholder="금액 (원)"
                  className="w-40 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setByFaculty(byFaculty.filter((_, i) => i !== idx))
                  }
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 기타 비용 */}
      <div className="space-y-2 rounded-md border bg-muted/20 p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">기타 비용 (선택)</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setOtherFees([...otherFees, { name: "", amount: 0 }])
            }
          >
            <Plus className="size-4" />
            추가
          </Button>
        </div>
        {otherFees.length === 0 ? (
          <div className="text-xs text-muted-foreground">
            픽업비·교재비 등 기타 비용 추가.
          </div>
        ) : (
          <div className="space-y-1">
            {otherFees.map((f, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  value={f.name}
                  onChange={(e) =>
                    setOtherFees(
                      otherFees.map((x, i) =>
                        i === idx ? { ...x, name: e.target.value } : x
                      )
                    )
                  }
                  placeholder="명칭 (예: 픽업비)"
                  className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                />
                <input
                  type="number"
                  value={f.amount}
                  onChange={(e) =>
                    setOtherFees(
                      otherFees.map((x, i) =>
                        i === idx
                          ? { ...x, amount: Number(e.target.value) || 0 }
                          : x
                      )
                    )
                  }
                  placeholder="금액"
                  className="w-32 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                />
                <input
                  type="text"
                  value={f.notes ?? ""}
                  onChange={(e) =>
                    setOtherFees(
                      otherFees.map((x, i) =>
                        i === idx ? { ...x, notes: e.target.value } : x
                      )
                    )
                  }
                  placeholder="메모"
                  className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setOtherFees(otherFees.filter((_, i) => i !== idx))
                  }
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 환불 정책 */}
      <div className="space-y-2 rounded-md border bg-muted/20 p-3">
        <div className="text-sm font-medium">환불 정책 (선택)</div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <FieldText
            label="개강 전"
            value={String(refund.before_semester_start ?? "")}
            onChange={(v) =>
              setRefund({ ...refund, before_semester_start: v })
            }
            placeholder="예: 전액 또는 1.0"
          />
          <FieldText
            label="30일 이내"
            value={String(refund.within_30_days ?? "")}
            onChange={(v) => setRefund({ ...refund, within_30_days: v })}
            placeholder="예: 5/6 또는 0.833"
          />
          <FieldText
            label="31-60일"
            value={String(refund.d31_to_60_days ?? "")}
            onChange={(v) => setRefund({ ...refund, d31_to_60_days: v })}
          />
          <FieldText
            label="61-90일"
            value={String(refund.d61_to_90_days ?? "")}
            onChange={(v) => setRefund({ ...refund, d61_to_90_days: v })}
          />
          <FieldText
            label="90일 이후"
            value={String(refund.after_90_days ?? "")}
            onChange={(v) => setRefund({ ...refund, after_90_days: v })}
          />
          <FieldText
            label="환불 메모"
            value={String(refund.notes ?? "")}
            onChange={(v) => setRefund({ ...refund, notes: v })}
          />
        </div>
      </div>

      {/* 결제·메모 */}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <FieldText
          label="결제 방법"
          value={payMethod}
          onChange={setPayMethod}
          placeholder="예: 계좌이체"
        />
        <FieldText
          label="등록금 메모"
          value={notes}
          onChange={setNotes}
          placeholder="추가 안내"
        />
      </div>

      <input type="hidden" name={name} value={serialized} />
    </div>
  );
}

function FieldText({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">
        {label}
        {required ? <span className="text-destructive">*</span> : null}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
      />
    </label>
  );
}

function FieldNumber({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
      />
    </label>
  );
}

function FieldSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
