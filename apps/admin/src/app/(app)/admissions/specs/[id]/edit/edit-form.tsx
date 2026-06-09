"use client";

import { useActionState, useMemo, useState } from "react";
import { Check, Loader2 } from "lucide-react";

import { updateSpecAction, type UpdateSpecState } from "./update-action";
import { Card } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DepartmentsField,
  type Department,
} from "@/components/admission/departments-field";
import {
  RequiredDocumentsField,
  type RequiredDocument,
} from "@/components/admission/required-documents-field";
import {
  ScholarshipsField,
  type Scholarship,
} from "@/components/admission/scholarships-field";
import {
  ScheduleField,
  type Schedule,
} from "@/components/admission/schedule-field";
import {
  TuitionField,
  type Tuition,
} from "@/components/admission/tuition-field";
import {
  EligibilityField,
  type Eligibility,
} from "@/components/admission/eligibility-field";
import {
  MetadataField,
  type Metadata,
} from "@/components/admission/metadata-field";

const PROGRAM_TYPE_OPTIONS = [
  { value: "language_program", label: "어학연수 (D-4)" },
  { value: "associate_2yr", label: "전문학사 2년" },
  { value: "bachelor_3yr_extension", label: "전공심화 (2+2)" },
  { value: "bachelor_4yr", label: "학사 4년" },
] as const;

const STATUS_OPTIONS = [
  { value: "draft", label: "초안" },
  { value: "reviewing", label: "검수 중" },
  { value: "approved", label: "승인" },
  { value: "archived", label: "보관" },
] as const;

const TERM_OPTIONS = [
  "2026-Spring",
  "2026-Summer",
  "2026-Fall",
  "2026-Winter",
  "2026-Year",
  "2027-Spring",
  "2027-Fall",
];

export type UniversityOption = { id: number; name_ko: string };

export type EditableSpec = {
  id: string;
  university_id: number;
  term: string;
  admission_category: string | null;
  program_type: string;
  status: string;
  source_file_url: string | null;
  is_online_submission: boolean;
  online_form_url: string | null;
  online_guide_url: string | null;
  departments: unknown;
  required_documents: unknown;
  eligibility: unknown;
  schedule: unknown;
  tuition: unknown;
  scholarships: unknown;
  metadata: unknown;
};

