import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

/**
 * DOCX 양식 자동 채움 엔진 (텍스트, v1).
 *   - 표(table)에서 라벨 셀을 인식 → 오른쪽 첫 빈칸을 값 자리로 보고 토큰 자동 주입
 *   - 값 셀만 가로·세로 가운데 정렬 (양식 원래 부분은 그대로)
 *   - docxtemplater 로 학생값 치환
 *
 * 지금은 테스트 도구용으로 "라벨 사전(LABEL_DUMMY)" 의 더미값으로 채운다.
 * 사전에 없는 라벨도 감지되면 [라벨] 마커로 채워 감지 범위를 눈으로 확인할 수 있다.
 */

// 흔한 입학원서 라벨 → 더미값 (테스트용)
const LABEL_DUMMY: Record<string, string> = {
  한글: "쩐 티 흐엉",
  영문: "TRAN THI HUONG",
  성명: "쩐 티 흐엉",
  수험번호: "2026-0001",
  국적: "베트남",
  외국인등록번호: "040712-5XXXXXX",
  여권번호: "C45678901",
  비자만기일: "2027-08-31",
  생년월일: "2004-07-12",
  성별: "여",
  지원학과: "간호학과",
  관계: "부",
  소속대학: "하노이대학교",
};

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

type Detected = { label: string; tokenKey: string; dummy: string };

/** 라벨로 인정할지 — 짧은 텍스트 + 체크박스/안내문/숫자만 등은 제외 */
function looksLikeLabel(t: string): boolean {
  if (!t) return false;
  if (t.length > 15) return false;
  if (/[□☑✓※]/.test(t)) return false; // 체크박스/주석
  if (/^[\d\s\-.,()]+$/.test(t)) return false; // 숫자·기호만
  if (/^\(.*\)$/.test(t)) return false; // (대학에서기재) 같은 안내
  return true;
}

/** 표 라벨 → 오른쪽 첫 빈칸에 토큰 주입. 감지 목록 + 토큰화 xml 반환. */
function injectTokens(xml: string): { xml: string; detected: Detected[] } {
  const cells: { raw: string; start: number; end: number }[] = [];
  const re = /<w:tc>[\s\S]*?<\/w:tc>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)))
    cells.push({ raw: m[0], start: m.index, end: m.index + m[0].length });

  const plan = new Map<number, { key: string; label: string }>();
  const used = new Set<number>();
  const detected: Detected[] = [];
  let n = 0;
  for (let i = 0; i < cells.length; i++) {
    const label = cellText(cells[i].raw);
    // 사전 없이도 일반 감지: 라벨처럼 보이는 셀 → 오른쪽 첫 빈칸
    if (!looksLikeLabel(label)) continue;
    for (let j = i + 1; j < cells.length; j++) {
      if (used.has(j)) continue;
      if (cellText(cells[j].raw) === "") {
        const key = `f${n++}`;
        plan.set(j, { key, label });
        used.add(j);
        detected.push({
          label,
          tokenKey: key,
          dummy: LABEL_DUMMY[label] ?? `[${label}]`,
        });
        break;
      }
    }
  }

  let out = xml;
  for (const [idx, info] of [...plan.entries()].sort((a, b) => b[0] - a[0])) {
    const c = cells[idx];
    out = out.slice(0, c.start) + transformValueCell(c.raw, info.key) + out.slice(c.end);
  }
  return { xml: out, detected };
}

/** docx 버퍼 → 자동 토큰화 + 더미값 채움. { filled, detected } 반환. */
export function tokenizeAndFillDocx(srcBuf: Buffer): {
  filled: Buffer;
  detected: Detected[];
} {
  const zip = new PizZip(srcBuf);
  const docXml = zip.file("word/document.xml");
  if (!docXml) throw new Error("올바른 .docx 가 아닙니다 (word/document.xml 없음).");

  const { xml, detected } = injectTokens(docXml.asText());
  zip.file("word/document.xml", xml);

  const doc = new Docxtemplater(zip, {
    delimiters: { start: "{{", end: "}}" },
    nullGetter: () => "",
  });
  const values: Record<string, string> = {};
  for (const d of detected) values[d.tokenKey] = d.dummy;
  doc.render(values);

  const filled = doc.getZip().generate({ type: "nodebuffer" }) as Buffer;
  return { filled, detected };
}
