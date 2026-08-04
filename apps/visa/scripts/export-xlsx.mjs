/**
 * 서류/조항/대학 데이터셋을 엑셀(.xlsx)로 내보낸다.
 *   node apps/visa/scripts/export-xlsx.mjs
 * 출력: docs/visa requirement/글로케어_비자_데이터셋.xlsx
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";
import { DOCUMENTS_DATA } from "../../../packages/visa-core/src/data/documents.ts";
import { UNIVERSITIES } from "../../../packages/visa-core/src/data/universities.ts";
import { ANN } from "../../../packages/visa-core/src/data/annotations.ts";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(DIR, "..", "..", ".."); // repo root
const RULES = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/visa requirement/rules.json"), "utf8"));
const ruleById = Object.fromEntries(RULES.rules.map((r) => [r.id, r]));
const OUT = path.join(ROOT, "docs/visa requirement/글로케어_비자_데이터셋.xlsx");

/* ── 포맷 헬퍼 ── */
const WHO = { self: "본인", father: "아버지", mother: "어머니", family: "부모 외 가족", kr_family: "한국 국적 가족", professor: "지도교수", company: "회사", institution: "기관 발급", na: "-" };
const LOGIC = { oneOf: "택1", allOf: "모두", anyOf: "1인 이상", na: "-" };
const CONF = { confirmed: "확인됨", inferred: "유추", conflict: "자료충돌", unknown: "미확인" };
const REGION = { metro: "수도권", nonmetro: "비수도권" };
const TIER = { excellent: "우수인증", certified: "인증", general: "미인증(일반)", consulting: "컨설팅대학", restricted: "비자정밀 심사대학" };

const holderWho = (h) => (h ? h.who.map((w) => WHO[w] ?? w).join(" / ") : "");
const holderRel = (h) => (h ? LOGIC[h.logic] ?? h.logic : "");
const validityStr = (v) => {
  if (!v) return "";
  if (v.byStage?.length) return v.byStage.map((s) => `${s.stage} ${s.days}일`).join(" / ") + (v.note ? ` · ${v.note}` : "");
  if (v.days) return `${v.days}일${v.basis ? ` (${v.basis} 기준)` : ""}${v.note ? ` · ${v.note}` : ""}`;
  return v.note ?? "";
};
const transStr = (t) => (!t ? "" : t.required ? `필요 (${(t.langs ?? ["ko", "en"]).map((l) => (l === "ko" ? "국문" : "영문")).join("/")})${t.note ? " · " + t.note : ""}` : "불요");
const notarStr = (n) => (n?.required ? `필요${n.by ? " · " + n.by : ""}` : "");
const authStr = (a) => (a?.required ? `${(a.chain ?? []).join(" → ")}${a.validityDays ? ` (${a.validityDays}일 이내)` : ""}${a.note ? " · " + a.note : ""}` : "");
const sigStr = (s) => (s?.handwrittenOnly ? `친필 서명 원본만${s.note ? " · " + s.note : ""}` : "");
const condStr = (obj) => (!obj ? "" : Object.entries(obj).map(([k, v]) => `${k}=${v.join("|")}`).join("; "));
const whenStr = (r) => [r.when ? condStr(r.when) : "", r.whenNot ? "제외:" + condStr(r.whenNot) : ""].filter(Boolean).join(" / ");

/* ── 시트 1: 서류 상세 (서류 × 연결조항, 펼침) ── */
const flat = [];
for (const d of DOCUMENTS_DATA) {
  const refs = d.ruleRefs?.length ? d.ruleRefs : [null];
  for (const rid of refs) {
    const r = rid ? ruleById[rid] : null;
    flat.push({
      카테고리: d.category,
      서류ID: d.id,
      서류명: d.name,
      발급기관: d.issuer.join(", "),
      형식: d.form + (d.bringOriginal ? " (원본지참)" : ""),
      유효기간: validityStr(d.validity),
      "명의_주체": holderWho(d.holder),
      "명의_관계": holderRel(d.holder),
      "명의_모호": d.holder?.ambiguous ? "★확인필요" : "",
      "명의_설명": d.holder?.note ?? "",
      번역: transStr(d.translation),
      공증: notarStr(d.notarization),
      영사확인: authStr(d.authentication),
      서명: sigStr(d.signature),
      발급소요일: d.obtainDays ?? "미상",
      적용대상: d.appliesTo ?? "",
      서류확신도: CONF[d.confidence] ?? d.confidence,
      확인필요사항: (d.ambiguities ?? []).join(" / "),
      조항ID: rid ?? "",
      조항그룹: r?.group ?? "",
      조항종류: r?.kind ?? "",
      조항요약: r ? ANN[rid]?.terse ?? r.title : "",
      조항조건: r ? whenStr(r) : "",
      조항원문: r?.body ?? "",
      조항확신도: r ? CONF[r.confidence] ?? r.confidence : "",
    });
  }
}

/* ── 시트 2: 서류 마스터 (정규화) ── */
const master = DOCUMENTS_DATA.map((d) => ({
  카테고리: d.category,
  서류ID: d.id,
  서류명: d.name,
  발급기관: d.issuer.join(", "),
  형식: d.form,
  원본지참: d.bringOriginal ? "O" : "",
  유효기간: validityStr(d.validity),
  "명의_주체": holderWho(d.holder),
  "명의_관계": holderRel(d.holder),
  "명의_모호": d.holder?.ambiguous ? "★확인필요" : "",
  "명의_설명": d.holder?.note ?? "",
  번역: transStr(d.translation),
  공증: notarStr(d.notarization),
  영사확인: authStr(d.authentication),
  서명: sigStr(d.signature),
  발급소요일: d.obtainDays ?? "미상",
  적용대상: d.appliesTo ?? "",
  확신도: CONF[d.confidence] ?? d.confidence,
  근거조항: (d.ruleRefs ?? []).join(", "),
  확인필요: (d.ambiguities ?? []).join(" / "),
}));

