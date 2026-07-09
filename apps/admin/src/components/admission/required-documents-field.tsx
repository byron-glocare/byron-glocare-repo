"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { isFormDoc } from "@/lib/admission/classify-documents";
import {
  addDocumentDataTypeAction,
  addAliasToDataTypeAction,
} from "@/app/(app)/admissions/specs/[id]/edit/doc-std-actions";

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
  /** 발급 서류의 표준 카탈로그 정본 키 (직접작성이면 무시) */
  std_key?: string | null;
};

export type DocCatalogOption = {
  key: string;
  label_ko: string;
  label_vi?: string | null;
  aliases?: string[] | null;
};

// ── 이름 정규화·매칭 ─────────────────────────────────────────────
const norm = (s: string): string =>
  (s || "")
    .replace(/[\s　]+/g, "")
    .replace(/[()[\]{}<>:：·・,.\/*\-_~"'’“”|]/g, "")
    .toLowerCase();

/** 문자 bigram 집합 */
function bigrams(s: string): Set<string> {
  const n = norm(s);
  const out = new Set<string>();
  for (let i = 0; i < n.length - 1; i++) out.add(n.slice(i, i + 2));
  if (n.length === 1) out.add(n);
  return out;
}
/** Dice 유사도 (0~1) */
function similarity(a: string, b: string): number {
  const A = bigrams(a);
  const B = bigrams(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const g of A) if (B.has(g)) inter++;
  return (2 * inter) / (A.size + B.size);
}
/** 이름·별칭 중 하나라도 정규화 일치하면 그 표준 반환 */
function exactMatch(
  name: string,
  types: DocCatalogOption[]
): DocCatalogOption | null {
  const n = norm(name);
  if (!n) return null;
  for (const t of types) {
    const names = [t.label_ko, ...((t.aliases ?? []) as string[])];
    if (names.some((x) => norm(x) === n)) return t;
  }
  return null;
}

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
  { value: "parents_employment_proof", label: "부모 재직증명서" },
  { value: "parents_income_proof", label: "부모 소득증명서" },
  // 건강
  { value: "tb_certificate", label: "결핵 진단서" },
  { value: "health_certificate", label: "건강진단서" },
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
  std_key: "",
});

