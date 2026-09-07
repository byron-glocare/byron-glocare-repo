"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

export type AlternativePath = {
  type:
    | "sejong_institute"
    | "kiip"
    | "university_internal_test"
    | "korean_education_center"
    | "health_science_degree"
    | "elder_care_career";
  level?: string;
  name?: string;
  description?: string;
  notes?: string | null;
};

/**
 * 나이 요건 — 모집요강 원문이 "만 N세"로 쓰기도, "YYYY년 이후 출생"으로 쓰기도 한다.
 * 원문이 쓴 방식만 채운다(임의 환산 금지). 표시·안내용이며 자동 검증은 하지 않는다.
 */
export type AgeRequirement = {
  min_age?: number | null;
  max_age?: number | null;
  birth_date_from?: string | null;
  birth_date_to?: string | null;
  reference_date?: string | null;
  notes?: string | null;
};

export type Eligibility = {
  applicant_categories?: string[];
  age_requirement?: AgeRequirement | null;
  education_required:
    | "high_school"
    | "high_school_12yrs"
    | "health_related_bachelor"
    | "bachelor"
    | "master";
  education_paths?: string[];
  education_exclusions?: string[];
  gpa_min?: number | null;
  gpa_scale?: "10" | "4.5" | "4.0" | "100" | null;
  korean_proficiency?: {
    topik_min_default?: number | null;
    topik_min_by_dept_category?: Record<string, number>;
    alternative_paths?: AlternativePath[];
    post_admission_requirement?: string | null;
  };
  english_proficiency?: {
    applies_to_departments?: string[];
    minimums?: Record<string, number | string>;
    notes?: string;
  };
  financial_minimum?: {
    amount?: number | null;
    currency?: string;
    holder_relations?: Array<
      "self" | "parent" | "guardian" | "financial_sponsor"
    >;
    freshness_days?: number | null;
    notes?: string | null;
  } | null;
  exclusions?: string[];
  notes_ko?: string;
};

const EDUCATION_OPTIONS = [
  { value: "high_school", label: "고등학교 졸업" },
  { value: "high_school_12yrs", label: "12년 정규 교육" },
  { value: "health_related_bachelor", label: "보건계열 학사" },
  { value: "bachelor", label: "학사" },
  { value: "master", label: "석사" },
] as const;

const GPA_SCALE_OPTIONS = [
  { value: "", label: "—" },
  { value: "10", label: "10점" },
  { value: "4.5", label: "4.5점" },
  { value: "4.0", label: "4.0점" },
  { value: "100", label: "100점" },
] as const;

const ALT_TYPE_OPTIONS = [
  { value: "sejong_institute", label: "세종학당" },
  { value: "kiip", label: "사회통합프로그램(KIIP)" },
  { value: "university_internal_test", label: "교내 한국어 시험" },
  { value: "korean_education_center", label: "한국교육원" },
  { value: "health_science_degree", label: "보건의료 학위" },
  { value: "elder_care_career", label: "요양보호 경력" },
] as const;

const HOLDER_OPTIONS = [
  { value: "self", label: "본인" },
  { value: "parent", label: "부모" },
  { value: "guardian", label: "보호자" },
  { value: "financial_sponsor", label: "재정보증인" },
] as const;

const ENG_MIN_KEYS = [
  "TOEFL_PBT",
  "TOEFL_CBT",
  "TOEFL_iBT",
  "IELTS",
  "CEFR",
  "TEPS",
  "NEW_TEPS",
  "DUOLINGO",
];