/* ── 시트 3: 조항(rules) ── */
const groupsLabel = RULES.groups;
const rulesSheet = RULES.rules.map((r) => ({
  조항ID: r.id,
  그룹: groupsLabel[r.group]?.label ?? r.group,
  종류: r.kind,
  제목: r.title,
  요약: ANN[r.id]?.terse ?? "",
  조건: whenStr(r),
  값: r.value ? JSON.stringify(r.value) : "",
  원문: r.body,
  확신도: CONF[r.confidence] ?? r.confidence,
  출처: (r.sources ?? []).join(", "),
}));

/* ── 시트 4: 명의(holder) 요약 ── */
const holderSheet = DOCUMENTS_DATA.filter((d) => d.holder && d.holder.logic !== "na").map((d) => ({
  카테고리: d.category,
  서류명: d.name,
  "허용 명의": holderWho(d.holder),
  관계: holderRel(d.holder) + (d.holder.who.length > 1 ? ` (여러 주체 중 ${holderRel(d.holder)})` : ""),
  "모호(확인필요)": d.holder.ambiguous ? "★" : "",
  설명: d.holder.note ?? "",
}));

/* ── 시트 5: 대학 ── */
const uniSheet = UNIVERSITIES.map((u) => ({ 대학명: u.name, 소재: REGION[u.region], 인증등급: TIER[u.tier], 어학연수인증: u.lang ? "O" : "" }));

/* ── 시트 6: 안내(범례) ── */
const legend = [
  ["항목", "설명"],
  ["출처", "본 데이터는 공개된 재외공관 구비서류 안내 + 정부 보도자료를 근거로 재구성. 사증 발급은 영사 재량이며 공관장이 서류를 가감할 수 있음."],
  ["확신도", "확인됨=1차/공관 자료 명문 · 유추=동일조건 타 공관 자료로 추정 · 자료충돌=문서버전 간 값 상이(보수적 적용) · 미확인=확인 못함(요건 없음으로 간주 금지)"],
  ["명의_관계", "택1=나열된 주체 중 1인 명의로 준비 · 모두=각각 제출(AND) · 1인 이상=합산 가능"],
  ["명의_모호(★)", "원문이 AND/OR 를 명확히 안 해 준비량이 갈리는 항목. 관할 공관 확인 필요."],
  ["소재(대학)", "수도권=서울·인천·경기 / 비수도권=그 외. 예치 기준액이 갈림(학위 2,000 vs 1,600만원)."],
  ["인증등급", "우수인증/인증=studyinkorea 목록 · 미인증=나무위키 전국대학 · 컨설팅/비자정밀=별도 지정(피커 수동선택)"],
  ["미확정(전문가 자료 대기)", "발급소요일 대부분 미상 · 하노이 관할 영사확인 체인 · 잔고증명 공관 유효기간(10일 vs 1개월 충돌)"],
  ["", ""],
  ["시트 안내", ""],
  ["서류_상세(펼침)", "서류 × 연결조항 1행씩. 서류 정보가 반복됨(의도적)."],
  ["서류_마스터", "서류 1건 = 1행(정규화)."],
  ["조항", "발급요건 룰셋 96개 조항 원문."],
  ["명의_요약", "명의 AND/OR 핵심 표(★=확인필요)."],
  ["대학", "전국 336교(등급·소재)."],
];

/* ── 워크북 ── */
const wb = XLSX.utils.book_new();
const add = (name, rows, cols) => {
  const ws = Array.isArray(rows[0]) ? XLSX.utils.aoa_to_sheet(rows) : XLSX.utils.json_to_sheet(rows);
  if (cols) ws["!cols"] = cols;
  XLSX.utils.book_append_sheet(wb, ws, name);
};
const w = (n) => ({ wch: n });
add("안내", legend, [w(22), w(90)]);
add("서류_상세(펼침)", flat, [w(10), w(16), w(20), w(16), w(14), w(28), w(18), w(9), w(10), w(40), w(24), w(18), w(28), w(20), w(14), w(40), w(10), w(30), w(9), w(10), w(9), w(40), w(28), w(50), w(9)]);
add("서류_마스터", master, [w(10), w(16), w(20), w(16), w(8), w(8), w(28), w(18), w(9), w(10), w(40), w(24), w(18), w(28), w(20), w(14), w(40), w(9), w(24), w(40)]);
add("조항", rulesSheet, [w(10), w(14), w(12), w(34), w(44), w(30), w(20), w(60), w(9), w(16)]);
add("명의_요약", holderSheet, [w(10), w(20), w(24), w(20), w(12), w(46)]);
add("대학", uniSheet, [w(24), w(10), w(14), w(12)]);

XLSX.writeFile(wb, OUT);
console.log(`✓ ${OUT}`);
console.log(`  서류상세 ${flat.length}행 · 서류 ${master.length} · 조항 ${rulesSheet.length} · 명의 ${holderSheet.length} · 대학 ${uniSheet.length}`);
