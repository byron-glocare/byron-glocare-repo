/**
 * U2: 모집요강에서 파생된 발급서류 ↔ 등록된 발급서류(공용 마스터 / 대학별 조정본) 매칭.
 *
 *   원칙: 표준데이터가 정본.
 *   - 공용 마스터(university_id IS NULL): 비자·공통 발급서류의 표준 원본.
 *   - 대학별 조정본(base_submission_id = 공용 id): 그 대학만의 세부조건 override.
 *
 *   매칭 우선순위:
 *     1) 대학별(조정본/전용) — std_key → 이름/별칭
 *     2) 공용 표준         — std_key → 이름/별칭
 *     3) 미매칭            — 신규 등록 필요
 *
 *   std_key(0027) 가 채워지기 전에는 이름/별칭으로 매칭한다(폴백).
 */

import { normalizeDocName } from "./classify-documents";

export type SubmissionLite = {
  id: string;
  university_id: number | null;
  base_submission_id: string | null;
  name_ko: string;
  std_key: string | null;
  aliases: string[];
  sample_image_url: string | null;
  status: string;
};

export type IssuedMatch = {
  /** university = 대학별(조정본/전용), shared = 공용 표준, unmatched = 미등록 */
  kind: "university" | "shared" | "unmatched";
  /** 매칭된 발급서류(대학별 또는 공용). 미매칭이면 null */
  submission: SubmissionLite | null;
  /** 공용 매칭이거나 대학 조정본이면 그 공용 마스터(표시/조정 권유용) */
  master: SubmissionLite | null;
};

export type SubmissionIndex = {
  uniByStd: Map<string, SubmissionLite>;
  uniByName: Map<string, SubmissionLite>;
  sharedByStd: Map<string, SubmissionLite>;
  sharedByName: Map<string, SubmissionLite>;
  sharedById: Map<string, SubmissionLite>;
};

export function buildSubmissionIndex(
  subs: SubmissionLite[]
): SubmissionIndex {
  const idx: SubmissionIndex = {
    uniByStd: new Map(),
    uniByName: new Map(),
    sharedByStd: new Map(),
    sharedByName: new Map(),
    sharedById: new Map(),
  };
  for (const s of subs) {
    const isShared = s.university_id == null;
    if (isShared) idx.sharedById.set(s.id, s);
    const byStd = isShared ? idx.sharedByStd : idx.uniByStd;
    const byName = isShared ? idx.sharedByName : idx.uniByName;
    if (s.std_key && !byStd.has(s.std_key)) byStd.set(s.std_key, s);
    for (const n of [s.name_ko, ...(s.aliases ?? [])]) {
      const key = normalizeDocName(n);
      if (key && !byName.has(key)) byName.set(key, s);
    }
  }
  return idx;
}

export function matchIssuedDoc(
  doc: { name_ko: string; std_key?: string | null; aliases?: string[] },
  idx: SubmissionIndex
): IssuedMatch {
  const stdKey = doc.std_key ?? null;
  const names = [doc.name_ko, ...(doc.aliases ?? [])]
    .map(normalizeDocName)
    .filter(Boolean);

  // 1) 대학별 우선
  let uni: SubmissionLite | undefined;
  if (stdKey) uni = idx.uniByStd.get(stdKey);
  if (!uni)
    for (const n of names) {
      uni = idx.uniByName.get(n);
      if (uni) break;
    }
  if (uni) {
    const master = uni.base_submission_id
      ? idx.sharedById.get(uni.base_submission_id) ?? null
      : null;
    return { kind: "university", submission: uni, master };
  }

  // 2) 공용 표준
  let shared: SubmissionLite | undefined;
  if (stdKey) shared = idx.sharedByStd.get(stdKey);
  if (!shared)
    for (const n of names) {
      shared = idx.sharedByName.get(n);
      if (shared) break;
    }
  if (shared) return { kind: "shared", submission: shared, master: shared };

  return { kind: "unmatched", submission: null, master: null };
}
