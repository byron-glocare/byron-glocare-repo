/**
 * CSV → src/data/visas.ts 변환기.
 *
 * 사용법:
 *   node apps/visa/scripts/import-visas.mjs "docs/visa requirement/visas.csv"
 *
 * CSV 규칙:
 *   - 1행은 헤더. 컬럼명은 아래 COLUMNS 와 일치해야 함.
 *   - 여러 항목(요건/서류/절차/유의사항)은 한 셀 안에서 줄바꿈 또는 " | " 로 구분.
 *   - 국적별 특이사항은 "국적::내용" 형태를 " | " 로 여러 개.
 *   - extendable 은 "Y"/"N" (또는 예/아니오).
 *
 * ⚠️ 실행하면 src/data/visas.ts 의 IS_SAMPLE_DATA 가 false 로 바뀌고
 *    VISAS 배열이 CSV 내용으로 통째로 교체됩니다.
 */
import fs from "node:fs";
import path from "node:path";

const COLUMNS = {
  code: "코드",
  nameKo: "한글명",
  nameEn: "영문명",
  category: "분류",
  summary: "요약",
  purpose: "목적",
  eligibility: "자격요건",
  requiredDocuments: "제출서류",
  duration: "체류기간",
  extendable: "연장가능",
  procedure: "신청절차",
  workAllowed: "취업활동",
  fee: "수수료",
  notes: "유의사항",
  nationalityNotes: "국적별특이사항",
  source: "출처",
  updatedAt: "기준일",
};

/** 아주 단순한 CSV 파서 (따옴표·줄바꿈 셀 지원). */
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\r") { /* skip */ }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const splitList = (s) =>
  (s || "")
    .split(/\n|\s\|\s/)
    .map((x) => x.trim())
    .filter(Boolean);

const csvPath = process.argv[2];
if (!csvPath) {
  console.error('사용법: node import-visas.mjs "<csv 경로>"');
  process.exit(1);
}

const raw = fs.readFileSync(csvPath, "utf8");
const rows = parseCSV(raw);
const header = rows[0].map((h) => h.trim());
const idx = {};
for (const [key, ko] of Object.entries(COLUMNS)) {
  idx[key] = header.indexOf(ko);
}

const visas = rows.slice(1).map((r) => {
  const get = (key) => (idx[key] >= 0 ? (r[idx[key]] ?? "").trim() : "");
  const ext = get("extendable").toLowerCase();
  return {
    code: get("code"),
    nameKo: get("nameKo"),
    nameEn: get("nameEn") || undefined,
    category: get("category"),
    summary: get("summary"),
    purpose: get("purpose"),
    eligibility: splitList(get("eligibility")),
    requiredDocuments: splitList(get("requiredDocuments")),
    duration: get("duration"),
    extendable: ext === "y" || ext === "예" || ext === "true" || ext === "o",
    procedure: splitList(get("procedure")),
    workAllowed: get("workAllowed") || undefined,
    fee: get("fee") || undefined,
    notes: splitList(get("notes")),
    nationalityNotes: splitList(get("nationalityNotes")).map((s) => {
      const [nationality, ...rest] = s.split("::");
      return { nationality: (nationality || "전체").trim(), note: rest.join("::").trim() };
    }),
    source: get("source") || undefined,
    updatedAt: get("updatedAt") || undefined,
  };
});

const out = `import type { VisaType } from "./types";

/** 자동 생성됨 — scripts/import-visas.mjs. 직접 수정하지 말 것. */
export const IS_SAMPLE_DATA = false;

export const VISAS: VisaType[] = ${JSON.stringify(visas, null, 2)};
`;

const scriptDir = path
  .dirname(new URL(import.meta.url).pathname)
  .replace(/^\/([A-Za-z]:)/, "$1");
const dest = process.argv[3] || path.join(scriptDir, "..", "src", "data", "visas.ts");
fs.writeFileSync(dest, out, "utf8");
console.log(`✓ ${visas.length}개 비자 → ${dest}`);
