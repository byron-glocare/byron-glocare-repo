"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

export type GovernmentDesignation = {
  agency: "moj" | "mohw" | "moj_mohw_joint" | "moe" | "other";
  designation_name: string;
  effective_from?: string;
  benefits: Array<
    | "relaxed_visa_financial"
    | "relaxed_stay_extension"
    | "e7_eligible_after_graduation"
    | "min_wage_guaranteed"
    | "job_placement"
    | "other"
  >;
  notes?: string;
};

export type Metadata = {
  selection_process?: {
    method?: string;
    interview_required?: boolean;
    interview_content?: string[];
    evaluation_criteria?: string;
  };
  post_acceptance?: {
    visa_type?: string;
    post_graduation_visa?: string;
    insurance_requirement?: string;
    warnings?: string[];
    process_steps?: string[];
  };
  forms?: {
    application_form?: boolean;
    self_intro?: boolean;
    study_plan?: boolean;
    financial_pledge?: boolean;
    privacy_consent?: boolean;
    academic_record_release?: boolean;
    notes?: string;
  };
  contacts?: {
    phone?: string;
    phone_vietnamese?: string;
    phone_korean?: string;
    fax?: string;
    email?: string;
    email_secondary?: string;
    address_ko?: string;
    address_en?: string;
    website?: string;
    online_apply_url?: string;
    department_name?: string;
    submission_hours?: string;
  };
  government_designations?: GovernmentDesignation[];
  country_specific_notes_vi?: string;
  language_program?: {
    hours_per_semester?: number;
    hours_per_week?: number;
    weeks_per_semester?: number;
    weekly_schedule?: string;
    visa_type?: string;
    visa_extension?: string;
  };
};

const AGENCY_OPTIONS = [
  { value: "moj", label: "법무부 (MOJ)" },
  { value: "mohw", label: "보건복지부 (MOHW)" },
  { value: "moj_mohw_joint", label: "법무부+복지부 공동" },
  { value: "moe", label: "교육부 (MOE)" },
  { value: "other", label: "기타" },
] as const;

const BENEFIT_OPTIONS = [
  { value: "relaxed_visa_financial", label: "비자 재정요건 완화" },
  { value: "relaxed_stay_extension", label: "체류기간 연장 완화" },
  { value: "e7_eligible_after_graduation", label: "졸업 후 E-7 자격" },
  { value: "min_wage_guaranteed", label: "최저임금 보장" },
  { value: "job_placement", label: "취업 알선" },
  { value: "other", label: "기타" },
] as const;

const FORMS_KEYS: Array<{
  key:
    | "application_form"
    | "self_intro"
    | "study_plan"
    | "financial_pledge"
    | "privacy_consent"
    | "academic_record_release";
  label: string;
}> = [
  { key: "application_form", label: "입학원서" },
  { key: "self_intro", label: "자기소개서" },
  { key: "study_plan", label: "학업계획서" },
  { key: "financial_pledge", label: "재정보증서" },
  { key: "privacy_consent", label: "개인정보 동의서" },
  { key: "academic_record_release", label: "학적정보 동의서" },
];