export function RequiredDocumentsField({
  name,
  initial,
  docTypes = [],
}: {
  name: string;
  initial: RequiredDocument[];
  /** U3: 표준 발급서류 카탈로그(category=document). std 매핑 제안·선택용 */
  docTypes?: DocCatalogOption[];
}) {
  const [items, setItems] = useState<RequiredDocument[]>(initial);
  // 표준 발급서류 카탈로그 — "표준 추가/별칭 연결" 로 늘어날 수 있어 state 로 보관
  const [cat, setCat] = useState<DocCatalogOption[]>(docTypes);
  const [pending, startTransition] = useTransition();
  const [busyIdx, setBusyIdx] = useState<number | null>(null);

  const catByKey = useMemo(() => {
    const m = new Map<string, DocCatalogOption>();
    for (const t of cat) m.set(t.key, t);
    return m;
  }, [cat]);

  // 발급 서류의 표준 정본 키: 명시적 해제(__none__) → 없음, 저장값 우선, 없으면 이름·별칭 정확 매칭
  const effectiveStd = (d: RequiredDocument): string => {
    const saved = (d.std_key || "").trim();
    if (saved === "__none__") return "";
    if (saved) return saved;
    return exactMatch(d.name_ko, cat)?.key ?? "";
  };

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
  const patch = (idx: number, p: Partial<RequiredDocument>) =>
    setItems(items.map((d, i) => (i === idx ? { ...d, ...p } : d)));

  // 표준명으로 통일 (이름·베트남어명·std_key 를 표준으로 맞춤)
  const applyStandard = (idx: number, t: DocCatalogOption) =>
    patch(idx, {
      name_ko: t.label_ko,
      name_vi: t.label_vi ?? items[idx].name_vi ?? "",
      std_key: t.key,
    });

  // 현재 이름을 기존 표준의 별칭으로 연결 (변형 이름 통합) → 표준명으로 대체
  const connectAsAlias = (idx: number, t: DocCatalogOption) => {
    const alias = items[idx].name_ko.trim();
    setBusyIdx(idx);
    startTransition(async () => {
      const r = await addAliasToDataTypeAction({ key: t.key, alias });
      setBusyIdx(null);
      if (!r.ok) {
        toast.error("연결 실패", { description: r.error });
        return;
      }
      setCat((c) => c.map((x) => (x.key === r.type.key ? r.type : x)));
      applyStandard(idx, r.type);
      toast.success(`'${r.type.label_ko}' 표준에 연결했습니다.`);
    });
  };

  // 현재 이름을 새 표준 발급서류로 추가 → 연결
  const addAsNewStandard = (idx: number) => {
    const d = items[idx];
    const name = d.name_ko.trim();
    if (!name) {
      toast.error("서류명을 먼저 입력하세요.");
      return;
    }
    setBusyIdx(idx);
    startTransition(async () => {
      const r = await addDocumentDataTypeAction({
        name_ko: name,
        name_vi: d.name_vi ?? null,
      });
      setBusyIdx(null);
      if (!r.ok) {
        toast.error("표준 추가 실패", { description: r.error });
        return;
      }
      setCat((c) =>
        c.some((x) => x.key === r.type.key) ? c : [...c, r.type]
      );
      applyStandard(idx, r.type);
      toast.success(`표준 발급서류에 추가했습니다: ${r.type.label_ko}`);
    });
  };

  // 직렬화 — 빈 string 은 null 로 변환. 발급 서류는 std_key(저장값|자동제안) 캡처.
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
      std_key: isFormDoc(d) ? null : effectiveStd(d) || null,
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
                <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  #{idx + 1}
                  {isFormDoc(d) ? (
                    <Badge variant="secondary" className="text-[10px]">
                      직접작성
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">
                      발급
                    </Badge>
                  )}
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

              {/* 발급 서류 표준 매핑 — 이름 자동 매칭(직접작성은 불필요) */}
              {!isFormDoc(d) ? (
                <div className="mt-2">
                  {(() => {
                    const std = effectiveStd(d);
                    const matched = std ? catByKey.get(std) : null;
                    const isBusy = pending && busyIdx === idx;
                    if (matched) {
                      const sameName =
                        norm(d.name_ko) === norm(matched.label_ko);
                      return (
                        <div className="flex flex-wrap items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs">
                          <Check className="size-3.5 shrink-0 text-emerald-600" />
                          <span>
                            표준 발급서류:{" "}
                            <strong>{matched.label_ko}</strong>
                          </span>
                          {!sameName ? (
                            <button
                              type="button"
                              onClick={() => applyStandard(idx, matched)}
                              className="rounded border border-emerald-300 bg-white px-1.5 py-0.5 text-emerald-700 hover:bg-emerald-100"
                            >
                              표준명으로 통일
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => patch(idx, { std_key: "__none__" })}
                            className="ml-auto text-muted-foreground hover:underline"
                          >
                            해제
                          </button>
                        </div>
                      );
                    }
                    // 미매칭 — 유사 후보 + 새 표준 추가
                    const cands = cat
                      .map((t) => ({
                        t,
                        s: Math.max(
                          similarity(d.name_ko, t.label_ko),
                          ...((t.aliases ?? []) as string[]).map((a) =>
                            similarity(d.name_ko, a)
                          ),
                          0
                        ),
                      }))
                      .filter((x) => x.s >= 0.5)
                      .sort((a, b) => b.s - a.s)
                      .slice(0, 3);
                    return (
                      <div className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs">
                        <div className="mb-1 text-amber-800">
                          표준 발급서류에 없음
                          {d.name_ko.trim()
                            ? " — 같은 서류가 있으면 통합, 없으면 새로 추가하세요."
                            : " (서류명을 입력하세요)"}
                        </div>
                        {cands.length > 0 ? (
                          <div className="mb-1.5 flex flex-wrap gap-1.5">
                            {cands.map(({ t }) => (
                              <button
                                key={t.key}
                                type="button"
                                disabled={isBusy}
                                onClick={() => connectAsAlias(idx, t)}
                                className="rounded border border-input bg-white px-1.5 py-0.5 hover:bg-muted disabled:opacity-50"
                                title={`'${d.name_ko}' 을(를) '${t.label_ko}' 의 별칭으로 연결`}
                              >
                                ↔ {t.label_ko} 로 통합
                              </button>
                            ))}
                          </div>
                        ) : null}
                        <button
                          type="button"
                          disabled={isBusy || !d.name_ko.trim()}
                          onClick={() => addAsNewStandard(idx)}
                          className="inline-flex items-center gap-1 rounded border border-input bg-white px-1.5 py-0.5 hover:bg-muted disabled:opacity-50"
                        >
                          {isBusy ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <Plus className="size-3" />
                          )}
                          새 표준으로 추가
                        </button>
                      </div>
                    );
                  })()}
                </div>
              ) : null}
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
