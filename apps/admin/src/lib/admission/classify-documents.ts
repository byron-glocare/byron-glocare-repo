/**
 * 모집요강 required_documents → 직접작성(form) / 발급(issued) 자동 분류.
 *
 *   원칙: 표준데이터가 정본. 모집요강의 서류를 표준 카탈로그에 맞춰 분류한다.
 *   - 직접작성(form) = 학교 양식(학생/관리자가 양식에 채워 제출).
 *       키가 양식 세트에 속하거나, notes 에 '본교 양식/학교 양식' 명시.
 *   - 발급(issued)  = 그 외 전부(여권·졸업/성적·가족관계·잔고·TOPIK·사진·국적·경력 등).
 *       대부분 비자 규정 공통이라 공용 표준 발급서류로 재활용.
 */

/** 학교 양식(직접작성) 키 — study_admission_form_files.key 와 동일 계열 */
export const FORM_DOC_KEYS = new Set<string>([
  "application_form",
  "self_intro",
  "study_plan",
  "financial_pledge_form",
  "privacy_consent",
  "academic_record_release",
  "recommendation_letter",
  // health_certificate 는 대부분 병원 발급 → 발급으로 분류(운영자 결정)
]);

export type RequiredDoc = {
  key?: string | null;
  name_ko?: string | null;
  name_vi?: string | null;
  notes?: string | null;
  notarization?: string | null;
  required?: boolean | null;
  target_person?: string | null;
  language?: string | null;
};

export type ClassifiedDoc = {
  key: string;
  name_ko: string;
  notes: string | null;
  notarization: string | null;
  required: boolean;
  kind: "form" | "issued";
};

const FORM_NOTE_RE = /(본교\s*양식|학교\s*양식|소정\s*양식|본교양식)/;

export function isFormDoc(doc: RequiredDoc): boolean {
  const key = (doc.key ?? "").trim();
  if (FORM_DOC_KEYS.has(key)) return true;
  if (doc.notes && FORM_NOTE_RE.test(doc.notes)) return true;
  return false;
}

/**
 * required_documents 배열을 분류·정규화한다.
 *   - 빈 name_ko 는 제외
 *   - (key + name_ko) 기준 중복 제거 (예: 본인/부모 여권사본은 name_ko 가 달라 둘 다 유지)
 */
export function classifyRequiredDocs(docs: RequiredDoc[] | null | undefined): {
  forms: ClassifiedDoc[];
  issued: ClassifiedDoc[];
} {
  const forms: ClassifiedDoc[] = [];
  const issued: ClassifiedDoc[] = [];
  const seen = new Set<string>();

  for (const d of docs ?? []) {
    const name = (d.name_ko ?? "").trim();
    if (!name) continue;
    const key = (d.key ?? "other").trim() || "other";
    const dedup = `${key}::${name}`;
    if (seen.has(dedup)) continue;
    seen.add(dedup);

    const item: ClassifiedDoc = {
      key,
      name_ko: name,
      notes: d.notes ?? null,
      notarization: d.notarization ?? null,
      required: d.required !== false,
      kind: isFormDoc(d) ? "form" : "issued",
    };
    (item.kind === "form" ? forms : issued).push(item);
  }

  return { forms, issued };
}

/** 이름 정규화 — 발급서류 매칭용 */
export function normalizeDocName(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}
