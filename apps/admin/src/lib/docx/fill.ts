import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

/**
 * DOCX 양식 자동 채움 엔진 (텍스트, v2 — 슬롯 중심).
 *   - 표(table)의 **빈 셀(값 슬롯)** 을 문서 순서대로 0,1,2… 로 번호 매김.
 *   - 각 슬롯의 값은 두 가지로 결정:
 *       1) 슬롯 매핑(관리자가 미리보기에서 빈칸을 직접 클릭해 지정) — "어디에"를 명시.
 *       2) 없으면 라벨 추론(바로 앞 비어있지 않은 셀)으로 표준데이터 자동 매칭(폴백).
 *   - 값 셀만 가로·세로 가운데 정렬 (양식 원래 부분은 그대로). docxtemplater 로 치환.
 */

/** 라벨 정규화: 공백 제거 + 소문자 (예: "이 메 일" → "이메일") */
export const normLabel = (s: string): string =>
  s.replace(/\s+/g, "").toLowerCase();

/**
 * 슬롯 값 해석기. slot=빈칸 번호, labelNorm=추론된 앞 라벨(없으면 null).
 *   viaLabel=true 면 라벨 폴백으로 매칭된 것(라벨 1개=값 1개 규칙에 사용).
 */
export type SlotResolve = (ctx: {
  slot: number;
  labelNorm: string | null;
}) => { value: string; viaLabel: boolean } | null;

const cellText = (tc: string): string =>
  (tc.match(/<w:t[ >][\s\S]*?<\/w:t>/g) || [])
    .map((t) => t.replace(/<[^>]+>/g, ""))
    .join("")
    .replace(/&amp;/g, "&")
    .trim();

/** 값 셀: vAlign center + 첫 문단 jc center + 토큰 주입 (이 셀만) */
function transformValueCell(raw: string, tokenKey: string): string {
  let r = raw;
  if (/<w:tcPr>/.test(r))
    r = r.replace(
      /<w:tcPr>([\s\S]*?)<\/w:tcPr>/,
      (_m, i: string) =>
        `<w:tcPr>${i.replace(/<w:vAlign[^>]*\/>/g, "")}<w:vAlign w:val="center"/></w:tcPr>`
    );
  else r = r.replace(/<w:tc>/, '<w:tc><w:tcPr><w:vAlign w:val="center"/></w:tcPr>');

  let done = false;
  r = r.replace(
    /(<w:p(?: [^>]*)?>)([\s\S]*?)(<\/w:p>)/,
    (m, po: string, inner: string, pc: string) => {
      if (done) return m;
      done = true;
      let body = inner;
      if (/<w:pPr>/.test(body))
        body = body.replace(
          /<w:pPr>([\s\S]*?)<\/w:pPr>/,
          (_x, pi: string) =>
            `<w:pPr>${pi.replace(/<w:jc[^>]*\/>/g, "")}<w:jc w:val="center"/></w:pPr>`
        );
      else body = `<w:pPr><w:jc w:val="center"/></w:pPr>` + body;
      return po + body + `<w:r><w:t xml:space="preserve">{{${tokenKey}}}</w:t></w:r>` + pc;
    }
  );
  return r;
}

/** 라벨로 인정할지 — 짧은 텍스트 + 체크박스/안내문/숫자만 등은 제외 */
function looksLikeLabel(t: string): boolean {
  if (!t) return false;
  if (t.length > 15) return false;
  if (/[□☑✓※]/.test(t)) return false; // 체크박스/주석
  if (/^[\d\s\-.,()]+$/.test(t)) return false; // 숫자·기호만
  if (/^\(.*\)$/.test(t)) return false; // (대학에서기재) 같은 안내
  return true;
}

// 옵션·헤더·기관명 등 "학생 변수 필드가 아닌" 라벨 키워드
const NOT_A_FIELD =
  /전형|학과|대학|졸업|출신|선발|균형|기회|외국인|새터민|농어촌|수료|동의|협회|정보원|어플라이|금융|구분|정원|장애|만학도|재외|특별|일반|기타|특기|고교|검정|모집|지원자|해당|대상|연계|학부|전공|과정/;