export function MetadataField({
  name,
  initial,
}: {
  name: string;
  initial: Metadata | null | undefined;
}) {
  // selection_process
  const [selMethod, setSelMethod] = useState<string>(
    initial?.selection_process?.method ?? ""
  );
  const [interviewRequired, setInterviewRequired] = useState<boolean>(
    !!initial?.selection_process?.interview_required
  );
  const [interviewContent, setInterviewContent] = useState<string>(
    (initial?.selection_process?.interview_content ?? []).join(", ")
  );
  const [evalCriteria, setEvalCriteria] = useState<string>(
    initial?.selection_process?.evaluation_criteria ?? ""
  );

  // post_acceptance
  const [visaType, setVisaType] = useState<string>(
    initial?.post_acceptance?.visa_type ?? "D-2"
  );
  const [postGradVisa, setPostGradVisa] = useState<string>(
    initial?.post_acceptance?.post_graduation_visa ?? ""
  );
  const [insReq, setInsReq] = useState<string>(
    initial?.post_acceptance?.insurance_requirement ?? ""
  );
  const [warnings, setWarnings] = useState<string>(
    (initial?.post_acceptance?.warnings ?? []).join("\n")
  );
  const [processSteps, setProcessSteps] = useState<string>(
    (initial?.post_acceptance?.process_steps ?? []).join("\n")
  );

  // forms
  const [forms, setForms] = useState<NonNullable<Metadata["forms"]>>({
    application_form: !!initial?.forms?.application_form,
    self_intro: !!initial?.forms?.self_intro,
    study_plan: !!initial?.forms?.study_plan,
    financial_pledge: !!initial?.forms?.financial_pledge,
    privacy_consent: !!initial?.forms?.privacy_consent,
    academic_record_release: !!initial?.forms?.academic_record_release,
    notes: initial?.forms?.notes ?? "",
  });

  // contacts
  const [contacts, setContacts] = useState<NonNullable<Metadata["contacts"]>>(
    initial?.contacts ?? {}
  );

  // government_designations
  const [govDes, setGovDes] = useState<GovernmentDesignation[]>(
    initial?.government_designations ?? []
  );

  // language_program
  const [langProg, setLangProg] = useState<
    NonNullable<Metadata["language_program"]>
  >(initial?.language_program ?? {});

  // country notes vi
  const [countryNotes, setCountryNotes] = useState<string>(
    initial?.country_specific_notes_vi ?? ""
  );

  const splitCsv = (s: string): string[] =>
    s
      .split(",")
      .map((x) => x.trim())
      .filter((x) => x !== "");

  const splitLines = (s: string): string[] =>
    s
      .split("\n")
      .map((x) => x.trim())
      .filter((x) => x !== "");

  const cleanObj = <T extends Record<string, unknown>>(o: T): T | undefined => {
    const clean: Record<string, unknown> = {};
    let hasAny = false;
    for (const [k, v] of Object.entries(o)) {
      if (v === undefined || v === null || v === "" || v === false) continue;
      if (Array.isArray(v) && v.length === 0) continue;
      clean[k] = v;
      hasAny = true;
    }
    return hasAny ? (clean as T) : undefined;
  };

  const serialized = JSON.stringify({
    selection_process: cleanObj({
      method: selMethod || undefined,
      interview_required: interviewRequired || undefined,
      interview_content:
        interviewContent.trim() !== ""
          ? splitCsv(interviewContent)
          : undefined,
      evaluation_criteria: evalCriteria || undefined,
    }),
    post_acceptance: cleanObj({
      visa_type: visaType || undefined,
      post_graduation_visa: postGradVisa || undefined,
      insurance_requirement: insReq || undefined,
      warnings: warnings.trim() !== "" ? splitLines(warnings) : undefined,
      process_steps:
        processSteps.trim() !== "" ? splitLines(processSteps) : undefined,
    }),
    forms: cleanObj({
      application_form: forms.application_form,
      self_intro: forms.self_intro,
      study_plan: forms.study_plan,
      financial_pledge: forms.financial_pledge,
      privacy_consent: forms.privacy_consent,
      academic_record_release: forms.academic_record_release,
      notes: forms.notes || undefined,
    }),
    contacts: cleanObj({ ...contacts }),
    government_designations:
      govDes.length > 0
        ? govDes.map((g) => ({
            agency: g.agency,
            designation_name: g.designation_name,
            effective_from: g.effective_from || undefined,
            benefits: g.benefits,
            notes: g.notes || undefined,
          }))
        : undefined,
    country_specific_notes_vi: countryNotes || undefined,
    language_program: cleanObj({ ...langProg }),
  });

  return (
    <div className="space-y-4">
      {/* 선발 절차 */}
      <div className="space-y-2 rounded-md border bg-muted/20 p-3">
        <div className="text-sm font-medium">선발 절차</div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <FieldText
            label="선발 방법"
            value={selMethod}
            onChange={setSelMethod}
            placeholder="예: 서류 100% / 서류+면접"
          />
          <label className="flex items-center gap-1.5 self-end text-xs">
            <input
              type="checkbox"
              checked={interviewRequired}
              onChange={(e) => setInterviewRequired(e.target.checked)}
            />
            면접 필수
          </label>
          <FieldText
            label="면접 내용 (쉼표 구분)"
            value={interviewContent}
            onChange={setInterviewContent}
            placeholder="예: 한국어 회화, 학업 계획"
          />
          <FieldText
            label="평가 기준"
            value={evalCriteria}
            onChange={setEvalCriteria}
            placeholder="예: 서류 60% + 면접 40%"
          />
        </div>
      </div>

      {/* 합격 후 (비자) */}
      <div className="space-y-2 rounded-md border bg-muted/20 p-3">
        <div className="text-sm font-medium">합격 후 (비자·절차)</div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <FieldText
            label="입학 비자"
            value={visaType}
            onChange={setVisaType}
            placeholder="D-2"
          />
          <FieldText
            label="졸업 후 비자"
            value={postGradVisa}
            onChange={setPostGradVisa}
            placeholder="예: E-7"
          />
          <FieldText
            label="보험 요건"
            value={insReq}
            onChange={setInsReq}
            placeholder="예: 의료보험 의무"
          />
        </div>
        <FieldTextarea
          label="주의사항 (줄바꿈 구분)"
          value={warnings}
          onChange={setWarnings}
          rows={3}
        />
        <FieldTextarea
          label="절차 (줄바꿈 구분)"
          value={processSteps}
          onChange={setProcessSteps}
          rows={3}
        />
      </div>

      {/* 학교 양식 */}
      <div className="space-y-2 rounded-md border bg-muted/20 p-3">
        <div className="text-sm font-medium">학교 양식 (체크)</div>
        <div className="grid grid-cols-2 gap-1 md:grid-cols-3">
          {FORMS_KEYS.map((f) => (
            <label
              key={f.key}
              className="flex items-center gap-1.5 text-xs"
            >
              <input
                type="checkbox"
                checked={!!forms[f.key]}
                onChange={(e) =>
                  setForms({ ...forms, [f.key]: e.target.checked })
                }
              />
              {f.label}
            </label>
          ))}
        </div>
        <FieldText
          label="양식 메모"
          value={forms.notes ?? ""}
          onChange={(v) => setForms({ ...forms, notes: v })}
        />
      </div>

      {/* 연락처 */}
      <div className="space-y-2 rounded-md border bg-muted/20 p-3">
        <div className="text-sm font-medium">연락처</div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <FieldText
            label="담당 부서명"
            value={contacts.department_name ?? ""}
            onChange={(v) =>
              setContacts({ ...contacts, department_name: v })
            }
            placeholder="예: 국제교류처"
          />
          <FieldText
            label="전화번호"
            value={contacts.phone ?? ""}
            onChange={(v) => setContacts({ ...contacts, phone: v })}
          />
          <FieldText
            label="베트남어 응대 전화"
            value={contacts.phone_vietnamese ?? ""}
            onChange={(v) =>
              setContacts({ ...contacts, phone_vietnamese: v })
            }
          />
          <FieldText
            label="한국어 응대 전화"
            value={contacts.phone_korean ?? ""}
            onChange={(v) =>
              setContacts({ ...contacts, phone_korean: v })
            }
          />
          <FieldText
            label="이메일"
            value={contacts.email ?? ""}
            onChange={(v) => setContacts({ ...contacts, email: v })}
          />
          <FieldText
            label="보조 이메일"
            value={contacts.email_secondary ?? ""}
            onChange={(v) =>
              setContacts({ ...contacts, email_secondary: v })
            }
          />
          <FieldText
            label="팩스"
            value={contacts.fax ?? ""}
            onChange={(v) => setContacts({ ...contacts, fax: v })}
          />
          <FieldText
            label="웹사이트"
            value={contacts.website ?? ""}
            onChange={(v) => setContacts({ ...contacts, website: v })}
          />
          <FieldText
            label="온라인 지원 URL"
            value={contacts.online_apply_url ?? ""}
            onChange={(v) =>
              setContacts({ ...contacts, online_apply_url: v })
            }
          />
          <FieldText
            label="접수 시간"
            value={contacts.submission_hours ?? ""}
            onChange={(v) =>
              setContacts({ ...contacts, submission_hours: v })
            }
            placeholder="예: 평일 09:00-17:00"
          />
          <FieldText
            label="주소 (한국어)"
            value={contacts.address_ko ?? ""}
            onChange={(v) => setContacts({ ...contacts, address_ko: v })}
          />
          <FieldText
            label="주소 (영어)"
            value={contacts.address_en ?? ""}
            onChange={(v) => setContacts({ ...contacts, address_en: v })}
          />
        </div>
      </div>

      {/* 정부 지정 */}
      <div className="space-y-2 rounded-md border bg-muted/20 p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">정부 지정</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setGovDes([
                ...govDes,
                { agency: "moj", designation_name: "", benefits: [] },
              ])
            }
          >
            <Plus className="size-4" />
            추가
          </Button>
        </div>
        {govDes.length === 0 ? (
          <div className="text-xs text-muted-foreground">
            법무부·복지부 지정 등 정부 인증 추가.
          </div>
        ) : (
          <div className="space-y-2">
            {govDes.map((g, idx) => (
              <div key={idx} className="rounded-md border bg-background p-2">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    #{idx + 1}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setGovDes(govDes.filter((_, i) => i !== idx))
                    }
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                  <FieldSelect
                    label="지정 기관"
                    value={g.agency}
                    onChange={(v) =>
                      setGovDes(
                        govDes.map((x, i) =>
                          i === idx
                            ? {
                                ...x,
                                agency: v as GovernmentDesignation["agency"],
                              }
                            : x
                        )
                      )
                    }
                    options={[...AGENCY_OPTIONS]}
                  />
                  <FieldText
                    label="지정 명칭"
                    value={g.designation_name}
                    onChange={(v) =>
                      setGovDes(
                        govDes.map((x, i) =>
                          i === idx ? { ...x, designation_name: v } : x
                        )
                      )
                    }
                    placeholder="예: 인증대학"
                  />
                  <FieldText
                    label="발효일 (YYYY-MM-DD)"
                    value={g.effective_from ?? ""}
                    onChange={(v) =>
                      setGovDes(
                        govDes.map((x, i) =>
                          i === idx ? { ...x, effective_from: v } : x
                        )
                      )
                    }
                  />
                </div>
                <div className="mt-2">
                  <span className="text-xs text-muted-foreground">
                    혜택 (체크 모두 선택)
                  </span>
                  <div className="mt-1 flex flex-wrap gap-3">
                    {BENEFIT_OPTIONS.map((b) => (
                      <label
                        key={b.value}
                        className="flex items-center gap-1.5 text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={g.benefits.includes(b.value)}
                          onChange={(e) => {
                            setGovDes(
                              govDes.map((x, i) => {
                                if (i !== idx) return x;
                                const nxt = e.target.checked
                                  ? [...x.benefits, b.value]
                                  : x.benefits.filter((y) => y !== b.value);
                                return { ...x, benefits: nxt };
                              })
                            );
                          }}
                        />
                        {b.label}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="mt-2">
                  <FieldText
                    label="메모"
                    value={g.notes ?? ""}
                    onChange={(v) =>
                      setGovDes(
                        govDes.map((x, i) =>
                          i === idx ? { ...x, notes: v } : x
                        )
                      )
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 어학연수 프로그램 */}
      <div className="space-y-2 rounded-md border bg-muted/20 p-3">
        <div className="text-sm font-medium">어학연수 프로그램 (해당 시)</div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <FieldNumber
            label="학기당 시간"
            value={
              langProg.hours_per_semester == null
                ? ""
                : String(langProg.hours_per_semester)
            }
            onChange={(v) =>
              setLangProg({
                ...langProg,
                hours_per_semester: v === "" ? undefined : Number(v),
              })
            }
          />
          <FieldNumber
            label="주당 시간"
            value={
              langProg.hours_per_week == null
                ? ""
                : String(langProg.hours_per_week)
            }
            onChange={(v) =>
              setLangProg({
                ...langProg,
                hours_per_week: v === "" ? undefined : Number(v),
              })
            }
          />
          <FieldNumber
            label="학기 주수"
            value={
              langProg.weeks_per_semester == null
                ? ""
                : String(langProg.weeks_per_semester)
            }
            onChange={(v) =>
              setLangProg({
                ...langProg,
                weeks_per_semester: v === "" ? undefined : Number(v),
              })
            }
          />
          <FieldText
            label="주간 시간표"
            value={langProg.weekly_schedule ?? ""}
            onChange={(v) =>
              setLangProg({ ...langProg, weekly_schedule: v })
            }
            placeholder="예: 월-금"
          />
          <FieldText
            label="비자"
            value={langProg.visa_type ?? ""}
            onChange={(v) => setLangProg({ ...langProg, visa_type: v })}
            placeholder="D-4"
          />
          <FieldText
            label="연장 비자"
            value={langProg.visa_extension ?? ""}
            onChange={(v) =>
              setLangProg({ ...langProg, visa_extension: v })
            }
          />
        </div>
      </div>

      {/* 베트남 특화 메모 */}
      <FieldTextarea
        label="베트남 특화 안내 (베트남어)"
        value={countryNotes}
        onChange={setCountryNotes}
        rows={3}
      />

      <input type="hidden" name={name} value={serialized} />
    </div>
  );
}

function FieldText({
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
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
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

function FieldTextarea({
  label,
  value,
  onChange,
  rows,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows ?? 3}
        className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
      />
    </label>
  );
}
