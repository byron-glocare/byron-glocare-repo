import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

/**
 * DOCX 양식 자동 채움 엔진 (텍스트, v3 — 모든 칸 슬롯).
 *   - 모든 표 셀(<w:tc>)이 슬롯. 빈 칸 = 값 자리(＋), 내용 있는 칸도 클릭해 덮어쓰기 가능.
 *   - 값 결정 우선순위: a{전체셀번호}(직접 배치, 덮어쓰기) → {빈칸번호}(레거시 빈칸 배치)
 *     → 라벨 추론 자동매칭(빈칸만).
 *   - 값 셀만 가로·세로 가운데 정렬. docxtemplater 로 텍스트 치환.
 */

/** 라벨 정규화: 공백 제거 + 소문자 */
export const normLabel = (s: string): string =>
  s.replace(/\s+/g, "").toLowerCase();

/**
 * 슬롯 값 해석기.
 *   allIndex=전체 셀 번호, emptyIndex=빈칸이면 빈칸 번호(아니면 null), labelNorm=추론 앞 라벨.
 *   overwrite=true 면 칸 기존 내용을 지우고 값으로 덮어씀(내용 있는 칸 배치용).
 */
export type SlotResolve = (ctx: {
  allIndex: number;
  emptyIndex: number | null;
  labelNorm: string | null;
}) => { value: string; viaLabel: boolean; overwrite: boolean } | null;

const cellText = (tc: string): string =>
  (tc.match(/<w:t[ >][\s\S]*?<\/w:t>/g) || [])
    .map((t) => t.replace(/<[^>]+>/g, ""))
    .join("")
    .replace(/&amp;/g, "&")
    .trim();

type CellPos = { raw: string; start: number; end: number };
function readCells(xml: string): { cells: CellPos[]; texts: string[] } {
  const cells: CellPos[] = [];
  const re = /<w:tc>[\s\S]*?<\/w:tc>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)))
    cells.push({ raw: m[0], start: m.index, end: m.index + m[0].length });
  return { cells, texts: cells.map((c) => cellText(c.raw)) };
}

/**
 * 값 셀: vAlign center + 첫 문단 jc center + innerRun 주입.
 *   overwrite=true 면 첫 문단 기존 run 제거 후 주입(덮어쓰기).
 */
function putCell(raw: string, innerRun: string, overwrite: boolean): string {
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
      let pPr = "";
      let rest = inner;
      const pm = inner.match(/^(<w:pPr>[\s\S]*?<\/w:pPr>)([\s\S]*)$/);
      if (pm) {
        pPr = pm[1];
        rest = pm[2];
      }
      if (pPr)
        pPr = pPr.replace(
          /<w:pPr>([\s\S]*?)<\/w:pPr>/,
          (_x, pi: string) =>
            `<w:pPr>${pi.replace(/<w:jc[^>]*\/>/g, "")}<w:jc w:val="center"/></w:pPr>`
        );
      else pPr = `<w:pPr><w:jc w:val="center"/></w:pPr>`;
      const keep = overwrite ? "" : rest;
      return po + pPr + keep + innerRun + pc;
    }
  );
  return r;
}

const tokenRun = (tokenKey: string): string =>
  `<w:r><w:t xml:space="preserve">{{${tokenKey}}}</w:t></w:r>`;