/** 미매칭 후보로 보여줄 만한가 — 노이즈(긴 문구·옵션·기관명) 제거 */
function plausibleFieldLabel(t: string): boolean {
  if (/\s/.test(t)) return false; // 공백 포함 = 문구/옵션
  if (t.length < 2 || t.length > 8) return false;
  if (/[()]/.test(t)) return false;
  if (NOT_A_FIELD.test(t)) return false;
  return true;
}

/** 감지된 채움 후보 칸. strong=노이즈필터 통과(자동추천 대상), false=수동 매핑용으로만 노출. */
export type DocxFieldCandidate = { label: string; strong: boolean };

/**
 * docx 에서 "채울 수 있는 라벨 칸"(라벨 → 오른쪽 빈칸)을 감지. 라벨↔표준데이터 표 UI 용.
 *   - 빈칸이 오른쪽에 있는 **모든 셀**을 후보로 반환 (관리자가 수동 매핑할 수 있도록).
 * @returns 중복 제거된 후보 목록(문서 순서)
 */
export function detectDocxFields(srcBuf: Buffer): DocxFieldCandidate[] {
  const zip = new PizZip(srcBuf);
  const docXml = zip.file("word/document.xml");
  if (!docXml) return [];
  const xml = docXml.asText();
  const texts: string[] = [];
  const re = /<w:tc>[\s\S]*?<\/w:tc>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) texts.push(cellText(m[0]));

  const used = new Set<number>();
  const seen = new Map<string, boolean>(); // label → strong
  const order: string[] = [];
  for (let i = 0; i < texts.length; i++) {
    const label = texts[i];
    if (!label) continue; // 빈 셀은 라벨 아님
    let valueIdx = -1;
    for (let j = i + 1; j < texts.length; j++) {
      if (used.has(j)) continue;
      if (texts[j] === "") {
        valueIdx = j;
        break;
      }
    }
    if (valueIdx < 0) continue; // 빈칸 없으면 채울 수 없음
    used.add(valueIdx);
    const strong = looksLikeLabel(label);
    if (!seen.has(label)) {
      seen.set(label, strong);
      order.push(label);
    } else if (strong && !seen.get(label)) {
      seen.set(label, true);
    }
  }
  return order.map((label) => ({ label, strong: seen.get(label) ?? false }));
}

type CellPos = { raw: string; start: number; end: number };

function readCells(xml: string): { cells: CellPos[]; texts: string[] } {
  const cells: CellPos[] = [];
  const re = /<w:tc>[\s\S]*?<\/w:tc>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)))
    cells.push({ raw: m[0], start: m.index, end: m.index + m[0].length });
  return { cells, texts: cells.map((c) => cellText(c.raw)) };
}

/** 슬롯(빈 셀)을 순서대로 돌며 resolve 로 값 결정 → 토큰 주입. */
function injectTokens(
  xml: string,
  resolve: SlotResolve
): {
  xml: string;
  values: Record<string, string>;
  matched: string[];
  unmatched: string[];
} {
  const { cells, texts } = readCells(xml);
  const plan = new Map<number, { key: string; value: string }>();
  const usedLabel = new Set<number>();
  const matched: string[] = [];
  const unmatchedSet = new Set<string>();
  let n = 0;
  let slot = -1;
  for (let i = 0; i < cells.length; i++) {
    if (texts[i] !== "") continue; // 값 슬롯 = 빈 셀만
    slot++;
    // 라벨 추론: 바로 앞 비어있지 않은 셀(아직 라벨로 안 쓰인 것)
    let labelIdx = -1;
    for (let j = i - 1; j >= 0; j--) {
      if (texts[j] !== "") {
        labelIdx = j;
        break;
      }
    }
    const labelNorm =
      labelIdx >= 0 && !usedLabel.has(labelIdx) ? normLabel(texts[labelIdx]) : null;
    const res = resolve({ slot, labelNorm });
    if (res) {
      const key = `f${n++}`;
      plan.set(i, { key, value: res.value });
      if (res.viaLabel && labelIdx >= 0) {
        usedLabel.add(labelIdx);
        matched.push(texts[labelIdx]);
      }
    } else if (labelIdx >= 0) {
      const lt = texts[labelIdx];
      if (looksLikeLabel(lt) && plausibleFieldLabel(lt)) unmatchedSet.add(lt);
    }
  }

  const values: Record<string, string> = {};
  let out = xml;
  for (const [idx, info] of [...plan.entries()].sort((a, b) => b[0] - a[0])) {
    const c = cells[idx];
    out = out.slice(0, c.start) + transformValueCell(c.raw, info.key) + out.slice(c.end);
    values[info.key] = info.value;
  }
  return { xml: out, values, matched, unmatched: [...unmatchedSet] };
}

