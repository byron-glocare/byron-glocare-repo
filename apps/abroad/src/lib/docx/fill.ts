import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

/**
 * DOCX 양식 자동 채움 엔진 (center, 실제 학생값).
 *   - 표에서 라벨 셀 인식 → 오른쪽 첫 빈칸을 값 자리로 보고 토큰 자동 주입
 *   - 표준데이터(데이터 메뉴) 매칭되는 라벨만 채움 (헤더·체크박스·고정문구 제외)
 *   - 값 셀만 가로·세로 가운데 정렬
 *   - docxtemplater 로 학생 실제값 치환
 *
 * match(정규화라벨) → {value} 이면 매칭(채움), null 이면 미매칭.
 */

export const normLabel = (s: string): string =>
  s.replace(/\s+/g, "").toLowerCase();

export type LabelMatch = { value: string };

const cellText = (tc: string): string =>
  (tc.match(/<w:t[ >][\s\S]*?<\/w:t>/g) || [])
    .map((t) => t.replace(/<[^>]+>/g, ""))
    .join("")
    .replace(/&amp;/g, "&")
    .trim();

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

function looksLikeLabel(t: string): boolean {
  if (!t) return false;
  if (t.length > 15) return false;
  if (/[□☑✓※]/.test(t)) return false;
  if (/^[\d\s\-.,()]+$/.test(t)) return false;
  if (/^\(.*\)$/.test(t)) return false;
  return true;
}

function injectTokens(
  xml: string,
  match: (normalizedLabel: string) => LabelMatch | null
): { xml: string; values: Record<string, string>; matchedCount: number } {
  const cells: { raw: string; start: number; end: number }[] = [];
  const re = /<w:tc>[\s\S]*?<\/w:tc>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)))
    cells.push({ raw: m[0], start: m.index, end: m.index + m[0].length });

  const plan = new Map<number, { key: string; value: string }>();
  const used = new Set<number>();
  let n = 0;
  for (let i = 0; i < cells.length; i++) {
    const label = cellText(cells[i].raw);
    if (!looksLikeLabel(label)) continue;
    let valueIdx = -1;
    for (let j = i + 1; j < cells.length; j++) {
      if (used.has(j)) continue;
      if (cellText(cells[j].raw) === "") {
        valueIdx = j;
        break;
      }
    }
    if (valueIdx < 0) continue;
    const mm = match(normLabel(label));
    if (mm) {
      const key = `f${n++}`;
      plan.set(valueIdx, { key, value: mm.value });
      used.add(valueIdx);
    }
  }

  const values: Record<string, string> = {};
  let out = xml;
  for (const [idx, info] of [...plan.entries()].sort((a, b) => b[0] - a[0])) {
    const c = cells[idx];
    out = out.slice(0, c.start) + transformValueCell(c.raw, info.key) + out.slice(c.end);
    values[info.key] = info.value;
  }
  return { xml: out, values, matchedCount: plan.size };
}

/** docx 버퍼 → 표준데이터 매칭 라벨에 학생 실제값 치환. */
export function fillDocx(
  srcBuf: Buffer,
  match: (normalizedLabel: string) => LabelMatch | null
): { filled: Buffer; matchedCount: number } {
  const zip = new PizZip(srcBuf);
  const docXml = zip.file("word/document.xml");
  if (!docXml) throw new Error("올바른 .docx 가 아닙니다.");

  const { xml, values, matchedCount } = injectTokens(docXml.asText(), match);
  zip.file("word/document.xml", xml);

  const doc = new Docxtemplater(zip, {
    delimiters: { start: "{{", end: "}}" },
    nullGetter: () => "",
  });
  doc.render(values);
  const filled = doc.getZip().generate({ type: "nodebuffer" }) as Buffer;
  return { filled, matchedCount };
}
