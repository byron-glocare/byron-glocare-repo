"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

export type RequiredDocument = {
  key: string;
  name_ko: string;
  name_vi?: string | null;
  required?: boolean;
  issuer?: string | null;
  language?: string | null;
  notarization?: string | null;
  group?: string | null;
  notes?: string | null;
};

const KEY_OPTIONS: Array<{ value: string; label: string }> = [
  // 신원
  { value: "photo", label: "사진" },
  { value: "passport_copy", label: "여권 사본" },
  { value: "national_id_copy", label: "신분증 사본" },
  { value: "parents_id_copy", label: "부모 신분증 사본" },
  { value: "alien_registration_card", label: "외국인등록증" },
  { value: "nationality_proof", label: "국적증명서" },
  // 학력
  { value: "highschool_diploma", label: "고등학교 졸업증명서" },
  { value: "highschool_transcript", label: "고등학교 성적증명서" },
  // 가족
  { value: "birth_certificate", label: "출생증명서" },
  { value: "family_relations_certificate", label: "가족관계증명서" },
  // 재정
  { value: "bank_balance", label: "은행 잔고증명서" },
  { value: "financial_proof", label: "재정증명서" },
  // 학교 양식
  { value: "application_form", label: "입학원서 (학교 양식)" },
  { value: "self_intro", label: "자기소개서" },
  { value: "study_plan", label: "학업계획서" },
  { value: "financial_pledge_form", label: "재정보증서 (학교 양식)" },
  { value: "privacy_consent", label: "개인정보 동의서" },
  { value: "academic_record_release", label: "학적정보 제공 동의서" },
  // 어학·자격
  { value: "topik_certificate", label: "TOPIK 성적증명서" },
  { value: "language_alt_certificate", label: "어학 대체 증명서" },
  { value: "korean_proof", label: "한국어 능력 증명" },
  { value: "career_certificate", label: "경력증명서" },
  { value: "license_copy", label: "자격증 사본" },
  // 비자
  { value: "visa_application_form", label: "비자 신청서" },
  // 기타
  { value: "other", label: "기타" },
];

const LANGUAGE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "—" },
  { value: "ko", label: "한국어" },
  { value: "en", label: "영어" },
  { value: "vi", label: "베트남어" },
  { value: "ko_or_en", label: "한국어 또는 영어" },
  { value: "any", label: "무관" },
];

const NOTARIZATION_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "—" },
  { value: "none", label: "공증 불필요" },
  { value: "translation_notarization", label: "번역 공증" },
  { value: "consul", label: "영사확인 (일반)" },
  { value: "consul_for_vietnam", label: "주베트남 한국대사관 영사확인" },
  { value: "apostille", label: "아포스티유" },
  { value: "apostille_or_consul", label: "아포스티유 또는 영사확인" },
];

const GROUP_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "—" },
  { value: "identity", label: "신원" },
  { value: "academic", label: "학력" },
  { value: "family", label: "가족" },
  { value: "financial", label: "재정" },
  { value: "university_form", label: "학교 양식" },
  { value: "language", label: "어학" },
  { value: "visa", label: "비자" },
  { value: "other", label: "기타" },
];

const emptyDoc = (): RequiredDocument => ({
  key: "other",
  name_ko: "",
  name_vi: "",
  required: true,
  issuer: "",
  language: "",
  notarization: "",
  group: "",
  notes: "",
});

export function RequiredDocumentsField({
  name,
  initial,
}: {
  name: string;
  initial: RequiredDocument[];
}) {
  const [items, setItems] = useState<RequiredDocument[]>(initial);

  const add = () => setItems([...items, emptyDoc()]);
  const remove = (idx: number) =>
    setItems(items.filter((_, i) => i !== idx));
  const update = <K extends keyof RequiredDocument>(
    idx: number,
    field: K,
    value: RequiredDocument[K]
  ) =>
    setItems(
      items.map((d, i) => (i === idx ? { ...d, [field]: value } : d))
    );

  // 직렬화 — 빈 string 은 null 로 변환
  const serialized = JSON.stringify(
    items.map((d) => ({
      key: d.key,
      name_ko: d.name_ko,
      name_vi: d.name_vi || null,
      required: d.required ?? true,
      issuer: d.issuer || null,
      language: d.language || null,
      notarization: d.notarization || null,
      group: d.group || null,
      notes: d.notes || null,
    }))
  );

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          등록된 서류가 없습니다.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((d, idx) => (
            <div key={idx} className="rounded-md border bg-background p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  #{idx + 1}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(idx)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-3">
                <FieldSelect
                  label="서류 종류"
                  value={d.key}
                  onChange={(v) => update(idx, "key", v)}
                  options={KEY_OPTIONS}
                />
                <FieldText
                  label="서류명 (한국어)"
                  value={d.name_ko}
                  onChange={(v) => update(idx, "name_ko", v)}
                  placeholder="예: 여권 사본"
                  required
                />
                <FieldText
                  label="서류명 (베트남어)"
                  value={d.name_vi ?? ""}
                  onChange={(v) => update(idx, "name_vi", v)}
                  placeholder="예: Bản sao hộ chiếu"
                />
                <FieldSelect
                  label="언어"
                  value={d.language ?? ""}
                  onChange={(v) => update(idx, "language", v)}
                  options={LANGUAGE_OPTIONS}
                />
                <FieldSelect
                  label="공증"
                  value={d.notarization ?? ""}
                  onChange={(v) => update(idx, "notarization", v)}
                  options={NOTARIZATION_OPTIONS}
                />
                <FieldSelect
                  label="그룹"
                  value={d.group ?? ""}
                  onChange={(v) => update(idx, "group", v)}
                  options={GROUP_OPTIONS}
                />
                <FieldText
                  label="발행기관"
                  value={d.issuer ?? ""}
                  onChange={(v) => update(idx, "issuer", v)}
                  placeholder="예: 베트남 정부, 학교"
                />
                <div className="flex items-end">
                  <label className="flex items-center gap-1.5 text-xs">
                    <input
                      type="checkbox"
                      checked={d.required ?? true}
                      onChange={(e) =>
                        update(idx, "required", e.target.checked)
                      }
                    />
                    필수 제출
                  </label>
                </div>
              </div>

              <div className="mt-2">
                <FieldText
                  label="메모"
                  value={d.notes ?? ""}
                  onChange={(v) => update(idx, "notes", v)}
                  placeholder="추가 안내사항 (선택)"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus className="size-4" />
        서류 추가
      </Button>

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