/**
 * docx 버퍼 → 슬롯 해석기로 값 채움.
 * @param resolve 슬롯/추론라벨 → {value, viaLabel} (채움) / null (건너뜀)
 */
export function tokenizeAndFillDocx(
  srcBuf: Buffer,
  resolve: SlotResolve
): { filled: Buffer; matched: string[]; unmatched: string[] } {
  const zip = new PizZip(srcBuf);
  const docXml = zip.file("word/document.xml");
  if (!docXml) throw new Error("올바른 .docx 가 아닙니다 (word/document.xml 없음).");

  const { xml, values, matched, unmatched } = injectTokens(docXml.asText(), resolve);
  zip.file("word/document.xml", xml);

  const doc = new Docxtemplater(zip, {
    delimiters: { start: "{{", end: "}}" },
    nullGetter: () => "",
  });
  doc.render(values);

  const filled = doc.getZip().generate({ type: "nodebuffer" }) as Buffer;
  return { filled, matched, unmatched };
}

/** 빈칸 클릭 배치 편집기용 슬롯 정보. hint=앞 라벨(어느 칸인지 힌트). */
export type SlotInfo = { slot: number; hint: string };

/** 빈 셀 안에 마커(⟦S0⟧…)를 넣어 미리보기에서 클릭 가능한 칩으로 만든다. */
function injectMarkerIntoCell(raw: string, slot: number): string {
  const marker = `<w:r><w:t xml:space="preserve">⟦S${slot}⟧</w:t></w:r>`;
  if (/<w:p\b[^>]*\/>/.test(raw))
    return raw.replace(/<w:p\b([^>]*)\/>/, (_m, a: string) => `<w:p${a}>${marker}</w:p>`);
  if (/<\/w:p>/.test(raw)) return raw.replace(/<\/w:p>/, marker + "</w:p>");
  return raw.replace(/<\/w:tc>/, `<w:p>${marker}</w:p></w:tc>`);
}

/**
 * 모든 빈 셀(값 슬롯)에 슬롯 마커를 주입한 docx 와 슬롯 목록 반환.
 *   클라이언트가 docx-preview 로 렌더 → 마커를 클릭 가능한 칩으로 치환해 배치 편집.
 */
export function injectSlotMarkers(srcBuf: Buffer): {
  buf: Buffer;
  slots: SlotInfo[];
} {
  const zip = new PizZip(srcBuf);
  const docXml = zip.file("word/document.xml");
  if (!docXml) throw new Error("올바른 .docx 가 아닙니다 (word/document.xml 없음).");
  const xml = docXml.asText();
  const { cells, texts } = readCells(xml);

  const slots: SlotInfo[] = [];
  const edits: { start: number; end: number; raw: string }[] = [];
  let slot = -1;
  for (let i = 0; i < cells.length; i++) {
    if (texts[i] !== "") continue;
    slot++;
    let labelIdx = -1;
    for (let j = i - 1; j >= 0; j--) {
      if (texts[j] !== "") {
        labelIdx = j;
        break;
      }
    }
    slots.push({ slot, hint: labelIdx >= 0 ? texts[labelIdx] : "" });
    edits.push({
      start: cells[i].start,
      end: cells[i].end,
      raw: injectMarkerIntoCell(cells[i].raw, slot),
    });
  }
  let out = xml;
  for (const e of [...edits].sort((a, b) => b.start - a.start))
    out = out.slice(0, e.start) + e.raw + out.slice(e.end);
  zip.file("word/document.xml", out);
  return { buf: zip.generate({ type: "nodebuffer" }) as Buffer, slots };
}