export function EditSpecForm({
  spec,
  universities,
}: {
  spec: EditableSpec;
  universities: UniversityOption[];
}) {
  const bound = updateSpecAction.bind(null, spec.id);
  const [state, action, pending] = useActionState<UpdateSpecState, FormData>(
    bound,
    undefined
  );

  // 온라인 접수
  const [isOnline, setIsOnline] = useState(spec.is_online_submission);
  const [guide, setGuide] = useState<{
    base64: string;
    name: string;
    type: string;
  } | null>(null);
  const [guideReading, setGuideReading] = useState(false);

  async function onPickGuide(file: File) {
    setGuideReading(true);
    try {
      const dataUrl: string = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.onerror = () => rej(r.error);
        r.readAsDataURL(file);
      });
      const comma = dataUrl.indexOf(",");
      setGuide({
        base64: comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl,
        name: file.name,
        type: file.type || "application/octet-stream",
      });
    } finally {
      setGuideReading(false);
    }
  }

  const initialDepartments: Department[] = useMemo(
    () => (Array.isArray(spec.departments) ? (spec.departments as Department[]) : []),
    [spec.departments]
  );
  const initialDocuments: RequiredDocument[] = useMemo(
    () =>
      Array.isArray(spec.required_documents)
        ? (spec.required_documents as RequiredDocument[])
        : [],
    [spec.required_documents]
  );
  const initialScholarships: Scholarship[] = useMemo(
    () =>
      Array.isArray(spec.scholarships)
        ? (spec.scholarships as Scholarship[])
        : [],
    [spec.scholarships]
  );
  const initialSchedule = useMemo(
    () =>
      spec.schedule && typeof spec.schedule === "object"
        ? (spec.schedule as Schedule)
        : null,
    [spec.schedule]
  );
  const initialTuition = useMemo(
    () =>
      spec.tuition && typeof spec.tuition === "object"
        ? (spec.tuition as Tuition)
        : null,
    [spec.tuition]
  );
  const initialEligibility = useMemo(
    () =>
      spec.eligibility && typeof spec.eligibility === "object"
        ? (spec.eligibility as Eligibility)
        : null,
    [spec.eligibility]
  );
  const initialMetadata = useMemo(
    () =>
      spec.metadata && typeof spec.metadata === "object"
        ? (spec.metadata as Metadata)
        : null,
    [spec.metadata]
  );

  const fieldErr = (k: string) => state?.fieldErrors?.[k];

  return (
    <Card className="p-6 space-y-5">
      <form
        action={(fd: FormData) => {
          if (isOnline && guide) {
            fd.set("guide_base64", guide.base64);
            fd.set("guide_name", guide.name);
            fd.set("guide_type", guide.type);
          }
          action(fd);
        }}
        className="space-y-5"
      >
        {/* 메타 */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="대학교" name="university_id" error={fieldErr("university_id")}>
            <select
              name="university_id"
              required
              defaultValue={spec.university_id}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {universities.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name_ko}
                </option>
              ))}
            </select>
          </Field>

          <Field label="학기" name="term" error={fieldErr("term")}>
            <select
              name="term"
              required
              defaultValue={spec.term}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {TERM_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>

          <Field label="과정" name="program_type" error={fieldErr("program_type")}>
            <select
              name="program_type"
              required
              defaultValue={spec.program_type}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {PROGRAM_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="상태" name="status" error={fieldErr("status")}>
            <select
              name="status"
              required
              defaultValue={spec.status}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="전형 카테고리 (내부)"
            name="admission_category"
            error={fieldErr("admission_category")}
            full
          >
            <input
              type="text"
              name="admission_category"
              defaultValue={spec.admission_category ?? ""}
              maxLength={200}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </Field>

          <Field
            label="원본 파일 경로"
            name="source_file_url"
            error={fieldErr("source_file_url")}
            full
          >
            <input
              type="text"
              name="source_file_url"
              defaultValue={spec.source_file_url ?? ""}
              maxLength={500}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </Field>
        </div>

        {/* 온라인 접수 */}
        <div className="rounded-md border border-sky-200 bg-sky-50/60 p-4">
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              name="is_online_submission"
              className="mt-0.5"
              checked={isOnline}
              onChange={(e) => setIsOnline(e.target.checked)}
            />
            <span className="text-sm">
              <strong>온라인 접수 대학</strong> — 학생 화면에서 양식 작성 대신
              가이드 문서 + 제출서류만 안내됩니다.
            </span>
          </label>

          {isOnline ? (
            <div className="mt-3 grid grid-cols-1 gap-3 border-t border-sky-200 pt-3 md:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">온라인 접수 폼 주소</span>
                <input
                  type="url"
                  name="online_form_url"
                  defaultValue={spec.online_form_url ?? ""}
                  placeholder="https://..."
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">
                  원서접수 가이드 문서
                </span>
                {spec.online_guide_url ? (
                  <a
                    href={spec.online_guide_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-sky-700 underline"
                  >
                    현재 가이드 열기 ↗
                  </a>
                ) : null}
                <input
                  type="file"
                  accept=".pdf,.hwp,.hwpx,.docx,image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onPickGuide(f);
                  }}
                  className="text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-secondary file:px-3 file:py-1.5 file:text-sm"
                />
                <span className="text-xs text-muted-foreground">
                  {guideReading
                    ? "파일 읽는 중..."
                    : guide
                      ? `새 파일: ${guide.name} (저장 시 교체)`
                      : "새 파일을 올리면 교체됩니다. 비워두면 기존 유지."}
                </span>
              </label>
            </div>
          ) : null}
        </div>

        {/* 학과 */}
        <Section
          title={`학과 (${initialDepartments.length})`}
          open
          error={fieldErr("spec_departments")}
        >
          <DepartmentsField
            name="spec_departments"
            initial={initialDepartments}
          />
        </Section>

        {/* 제출 서류 */}
        <Section
          title={`제출 서류 (${initialDocuments.length})`}
          error={fieldErr("spec_required_documents")}
        >
          <RequiredDocumentsField
            name="spec_required_documents"
            initial={initialDocuments}
          />
        </Section>

        {/* 지원 자격 */}
        <Section title="지원 자격" error={fieldErr("spec_eligibility")}>
          <EligibilityField
            name="spec_eligibility"
            initial={initialEligibility}
          />
        </Section>

        {/* 모집 일정 */}
        <Section title="모집 일정" error={fieldErr("spec_schedule")}>
          <ScheduleField name="spec_schedule" initial={initialSchedule} />
        </Section>

        {/* 등록금 */}
        <Section title="등록금" error={fieldErr("spec_tuition")}>
          <TuitionField name="spec_tuition" initial={initialTuition} />
        </Section>

        {/* 장학금 */}
        <Section
          title={`장학금 (${initialScholarships.length})`}
          error={fieldErr("spec_scholarships")}
        >
          <ScholarshipsField
            name="spec_scholarships"
            initial={initialScholarships}
          />
        </Section>

        {/* 메타 */}
        <Section title="기타 정보 (선발·연락처·정부지정 등)" error={fieldErr("spec_metadata")}>
          <MetadataField name="spec_metadata" initial={initialMetadata} />
        </Section>

        {state?.error ? (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.error}
          </div>
        ) : null}

        <div className="flex items-center gap-2 border-t border-border pt-4">
          <Button type="submit" disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                저장 중...
              </>
            ) : (
              <>
                <Check className="size-4" />
                저장
              </>
            )}
          </Button>
          <a
            href={`/admissions/specs/${spec.id}`}
            className={buttonVariants({ variant: "outline" })}
          >
            취소
          </a>
        </div>
      </form>
    </Card>
  );
}

function Section({
  title,
  open,
  error,
  children,
}: {
  title: string;
  open?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <details open={open} className="rounded-md border border-input bg-muted/30">
      <summary className="cursor-pointer px-4 py-2 text-sm font-medium hover:bg-muted/50">
        {title}
      </summary>
      <div className="border-t border-input p-3">
        {children}
        {error ? (
          <div className="mt-2 text-xs text-destructive">{error}</div>
        ) : null}
      </div>
    </details>
  );
}

function Field({
  label,
  name,
  error,
  full,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${full ? "md:col-span-2" : ""}`}>
      <span className="text-sm font-medium" data-name={name}>
        {label}
      </span>
      {children}
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </label>
  );
}
