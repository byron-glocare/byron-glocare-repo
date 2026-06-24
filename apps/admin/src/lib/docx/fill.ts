import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

/**
 * DOCX 양식 자동 채움 엔진 (텍스트, v1).
 *   - 표(table)에서 라벨 셀을 인식 → 오른쪽 첫 빈칸을 값 자리로 보고 토큰 자동 주입
 *   - **표준데이터(데이터 메뉴)에 매칭되는 라벨만** 채운다 (학생마다 달라지는 값에 집중).
 *     헤더·고정문구·체크박스는 자동 제외. 고정값(체크 등)은 관리자가 미리 채워 올린다.
 *   - 값 셀만 가로·세로 가운데 정렬 (양식 원래 부분은 그대로)
 *   - docxtemplater 로 값 치환
 *
 * match(정규화라벨) → {dummy} 이면 매칭(채움), null 이면 미매칭(별칭 추가 후보).
 */

/** 라벨 정규화: 공백 제거 + 소문자 (예: "이 메 일" → "이메일") */
export const normLabel = (s: string): string =>
  s.replace(/\s+/g, "").toLowerCase();

export type LabelMatch = { dummy: string };

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

/**
 * 표 라벨 → 오른쪽 첫 빈칸. 표준데이터 매칭만 토큰 주입.
 * @returns 토큰화 xml + 매칭/미매칭 라벨 목록
 */
function injectTokens(
  xml: string,
  match: (normalizedLabel: string) => LabelMatch | null
): { xml: string; matched: { label: string }[]; unmatched: string[] } {
  const cells: { raw: string; start: number; end: number }[] = [];
  const re = /<w:tc>[\s\S]*?<\/w:tc>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)))
    cells.push({ raw: m[0], start: m.index, end: m.index + m[0].length });

  const plan = new Map<number, { key: string; dummy: string }>();
  const used = new Set<number>();
  const matched: { label: string }[] = [];
  const unmatchedSet = new Set<string>();
  let n = 0;
  for (let i = 0; i < cells.length; i++) {
    const label = cellText(cells[i].raw);
    if (!looksLikeLabel(label)) continue;
    // 오른쪽 첫 빈칸 찾기
    let valueIdx = -1;
    for (let j = i + 1; j < cells.length; j++) {
      if (used.has(j)) continue;
      if (cellText(cells[j].raw) === "") {
        valueIdx = j;
        break;
      }
    }
    if (valueIdx < 0) continue; // 빈칸 없으면 입력칸 아님
    const mm = match(normLabel(label));
    if (mm) {
      const key = `f${n++}`;
      plan.set(valueIdx, { key, dummy: mm.dummy });
      used.add(valueIdx);
      matched.push({ label });
    } else {
      unmatchedSet.add(label); // 빈칸은 있는데 표준데이터에 없음 → 별칭 후보
    }
  }
  const values: Record<string, string> = {};
  let out = xml;
  for (const [idx, info] of [...plan.entries()].sort((a, b) => b[0] - a[0])) {
    const c = cells[idx];
    out = out.slice(0, c.start) + transformValueCell(c.raw, info.key) + out.slice(c.end);
    values[info.key] = info.dummy;
  }
  return { xml: out, matched, unmatched: [...unmatchedSet], values };
}

/**
 * docx 버퍼 → 표준데이터 매칭 라벨만 토큰화 + 더미값 채움.
 * @param match 정규화 라벨 → {dummy} (매칭) / null (미매칭)
 */
export function tokenizeAndFillDocx(
  srcBuf: Buffer,
  match: (normalizedLabel: string) => LabelMatch | null
): { filled: Buffer; matched: string[]; unmatched: string[] } {
  const zip = new PizZip(srcBuf);
  const docXml = zip.file("word/document.xml");
  if (!docXml) throw new Error("올바른 .docx 가 아닙니다 (word/document.xml 없음).");

  const { xml, matched, unmatched, values } = injectTokens(
    docXml.asText(),
    match
  );
  zip.file("word/document.xml", xml);

  const doc = new Docxtemplater(zip, {
    delimiters: { start: "{{", end: "}}" },
    nullGetter: () => "",
  });
  doc.render(values);

  const filled = doc.getZip().generate({ type: "nodebuffer" }) as Buffer;
  return { filled, matched: matched.map((m) => m.label), unmatched };
}