export function EligibilityField({
  name,
  initial,
}: {
  name: string;
  initial: Eligibility | null | undefined;
}) {
  const [educationRequired, setEducationRequired] = useState<
    Eligibility["education_required"]
  >(initial?.education_required ?? "high_school");
  const [applicantCategories, setApplicantCategories] = useState<string>(
    (initial?.applicant_categories ?? []).join(", ")
  );
  const [educationPaths, setEducationPaths] = useState<string>(
    (initial?.education_paths ?? []).join(", ")
  );
  const [educationExclusions, setEducationExclusions] = useState<string>(
    (initial?.education_exclusions ?? []).join(", ")
  );
  const [gpaMin, setGpaMin] = useState<string>(
    initial?.gpa_min == null ? "" : String(initial.gpa_min)
  );
  const [gpaScale, setGpaScale] = useState<string>(initial?.gpa_scale ?? "");

  // 나이
  const [minAge, setMinAge] = useState<string>(
    initial?.age_requirement?.min_age == null
      ? ""
      : String(initial.age_requirement.min_age)
  );
  const [maxAge, setMaxAge] = useState<string>(
    initial?.age_requirement?.max_age == null
      ? ""
      : String(initial.age_requirement.max_age)
  );
  const [birthFrom, setBirthFrom] = useState<string>(
    initial?.age_requirement?.birth_date_from ?? ""
  );
  const [birthTo, setBirthTo] = useState<string>(
    initial?.age_requirement?.birth_date_to ?? ""
  );
  const [ageRefDate, setAgeRefDate] = useState<string>(
    initial?.age_requirement?.reference_date ?? ""
  );
  const [ageNotes, setAgeNotes] = useState<string>(
    initial?.age_requirement?.notes ?? ""
  );

  // korean
  const [topikDefault, setTopikDefault] = useState<string>(
    initial?.korean_proficiency?.topik_min_default == null
      ? ""
      : String(initial.korean_proficiency.topik_min_default)
  );
  const [postAdmissionReq, setPostAdmissionReq] = useState<string>(
    initial?.korean_proficiency?.post_admission_requirement ?? ""
  );
  const [altPaths, setAltPaths] = useState<AlternativePath[]>(
    initial?.korean_proficiency?.alternative_paths ?? []
  );

  // english
  const [engApplies, setEngApplies] = useState<string>(
    (initial?.english_proficiency?.applies_to_departments ?? []).join(", ")
  );
  const [engMinimums, setEngMinimums] = useState<Record<string, string>>(
    Object.fromEntries(
      ENG_MIN_KEYS.map((k) => [
        k,
        initial?.english_proficiency?.minimums?.[k] === undefined
          ? ""
          : String(initial?.english_proficiency?.minimums?.[k]),
      ])
    )
  );
  const [engNotes, setEngNotes] = useState<string>(
    initial?.english_proficiency?.notes ?? ""
  );

  // financial
  const [hasFinancial, setHasFinancial] = useState<boolean>(
    !!initial?.financial_minimum
  );
  const [finAmount, setFinAmount] = useState<string>(
    initial?.financial_minimum?.amount == null
      ? ""
      : String(initial.financial_minimum.amount)
  );
  const [finCurrency, setFinCurrency] = useState<string>(
    initial?.financial_minimum?.currency ?? "KRW"
  );
  const [finHolders, setFinHolders] = useState<string[]>(
    initial?.financial_minimum?.holder_relations ?? []
  );
  const [finFresh, setFinFresh] = useState<string>(
    initial?.financial_minimum?.freshness_days == null
      ? ""
      : String(initial.financial_minimum.freshness_days)
  );
  const [finNotes, setFinNotes] = useState<string>(
    initial?.financial_minimum?.notes ?? ""
  );

  // exclusions, notes_ko
  const [exclusions, setExclusions] = useState<string>(
    (initial?.exclusions ?? []).join(", ")
  );
  const [notesKo, setNotesKo] = useState<string>(initial?.notes_ko ?? "");

  const splitCsv = (s: string): string[] =>
    s
      .split(",")
      .map((x) => x.trim())
      .filter((x) => x !== "");

  const toNum = (v: string): number | null => {
    if (v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const engMinNorm: Record<string, number | string> = {};
  for (const k of ENG_MIN_KEYS) {
    const v = engMinimums[k];
    if (v === "" || v === undefined) continue;
    const n = Number(v);
    engMinNorm[k] = Number.isFinite(n) && v.trim() !== "" ? n : v;
  }

  const koreanProficiency = {
    topik_min_default: toNum(topikDefault),
    alternative_paths: altPaths.map((p) => ({
      type: p.type,
      level: p.level || undefined,
      name: p.name || undefined,
      description: p.description || undefined,
      notes: p.notes || null,
    })),
    post_admission_requirement: postAdmissionReq || null,
  };

  const englishProficiency =
    engApplies.trim() !== "" ||
    Object.keys(engMinNorm).length > 0 ||
    engNotes !== ""
      ? {
          applies_to_departments:
            engApplies.trim() !== "" ? splitCsv(engApplies) : undefined,
          minimums:
            Object.keys(engMinNorm).length > 0 ? engMinNorm : undefined,
          notes: engNotes || undefined,
        }
      : undefined;

  const financialMinimum = hasFinancial
    ? {
        amount: toNum(finAmount),
        currency: finCurrency || "KRW",
        holder_relations: finHolders,
        freshness_days: toNum(finFresh),
        notes: finNotes || null,
      }
    : null;

  // 하나라도 입력됐을 때만 객체를 만든다 — 아무것도 없으면 null(요건 없음).
  const ageRequirement =
    minAge !== "" ||
    maxAge !== "" ||
    birthFrom !== "" ||
    birthTo !== "" ||
    ageRefDate !== "" ||
    ageNotes !== ""
      ? {
          min_age: toNum(minAge),
          max_age: toNum(maxAge),
          birth_date_from: birthFrom || null,
          birth_date_to: birthTo || null,
          reference_date: ageRefDate || null,
          notes: ageNotes || null,
        }
      : null;

  const serialized = JSON.stringify({
    applicant_categories: splitCsv(applicantCategories),
    age_requirement: ageRequirement,
    education_required: educationRequired,
    education_paths:
      educationPaths.trim() !== "" ? splitCsv(educationPaths) : undefined,
    education_exclusions:
      educationExclusions.trim() !== ""
        ? splitCsv(educationExclusions)
        : undefined,
    gpa_min: toNum(gpaMin),
    gpa_scale: gpaScale || null,
    korean_proficiency: koreanProficiency,
    english_proficiency: englishProficiency,
    financial_minimum: financialMinimum,
    exclusions: exclusions.trim() !== "" ? splitCsv(exclusions) : undefined,
    notes_ko: notesKo || undefined,
  });

  return (
    <div className="space-y-4">
      {/* 학력 */}
      <div className="space-y-2 rounded-md border bg-muted/20 p-3">
        <div className="text-sm font-medium">학력</div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <FieldSelect
            label="요구 학력"
            value={educationRequired}
            onChange={(v) =>
              setEducationRequired(v as Eligibility["education_required"])
            }
            options={[...EDUCATION_OPTIONS]}
          />
          <FieldText
            label="지원 카테고리 (쉼표 구분)"
            value={applicantCategories}
            onChange={setApplicantCategories}
            placeholder="예: 순수외국인, 외국인특별전형"
          />
          <FieldText
            label="허용 학력 경로 (쉼표 구분)"
            value={educationPaths}
            onChange={setEducationPaths}
            placeholder="예: 정규 고등학교, 검정고시"
          />
          <FieldText
            label="제외 학력 (쉼표 구분)"
            value={educationExclusions}
            onChange={setEducationExclusions}
            placeholder="예: 홈스쿨링, 검정고시"
          />
          <FieldNumber
            label="최소 GPA"
            value={gpaMin}
            onChange={setGpaMin}
            placeholder="예: 7.0 / 3.0"
          />
          <FieldSelect
            label="GPA 만점"
            value={gpaScale}
            onChange={setGpaScale}
            options={[...GPA_SCALE_OPTIONS]}
          />
        </div>
      </div>

      {/* 나이 */}
      <div className="space-y-2 rounded-md border bg-muted/20 p-3">
        <div className="text-sm font-medium">나이 요건</div>
        <p className="text-xs text-muted-foreground">
          모집요강에 적힌 방식대로만 채우세요. &ldquo;만 18세 이상&rdquo;은 만
          나이에, &ldquo;1996년 이후 출생&rdquo;은 출생일에. 서로 환산하지 마세요.
          비워두면 &ldquo;나이 제한 없음&rdquo;으로 표시됩니다.
        </p>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <FieldNumber
            label="만 나이 하한 (이상)"
            value={minAge}
            onChange={setMinAge}
            placeholder="예: 18"
          />
          <FieldNumber
            label="만 나이 상한 (이하)"
            value={maxAge}
            onChange={setMaxAge}
            placeholder="예: 30"
          />
          <FieldText
            label="출생일 하한 (이 날짜 이후 출생)"
            type="date"
            value={birthFrom}
            onChange={setBirthFrom}
          />
          <FieldText
            label="출생일 상한 (이 날짜 이전 출생)"
            type="date"
            value={birthTo}
            onChange={setBirthTo}
          />
          <FieldText
            label="나이 기준일 (명시된 경우만)"
            type="date"
            value={ageRefDate}
            onChange={setAgeRefDate}
          />
          <FieldText
            label="나이 메모"
            value={ageNotes}
            onChange={setAgeNotes}
            placeholder="예: 요양보호 학과는 상한 없음"
          />
        </div>
      </div>

      {/* 한국어 */}
      <div className="space-y-2 rounded-md border bg-muted/20 p-3">
        <div className="text-sm font-medium">한국어 능력</div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <FieldSelect
            label="기본 TOPIK 최소"
            value={topikDefault}
            onChange={setTopikDefault}
            options={[
              { value: "", label: "—" },
              { value: "1", label: "1급" },
              { value: "2", label: "2급" },
              { value: "3", label: "3급" },
              { value: "4", label: "4급" },
              { value: "5", label: "5급" },
              { value: "6", label: "6급" },
            ]}
          />
          <FieldText
            label="입학 후 요건"
            value={postAdmissionReq}
            onChange={setPostAdmissionReq}
            placeholder="예: 졸업 전 TOPIK 4급 취득"
          />
        </div>
        <div className="mt-2 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              TOPIK 대체 경로
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setAltPaths([
                  ...altPaths,
                  { type: "sejong_institute", level: "", notes: null },
                ])
              }
            >
              <Plus className="size-4" />
              추가
            </Button>
          </div>
          {altPaths.length === 0 ? (
            <div className="text-xs text-muted-foreground">
              세종학당·KIIP·교내시험 등 대체 경로 추가.
            </div>
          ) : (
            <div className="space-y-1">
              {altPaths.map((p, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 rounded-md border bg-background p-2"
                >
                  <select
                    value={p.type}
                    onChange={(e) =>
                      setAltPaths(
                        altPaths.map((x, i) =>
                          i === idx
                            ? {
                                ...x,
                                type: e.target.value as AlternativePath["type"],
                              }
                            : x
                        )
                      )
                    }
                    className="w-44 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                  >
                    {ALT_TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={p.level ?? ""}
                    onChange={(e) =>
                      setAltPaths(
                        altPaths.map((x, i) =>
                          i === idx ? { ...x, level: e.target.value } : x
                        )
                      )
                    }
                    placeholder="등급/이수"
                    className="w-28 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                  />
                  <input
                    type="text"
                    value={p.description ?? ""}
                    onChange={(e) =>
                      setAltPaths(
                        altPaths.map((x, i) =>
                          i === idx
                            ? { ...x, description: e.target.value }
                            : x
                        )
                      )
                    }
                    placeholder="설명"
                    className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setAltPaths(altPaths.filter((_, i) => i !== idx))
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
      </div>

      {/* 영어 */}
      <div className="space-y-2 rounded-md border bg-muted/20 p-3">
        <div className="text-sm font-medium">영어 능력 (해당 학과에 한해)</div>
        <FieldText
          label="대상 학과 (쉼표 구분)"
          value={engApplies}
          onChange={setEngApplies}
          placeholder="예: 영어트랙, 국제학부"
        />
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {ENG_MIN_KEYS.map((k) => (
            <FieldText
              key={k}
              label={k}
              value={engMinimums[k] ?? ""}
              onChange={(v) =>
                setEngMinimums({ ...engMinimums, [k]: v })
              }
              placeholder="-"
            />
          ))}
        </div>
        <FieldText
          label="영어 메모"
          value={engNotes}
          onChange={setEngNotes}
          placeholder="추가 안내"
        />
      </div>

      {/* 재정 */}
      <div className="space-y-2 rounded-md border bg-muted/20 p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">재정 요건</span>
          <label className="flex items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              checked={hasFinancial}
              onChange={(e) => setHasFinancial(e.target.checked)}
            />
            요건 있음
          </label>
        </div>
        {hasFinancial ? (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <FieldNumber
              label="최소 금액"
              value={finAmount}
              onChange={setFinAmount}
              placeholder="예: 20000000"
            />
            <FieldSelect
              label="통화"
              value={finCurrency}
              onChange={setFinCurrency}
              options={[
                { value: "KRW", label: "원 (KRW)" },
                { value: "USD", label: "달러 (USD)" },
                { value: "VND", label: "동 (VND)" },
              ]}
            />
            <FieldNumber
              label="잔고 유효기간 (일)"
              value={finFresh}
              onChange={setFinFresh}
              placeholder="예: 30"
            />
            <FieldText
              label="재정 메모"
              value={finNotes}
              onChange={setFinNotes}
              placeholder="추가 안내"
            />
            <div className="md:col-span-2">
              <span className="text-xs text-muted-foreground">
                예금주 (체크 모두 선택)
              </span>
              <div className="mt-1 flex flex-wrap gap-3">
                {HOLDER_OPTIONS.map((o) => (
                  <label
                    key={o.value}
                    className="flex items-center gap-1.5 text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={finHolders.includes(o.value)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFinHolders([...finHolders, o.value]);
                        } else {
                          setFinHolders(
                            finHolders.filter((x) => x !== o.value)
                          );
                        }
                      }}
                    />
                    {o.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* 제외사항·메모 */}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <FieldText
          label="자격 제외사항 (쉼표 구분)"
          value={exclusions}
          onChange={setExclusions}
          placeholder="예: 한국 국적, F-4 비자 소지자"
        />
        <FieldText
          label="자격 메모"
          value={notesKo}
          onChange={setNotesKo}
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
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** "date" 면 달력 입력 — 저장값은 그대로 YYYY-MM-DD */
  type?: "text" | "date";
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input
        type={type}
        {...(type === "date" ? { min: "1900-01-01", max: "2100-12-31" } : {})}
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
