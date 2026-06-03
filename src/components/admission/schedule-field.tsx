"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

export type AdmissionRound = {
  name: string;
  application_open?: string | null;
  application_close?: string | null;
  application_close_time?: string;
  document_submission_close?: string | null;
  interview?: string | null;
  interview_period?: [string, string];
  result_announcement?: string | null;
  payment_period?: [string, string];
  visa_certificate_issuance?: [string, string];
};

export type Schedule = {
  rounds: AdmissionRound[];
  main_enrollment_period?: [string, string];
  additional_enrollment_period?: [string, string];
  orientation?: string | null;
  semester_start?: string | null;
  semester_end?: string | null;
  submission_method?: string;
};

const emptyRound = (): AdmissionRound => ({
  name: "",
  application_open: null,
  application_close: null,
  application_close_time: "",
  document_submission_close: null,
  interview: null,
  result_announcement: null,
});

const normalizeDate = (v: string | null | undefined): string | null => {
  if (!v || v === "") return null;
  return v;
};

const normalizeRange = (
  v: [string, string] | undefined
): [string, string] | undefined => {
  if (!v) return undefined;
  if (!v[0] && !v[1]) return undefined;
  return v;
};

export function ScheduleField({
  name,
  initial,
}: {
  name: string;
  initial: Schedule | null | undefined;
}) {
  const [rounds, setRounds] = useState<AdmissionRound[]>(
    initial?.rounds ?? []
  );
  const [mainEnroll, setMainEnroll] = useState<[string, string] | undefined>(
    initial?.main_enrollment_period
  );
  const [addEnroll, setAddEnroll] = useState<[string, string] | undefined>(
    initial?.additional_enrollment_period
  );
  const [orientation, setOrientation] = useState<string>(
    initial?.orientation ?? ""
  );
  const [semStart, setSemStart] = useState<string>(initial?.semester_start ?? "");
  const [semEnd, setSemEnd] = useState<string>(initial?.semester_end ?? "");
  const [subMethod, setSubMethod] = useState<string>(
    initial?.submission_method ?? ""
  );

  const addRound = () => setRounds([...rounds, emptyRound()]);
  const removeRound = (idx: number) =>
    setRounds(rounds.filter((_, i) => i !== idx));
  const updateRound = <K extends keyof AdmissionRound>(
    idx: number,
    field: K,
    value: AdmissionRound[K]
  ) =>
    setRounds(rounds.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));

  const serialized = JSON.stringify({
    rounds: rounds.map((r) => ({
      name: r.name,
      application_open: normalizeDate(r.application_open),
      application_close: normalizeDate(r.application_close),
      application_close_time: r.application_close_time || undefined,
      document_submission_close: normalizeDate(r.document_submission_close),
      interview: normalizeDate(r.interview),
      interview_period: normalizeRange(r.interview_period),
      result_announcement: normalizeDate(r.result_announcement),
      payment_period: normalizeRange(r.payment_period),
      visa_certificate_issuance: normalizeRange(r.visa_certificate_issuance),
    })),
    main_enrollment_period: normalizeRange(mainEnroll),
    additional_enrollment_period: normalizeRange(addEnroll),
    orientation: normalizeDate(orientation),
    semester_start: normalizeDate(semStart),
    semester_end: normalizeDate(semEnd),
    submission_method: subMethod || undefined,
  });

  return (
    <div className="space-y-4">
      {/* 라운드 */}
      <div className="space-y-2">
        <div className="text-sm font-medium">모집 라운드</div>
        {rounds.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            등록된 라운드가 없습니다.
          </div>
        ) : (
          <div className="space-y-2">
            {rounds.map((r, idx) => (
              <div key={idx} className="rounded-md border bg-background p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    라운드 #{idx + 1}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeRound(idx)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                  <FieldText
                    label="라운드명"
                    value={r.name}
                    onChange={(v) => updateRound(idx, "name", v)}
                    placeholder="예: 1차"
                    required
                  />
                  <FieldDate
                    label="원서 접수 시작"
                    value={r.application_open ?? ""}
                    onChange={(v) =>
                      updateRound(idx, "application_open", v || null)
                    }
                  />
                  <FieldDate
                    label="원서 접수 마감"
                    value={r.application_close ?? ""}
                    onChange={(v) =>
                      updateRound(idx, "application_close", v || null)
                    }
                  />
                  <FieldText
                    label="마감 시간"
                    value={r.application_close_time ?? ""}
                    onChange={(v) =>
                      updateRound(idx, "application_close_time", v)
                    }
                    placeholder="예: 17:00"
                  />
                  <FieldDate
                    label="서류 제출 마감"
                    value={r.document_submission_close ?? ""}
                    onChange={(v) =>
                      updateRound(idx, "document_submission_close", v || null)
                    }
                  />
                  <FieldDate
                    label="면접"
                    value={r.interview ?? ""}
                    onChange={(v) => updateRound(idx, "interview", v || null)}
                  />
                  <FieldDate
                    label="합격 발표"
                    value={r.result_announcement ?? ""}
                    onChange={(v) =>
                      updateRound(idx, "result_announcement", v || null)
                    }
                  />
                  <FieldDateRange
                    label="등록금 납부 기간"
                    value={r.payment_period}
                    onChange={(v) => updateRound(idx, "payment_period", v)}
                  />
                  <FieldDateRange
                    label="비자 발급 기간"
                    value={r.visa_certificate_issuance}
                    onChange={(v) =>
                      updateRound(idx, "visa_certificate_issuance", v)
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        )}
        <Button type="button" variant="outline" size="sm" onClick={addRound}>
          <Plus className="size-4" />
          라운드 추가
        </Button>
      </div>

      {/* 학기 일정 */}
      <div className="space-y-2 rounded-md border bg-muted/20 p-3">
        <div className="text-sm font-medium">학기·등록 일정</div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <FieldDate
            label="학기 시작"
            value={semStart}
            onChange={setSemStart}
          />
          <FieldDate label="학기 종료" value={semEnd} onChange={setSemEnd} />
          <FieldDate
            label="오리엔테이션"
            value={orientation}
            onChange={setOrientation}
          />
          <FieldText
            label="제출 방식"
            value={subMethod}
            onChange={setSubMethod}
            placeholder="예: 우편 / 방문 / 온라인"
          />
          <FieldDateRange
            label="본 등록 기간"
            value={mainEnroll}
            onChange={setMainEnroll}
          />
          <FieldDateRange
            label="추가 등록 기간"
            value={addEnroll}
            onChange={setAddEnroll}
          />
        </div>
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

function FieldDate({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
      />
    </label>
  );
}

function FieldDateRange({
  label,
  value,
  onChange,
}: {
  label: string;
  value: [string, string] | undefined;
  onChange: (v: [string, string] | undefined) => void;
}) {
  const start = value?.[0] ?? "";
  const end = value?.[1] ?? "";
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">
        <input
          type="date"
          value={start}
          onChange={(e) => {
            const v = e.target.value;
            if (!v && !end) onChange(undefined);
            else onChange([v, end]);
          }}
          className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
        />
        <span className="text-xs text-muted-foreground">~</span>
        <input
          type="date"
          value={end}
          onChange={(e) => {
            const v = e.target.value;
            if (!start && !v) onChange(undefined);
            else onChange([start, v]);
          }}
          className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
        />
      </div>
    </label>
  );
}
