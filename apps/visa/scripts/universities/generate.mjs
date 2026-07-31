/**
 * universities.ts 생성기.
 *   node apps/visa/scripts/universities/generate.mjs
 *
 * 입력(같은 폴더):
 *   studyinkorea_lists.txt  — 인증/우수인증/어학 인증 명단(studyinkorea, 2026-03)
 *   region_AB.json,region_C.json — 인증대학 소재지(수도권/비수도권) 조사결과
 *   namu_regions.json       — 나무위키 지역별 전 대학 목록(지역=페이지)
 *
 * 출력: apps/visa/src/data/universities.ts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(DIR, "..", "..", "src", "data", "universities.ts");
const read = (f) => fs.readFileSync(path.join(DIR, f), "utf8");

const base = (s) => s.replace(/\(.*?\)/g, "").replace(/\s+/g, "").replace(/남해캠퍼스|캠퍼스/g, "").trim();
const normReg = (s) => s.replace(/\(본교\)/g, "").replace(/\s+/g, "").trim();

// ── 1. 인증 데이터 ─────────────────────────────────────
const regionMap = {};
for (const f of ["region_AB.json", "region_C.json"]) {
  for (const r of JSON.parse(read(f))) regionMap[normReg(r.name)] = r.region;
}
const stFromHeader = (l) => (l.includes("일반대학") ? "univ" : l.includes("전문대학") ? "college" : l.includes("대학원") ? "grad" : null);
const stFromPrefix = (l) => (/^일반\s*:/.test(l) ? "univ" : /^전문\s*:/.test(l) ? "college" : /^대학원\s*:/.test(l) ? "grad" : null);

let bucket = null;
let headerSchool = null;
const degree = [], excellent = [], lang = [];
const T = { degree, excellent, lang };
const schoolTypeMap = {}; // normReg 이름 → univ/college/grad (학위 인증 섹션 먼저 만난 값 우선)
for (const raw of read("studyinkorea_lists.txt").split(/\r?\n/)) {
  const line = raw.trim();
  if (!line) continue;
  if (line.startsWith("==")) {
    bucket = line.includes("학위 인증") ? "degree" : line.includes("우수인증") ? "excellent" : line.includes("어학연수 인증") ? "lang" : null;
    headerSchool = bucket === "degree" ? stFromHeader(line) : null;
    continue;
  }
  if (!bucket) continue;
  const school = headerSchool || stFromPrefix(line);
  for (const nm of line.replace(/^(일반|전문|대학원)\s*:\s*/, "").split(",")) {
    const n = nm.trim();
    if (n && !/^\d+$/.test(n)) {
      T[bucket].push(n);
      const key = normReg(n);
      if (school && !schoolTypeMap[key]) schoolTypeMap[key] = school;
    }
  }
}
const excellentSet = new Set(excellent.map(normReg));
const langSet = new Set(lang.map(normReg));

const unis = [];
const certifiedBase = new Set();
const seen = new Set();
for (const name of degree) {
  const key = normReg(name);
  if (seen.has(key)) continue;
  seen.add(key);
  certifiedBase.add(base(name));
  unis.push({ name, region: regionMap[key] || "nonmetro", tier: excellentSet.has(key) ? "excellent" : "certified", lang: langSet.has(key), schoolType: schoolTypeMap[key] });
}

// ── 2. 나무위키 전 대학(미인증=general) ────────────────
const namu = JSON.parse(read("namu_regions.json"));
const metroNames = new Set(), nonmetroNames = new Set();
for (const arr of Object.values(namu.metro)) for (const n of arr) metroNames.add(n);
for (const arr of Object.values(namu.nonmetro)) for (const n of arr) nonmetroNames.add(n);

const BLACKLIST = new Set(["경찰대학", "국방대학교", "한국농수산대학교", "대우조선해양공과대학", "삼성중공업공과대학", "정석대학", "농협대학교", "중앙승가대학교", "한국전통문화대학교"]);
const isExcluded = (n) => BLACKLIST.has(n) || /교육대학교$/.test(n) || /의 대학교?$/.test(n) || /^(예술대학|공과대학|종합교원양성대학|대학원대학|교육대학|종교대학)$/.test(n);

const generalSeen = new Set();
for (const name of new Set([...metroNames, ...nonmetroNames])) {
  if (isExcluded(name) || certifiedBase.has(base(name))) continue;
  const b = base(name);
  if (generalSeen.has(b)) continue;
  generalSeen.add(b);
  unis.push({ name, region: nonmetroNames.has(name) ? "nonmetro" : "metro", tier: "general", lang: false });
}