/** 슬롯 채움: a키/레거시빈칸키/라벨 폴백을 resolve 가 판단 → 토큰 주입. */
function injectTokens(
  xml: string,
  resolve: SlotResolve
): { xml: string; values: Record<string, string> } {
  const { cells, texts } = readCells(xml);
  const plan = new Map<number, { key: string; value: string; overwrite: boolean }>();
  const usedLabel = new Set<number>();
  let n = 0;
  let emptyIndex = -1;
  for (let i = 0; i < cells.length; i++) {
    const empty = texts[i] === "";
    if (empty) emptyIndex++;
    let labelIdx = -1;
    let labelNorm: string | null = null;
    if (empty) {
      for (let j = i - 1; j >= 0; j--) {
        if (texts[j] !== "") {
          labelIdx = j;
          break;
        }
      }
      if (labelIdx >= 0 && !usedLabel.has(labelIdx)) labelNorm = normLabel(texts[labelIdx]);
    }
    const res = resolve({ allIndex: i, emptyIndex: empty ? emptyIndex : null, labelNorm });
    if (!res) continue;
    if (res.viaLabel && labelIdx >= 0) usedLabel.add(labelIdx);
    plan.set(i, { key: `f${n++}`, value: res.value, overwrite: res.overwrite });
  }

  const values: Record<string, string> = {};
  let out = xml;
  for (const [idx, info] of [...plan.entries()].sort((a, b) => b[0] - a[0])) {
    const c = cells[idx];
    out =
      out.slice(0, c.start) +
      putCell(c.raw, tokenRun(info.key), info.overwrite) +
      out.slice(c.end);
    values[info.key] = info.value;
  }
  return { xml: out, values };
}

/** docx 버퍼 → 슬롯 해석기로 값 채움. */
export function tokenizeAndFillDocx(
  srcBuf: Buffer,
  resolve: SlotResolve
): { filled: Buffer } {
  const zip = new PizZip(srcBuf);
  const docXml = zip.file("word/document.xml");
  if (!docXml) throw new Error("올바른 .docx 가 아닙니다 (word/document.xml 없음).");

  const { xml, values } = injectTokens(docXml.asText(), resolve);
  zip.file("word/document.xml", xml);

  const doc = new Docxtemplater(zip, {
    delimiters: { start: "{{", end: "}}" },
    nullGetter: () => "",
  });
  doc.render(values);
  const filled = doc.getZip().generate({ type: "nodebuffer" }) as Buffer;
  return { filled };
}

/**
 * 배치 편집기용 슬롯 정보.
 *   slot=전체 셀 번호, emptyIndex=빈칸 번호(아니면 null), empty=빈칸 여부, hint=칸 식별용.
 */
export type SlotInfo = {
  slot: number;
  emptyIndex: number | null;
  empty: boolean;
  hint: string;
};

/** 셀 안에 슬롯 마커(⟦S0⟧…) 주입 (전체 셀 번호 기준) */
function injectMarkerIntoCell(raw: string, slot: number): string {
  const marker = `<w:r><w:t xml:space="preserve">⟦S${slot}⟧</w:t></w:r>`;
  if (/<w:p\b[^>]*\/>/.test(raw))
    return raw.replace(/<w:p\b([^>]*)\/>/, (_m, a: string) => `<w:p${a}>${marker}</w:p>`);
  if (/<\/w:p>/.test(raw)) return raw.replace(/<\/w:p>/, marker + "</w:p>");
  return raw.replace(/<\/w:tc>/, `<w:p>${marker}</w:p></w:tc>`);
}

/** 모든 셀에 슬롯 마커 주입 + 슬롯 목록 반환 (빈칸 ＋ / 내용칸 모서리 추가). */
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
  let emptyIndex = -1;
  for (let i = 0; i < cells.length; i++) {
    const empty = texts[i] === "";
    if (empty) emptyIndex++;
    let hint = texts[i];
    if (empty) {
      for (let j = i - 1; j >= 0; j--) {
        if (texts[j] !== "") {
          hint = texts[j];
          break;
        }
      }
    }
    slots.push({ slot: i, emptyIndex: empty ? emptyIndex : null, empty, hint });
    edits.push({
      start: cells[i].start,
      end: cells[i].end,
      raw: injectMarkerIntoCell(cells[i].raw, i),
    });
  }
  let out = xml;
  for (const e of [...edits].sort((a, b) => b.start - a.start))
    out = out.slice(0, e.start) + e.raw + out.slice(e.end);
  zip.file("word/document.xml", out);
  return { buf: zip.generate({ type: "nodebuffer" }) as Buffer, slots };
}
