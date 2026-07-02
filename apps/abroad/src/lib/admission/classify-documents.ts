/**
 * 모집요강 required_documents → 직접작성(form) / 발급(issued) 자동 분류.
 *   admin 의 동일 로직 미러(표준데이터가 정본). abroad 서류 등록 화면에서 사용.
 *   - 직접작성(form) = 학교 양식(정보입력으로 시스템 작성 가능, 업로드는 선택).
 *   - 발급(issued)  = 그 외(여권·졸업/성적 등) — 업로드 필수(우선순위 높음).
 */

export const FORM_DOC_KEYS = new Set<string>([
  "application_form",
  "self_intro",
  "study_plan",
  "financial_pledge_form",
  "privacy_consent",
  "academic_record_release",
  "recommendation_letter",
]);

export type RequiredDoc = {
  key?: string | null;
  name_ko?: string | null;
  name_vi?: string | null;
  notes?: string | null;
  notarization?: string | null;
  required?: boolean | null;
  language?: string | null;
  group?: string | null;
  std_key?: string | null;
};

export type ClassifiedDoc = {
  key: string;
  name_ko: string;
  name_vi: string | null;
  notes: string | null;
  notarization: string | null;
  required: boolean;
  kind: "form" | "issued";
  /** 공용 표준 연결 (있으면 대학 간 같은 서류로 취급 가능) */
  std_key: string | null;
};

const FORM_NOTE_RE = /(본교\s*양식|학교\s*양식|소정\s*양식|본교양식)/;

export function isFormDoc(doc: RequiredDoc): boolean {
  const key = (doc.key ?? "").trim();
  if (FORM_DOC_KEYS.has(key)) return true;
  if ((doc.group ?? "").trim() === "university_form") return true;
  if (doc.notes && FORM_NOTE_RE.test(doc.notes)) return true;
  return false;
}

/**
 * required_documents 배열을 분류·정규화.
 *   - 빈 name_ko 제외
 *   - (key + name_ko) 기준 중복 제거 (본인/부모 여권 등 이름이 다르면 둘 다 유지)
 *   - 안정적 식별자(uploadKey)는 호출부에서 key||name 기준으로 생성
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
      name_vi: (d.name_vi ?? "").trim() || null,
      notes: d.notes ?? null,
      notarization: d.notarization ?? null,
      required: d.required !== false,
      kind: isFormDoc(d) ? "form" : "issued",
      std_key: (d.std_key ?? "").trim() || null,
    };
    (item.kind === "form" ? forms : issued).push(item);
  }

  return { forms, issued };
}

/**
 * 학생 업로드 식별용 안정 키. (key + 정규화 이름)
 *   같은 key 라도 이름이 다른 문서(본인/부모 여권)를 구분.
 */
export function docUploadKey(d: { key: string; name_ko: string }): string {
  const name = d.name_ko.trim().replace(/\s+/g, " ").toLowerCase();
  return `${d.key}::${name}`;
}

/**
 * 대학 간 공유 업로드 키.
 *   공용 표준(std_key)에 연결된 발급 서류는 대학이 달라도 같은 서류 —
 *   단 인증(공증·아포스티유 등) 요건이 다르면 다른 파일이어야 하므로 키에 포함.
 *   std 연결이 없으면 기존 key::name 키 그대로 (이름·키가 같아야만 공유).
 */
export function docShareKey(d: {
  key: string;
  name_ko: string;
  std_key: string | null;
  notarization: string | null;
}): string {
  if (d.std_key) {
    const sig = (d.notarization ?? "").trim() || "none";
    return `std::${d.std_key}::${sig}`;
  }
  return docUploadKey(d);
}
