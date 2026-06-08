"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Loader2 } from "lucide-react";

import { approveSpecAction, type ApproveSpecState } from "./approve-action";
import { Card } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import type { UniversityOption } from "./extract-form";
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

const TERM_OPTIONS = [
  "2026-Spring",
  "2026-Summer",
  "2026-Fall",
  "2026-Winter",
  "2026-Year",
  "2027-Spring",
  "2027-Fall",
];

export type ExtractedSpec = Record<string, unknown>;
export type ExtractMetaPrefill = {
  universityNameKo: string;
  term: string;
  admissionCategory?: string;
  sourceFileName?: string;
};
export type AiLogPrefill = {
  raw: string;
  confidence: number;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
  prompt_version?: string;
  extracted_at?: string;
};

export function ReviewForm({
  spec,
  meta,
  universities,
  aiLog,
}: {
  spec: ExtractedSpec;
  meta: ExtractMetaPrefill;
  universities: UniversityOption[];
  aiLog?: AiLogPrefill;
}) {
  const [state, action, pending] = useActionState<ApproveSpecState, FormData>(
    approveSpecAction,
    undefined
  );

  // 갱신(덮어쓰기) 확정 플래그 — ref 로 동기 처리(제출 타이밍 안전)
  const formRef = useRef<HTMLFormElement>(null);
  const confirmReplaceRef = useRef(false);

  // university name → id 자동 매핑
  const defaultUniversityId = useMemo(() => {
    const match = universities.find(
      (u) => u.name_ko.trim() === meta.universityNameKo.trim()
    );
    return match?.id ?? "";
  }, [universities, meta.universityNameKo]);

  const getArea = <T,>(key: string): T | null => {
    const v = (spec as Record<string, unknown>)[key];
    return v !== undefined && v !== null ? (v as T) : null;
  };

  const initialDepartments: Department[] = useMemo(() => {
    const v = (spec as Record<string, unknown>).departments;
    return Array.isArray(v) ? (v as Department[]) : [];
  }, [spec]);

  const initialDocuments: RequiredDocument[] = useMemo(() => {
    const v = (spec as Record<string, unknown>).required_documents;
    return Array.isArray(v) ? (v as RequiredDocument[]) : [];
  }, [spec]);

  const initialScholarships: Scholarship[] = useMemo(() => {
    const v = (spec as Record<string, unknown>).scholarships;
    return Array.isArray(v) ? (v as Scholarship[]) : [];
  }, [spec]);

  const initialSchedule = useMemo(() => getArea<Schedule>("schedule"), [spec]);
  const initialTuition = useMemo(() => getArea<Tuition>("tuition"), [spec]);
  const initialEligibility = useMemo(
    () => getArea<Eligibility>("eligibility"),
    [spec]
  );
  const initialMetadata = useMemo(() => getArea<Metadata>("metadata"), [spec]);

  // identity 에서 admission_category 보정
  const identityCategory = useMemo(() => {
    const id = (spec as { identity?: { admission_category?: string | null } })
      .identity;
    return id?.admission_category ?? meta.admissionCategory ?? "";
  }, [spec, meta.admissionCategory]);

  const identityProgramType = useMemo(() => {
    const id = (spec as { identity?: { program_type?: string } }).identity;
    return id?.program_type ?? "";
  }, [spec]);

  const fieldErr = (k: string) => state?.fieldErrors?.[k];

  // 대학 선택: 기존 대학 id 또는 "__new__"(신규 자동 등록)
  const [uniValue, setUniValue] = useState<string>(
    defaultUniversityId === "" ? "" : String(defaultUniversityId)
  );
  const isNewUni = uniValue === "__new__";

  return (
    <Card className="p-6 space-y-5">
      <header>
        <h2 className="text-base font-semibold">검수 + 승인</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          각 영역을 직접 편집할 수 있습니다. 승인 시 status=&apos;approved&apos; 로
          study_admission_specs 에 저장 + 유학센터 어드민에서 조회 가능.
        </p>
      </header>

      <form
        ref={formRef}
        action={(fd: FormData) => {
          fd.set("confirm_replace", confirmReplaceRef.current ? "true" : "");
          action(fd);
        }}
        className="space-y-5"
      >
        {/* row 컬럼 (메타) */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="대학" name="university_id" error={fieldErr("university_id")}>
            <select
              value={uniValue}
              onChange={(e) => setUniValue(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">— 선택 —</option>
              {universities.map((u) => (
                <option key={u.id} value={String(u.id)}>
                  {u.name_ko}
                </option>
              ))}
              <option value="__new__">+ 목록에 없는 신규 대학 (자동 등록)</option>
            </select>
            {/* 기존 대학 선택 시에만 university_id 전송 */}
            {!isNewUni ? (
              <input type="hidden" name="university_id" value={uniValue} />
            ) : null}
            {isNewUni ? (
              <div className="mt-1.5 space-y-1">
                <input
                  type="text"
                  name="new_university_name_ko"
                  required
                  maxLength={200}
                  defaultValue={meta.universityNameKo}
                  placeholder="신규 대학명 (한국어)"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  비노출(active=false)로 자동 등록됩니다. 승인 후 대학교 메뉴에서
                  공개 처리하세요.
                </p>
              </div>
            ) : null}
          </Field>

          <Field label="학기" name="term" error={fieldErr("term")}>
            <select
              name="term"
              required
              defaultValue={meta.term}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {TERM_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="전형 카테고리"
            name="admission_category"
            error={fieldErr("admission_category")}
            full
          >
            <input
              type="text"
              name="admission_category"
              defaultValue={identityCategory}
              maxLength={200}
              placeholder="예: 글로벌요양복지과"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </Field>

          <Field label="과정" name="program_type" error={fieldErr("program_type")}>
            <select
              name="program_type"
              required
              defaultValue={identityProgramType}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">— 선택 —</option>
              {PROGRAM_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="원본 파일 경로 (선택)"
            name="source_file_url"
            error={fieldErr("source_file_url")}
          >
            <input
              type="text"
              name="source_file_url"
              maxLength={500}
              defaultValue={meta.sourceFileName ?? ""}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </Field>
        </div>

        {/* 학과 */}
        <Section
          title={`학과 (${initialDepartments.length})`}
          open
          error={fieldErr("spec_departments")}
        >
          <p className="mb-2 text-xs text-muted-foreground">
            승인 시, 여기 학과명과 일치하는 학과 레코드가 없으면 비노출
            (active=false)로 자동 생성됩니다. 기존 학과는 변경되지 않습니다.
          </p>
          <DepartmentsField
            name="spec_departments"
            initial={initialDepartments}
          />
        </Section>

        {/* 제출 서류 */}
        <Section
          title={`제출 서류 (${initialDocuments.length})`}
          open
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
        <Section
          title="기타 정보 (선발·연락처·정부지정 등)"
          error={fieldErr("spec_metadata")}
        >
          <MetadataField name="spec_metadata" initial={initialMetadata} />
        </Section>

        {/* ai_extraction_log (hidden, INSERT 시 그대로 저장) */}
        {aiLog ? (
          <input
            type="hidden"
            name="ai_extraction_log"
            value={JSON.stringify({
              model: "claude-sonnet-4-5",
              confidence: aiLog.confidence,
              usage: aiLog.usage,
              extracted_at: aiLog.extracted_at ?? new Date().toISOString(),
            })}
          />
        ) : null}

        {state?.error ? (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.error}
          </div>
        ) : null}

        {/* 중복 승인본 — 갱신(덮어쓰기) 확인 */}
        {state?.duplicate ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-500" />
              <div className="flex-1">
                <p className="font-medium text-amber-900">
                  이미 같은 대학 · {state.duplicate.term} 승인본이{" "}
                  {state.duplicate.count}건 있습니다.
                </p>
                <p className="mt-0.5 text-xs text-amber-800">
                  갱신하면 <strong>기존 승인본은 보관(archived) 처리</strong>되고
                  이 내용이 새 승인본이 됩니다. 잘못된 내용으로 덮어쓰지 않도록
                  한 번 더 확인하세요.
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={pending}
                    onClick={() => {
                      confirmReplaceRef.current = true;
                      formRef.current?.requestSubmit();
                    }}
                  >
                    {pending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Check className="size-4" />
                    )}
                    갱신 승인 (기존 보관)
                  </Button>
                  <a
                    href="/admissions"
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    취소 (기존 유지)
                  </a>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex items-center gap-2 border-t border-border pt-4">
          <Button
            type="submit"
            disabled={pending}
            onClick={() => {
              // 일반 제출은 항상 먼저 묻도록 확정 플래그 초기화
              confirmReplaceRef.current = false;
            }}
          >
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                저장 중...
              </>
            ) : (
              <>
                <Check className="size-4" />
                승인 + 저장
              </>
            )}
          </Button>
          <a
            href="/admissions"
            className={buttonVariants({ variant: "outline" })}
          >
            취소 (저장 없이 목록으로)
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