// ── 3. 비자정밀 심사대학(restricted) — 사용자 제공 명단 오버라이드 ──
const RESTRICTED_DEGREE = new Set([
  "금강대학교", "수원가톨릭대학교", "중앙승가대학교", "협성대학교", "부산경상대학교", "부산예술대학교", "한영대학교",
  "구세군사관대학원대학교", "국제법률경영대학원대학교", "능인대학원대학교", "성서침례대학원대학교", "순복음대학원대학교",
  "에스라성경대학원대학교", "치유상담대학원대학교", "한국상담대학원대학교", "합동신학대학원대학교",
].map(base));
const RESTRICTED_LANG = new Set(["대구한의대학교", "상지대학교", "호원대학교", "목포과학대학교"].map(base));
// 목록에 없어 새로 추가(정밀심사) — region 은 판정에 영향 없음(정밀=차단), 대략치.
const ADD_RESTRICTED = [
  { name: "중앙승가대학교", region: "metro" },
  { name: "한영대학교", region: "nonmetro" },
  { name: "구세군사관대학원대학교", region: "metro" },
  { name: "국제법률경영대학원대학교", region: "metro" },
  { name: "능인대학원대학교", region: "metro" },
  { name: "성서침례대학원대학교", region: "nonmetro" },
  { name: "순복음대학원대학교", region: "metro" },
  { name: "에스라성경대학원대학교", region: "metro" },
  { name: "치유상담대학원대학교", region: "metro" },
  { name: "한국상담대학원대학교", region: "metro" },
  { name: "합동신학대학원대학교", region: "metro" },
];
for (const u of unis) {
  if (RESTRICTED_DEGREE.has(base(u.name))) u.tier = "restricted";
  if (RESTRICTED_LANG.has(base(u.name))) u.langRestricted = true;
}
for (const a of ADD_RESTRICTED) {
  if (!unis.some((u) => base(u.name) === base(a.name))) unis.push({ name: a.name, region: a.region, tier: "restricted", lang: false });
}

unis.sort((a, b) => a.name.localeCompare(b.name, "ko"));
const body = unis.map((u) => `  { name: ${JSON.stringify(u.name)}, region: ${JSON.stringify(u.region)}, tier: ${JSON.stringify(u.tier)}${u.schoolType ? `, schoolType: ${JSON.stringify(u.schoolType)}` : ""}${u.lang ? ", lang: true" : ""}${u.langRestricted ? ", langRestricted: true" : ""} },`).join("\n");

fs.writeFileSync(
  OUT,
  `import type { UnivRegion, UnivTier, SchoolType } from "./engine";

/**
 * 전국 대학 데이터셋.
 * - 인증/우수인증 + 어학연수 인증: studyinkorea 인증목록(2026-03) + 소재지 조사.
 * - 그 외(미인증=general): 나무위키 지역별 대학교 목록 + 소재지(페이지 기준).
 * 자동 생성물(scripts/universities/generate.mjs). 직접 수정 대신 생성 스크립트를 고칠 것.
 *
 * region:     metro=서울·인천·경기, nonmetro=그 외.
 * tier:       excellent=우수인증, certified=인증(학위과정), general=미인증, restricted=학위 정밀심사.
 * schoolType: univ=대학, college=전문대학, grad=대학원대학 (인증/우수인증에만 존재).
 * lang:       어학연수 인증대학 여부.
 * ⚠ restricted(비자정밀심사)는 별도 지정. general 소재지는 페이지 기준이라 일부 캠퍼스 오차 가능.
 */
export interface University {
  name: string;
  region: UnivRegion;
  tier: UnivTier; // 학위과정 등급 (restricted=학위 정밀심사)
  schoolType?: SchoolType; // 대학/전문대학/대학원 (인증·우수인증)
  lang?: boolean; // 어학연수 인증 여부
  langRestricted?: boolean; // 어학연수 정밀심사
}

export const UNIVERSITIES: University[] = [
${body}
];
`,
  "utf8"
);
const c = (t) => unis.filter((u) => u.tier === t).length;
console.log(`✓ ${unis.length}교 → excellent=${c("excellent")} certified=${c("certified")} general=${c("general")} | lang=${unis.filter((u) => u.lang).length} metro=${unis.filter((u) => u.region === "metro").length}`);
