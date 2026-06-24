/* DEMO: 파일1 docx 에 라벨→오른쪽 빈칸 감지로 토큰 자동 주입 → docxtemplater 로 더미값 치환.
 * 실행: node apps/abroad/scripts/docx-fill-demo.cjs  (abroad 의 pizzip/docxtemplater 사용) */
const fs = require("fs");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");

const SRC = "C:/Users/kajka/Downloads/2026학년도 외국인 특별전형 입학원서.docx";
const TOKENIZED = "C:/Users/kajka/Downloads/_demo_tokenized.docx";
const FILLED = "C:/Users/kajka/Downloads/입학원서_채움예시2_가운데정렬.docx";

// 라벨(셀 텍스트) → 표준데이터 키. 값은 라벨 셀의 "오른쪽 첫 빈칸"에 주입.
const MAP = {
  한글: "name_ko",
  영문: "name_en",
  수험번호: "exam_no",
  국적: "nationality",
  외국인등록번호: "alien_reg_no",
  여권번호: "passport_no",
  비자만기일: "visa_expiry",
  생년월일: "dob",
  지원학과: "dept",
};

const cellText = (tc) =>
  (tc.match(/<w:t[ >][\s\S]*?<\/w:t>/g) || [])
    .map((t) => t.replace(/<[^>]+>/g, ""))
    .join("")
    .replace(/&amp;/g, "&")
    .trim();

function injectTokens(xml) {
  // 모든 <w:tc> 를 순서대로 수집
  const cells = [];
  const re = /<w:tc>[\s\S]*?<\/w:tc>/g;
  let m;
  while ((m = re.exec(xml))) {
    cells.push({ raw: m[0], start: m.index, end: m.index + m[0].length });
  }
  // 라벨 → 오른쪽 첫 빈칸 매칭 (consume 방지)
  const inject = new Map(); // cellIndex → key
  const used = new Set();
  for (let i = 0; i < cells.length; i++) {
    const t = cellText(cells[i].raw);
    const key = MAP[t];
    if (!key) continue;
    for (let j = i + 1; j < cells.length; j++) {
      if (used.has(j)) continue;
      if (cellText(cells[j].raw) === "") {
        inject.set(j, key);
        used.add(j);
        break;
      }
    }
  }
  // 뒤에서부터 주입(인덱스 안 깨지게)
  let out = xml;
  const targets = [...inject.entries()].sort((a, b) => b[0] - a[0]);
  for (const [idx, key] of targets) {
    const c = cells[idx];
    const run = `<w:r><w:t xml:space="preserve">{{${key}}}</w:t></w:r>`;
    // 셀의 첫 </w:p> 앞에 run 삽입
    const newRaw = c.raw.replace(/<\/w:p>/, `${run}</w:p>`);
    out = out.slice(0, c.start) + newRaw + out.slice(c.end);
  }
  return { xml: out, injected: inject.size };
}

// 모든 표 셀 가로·세로 가운데 정렬
function centerAll(xml) {
  // 세로 가운데: tcPr 에 vAlign center (기존 vAlign 제거 후 끝에 추가)
  xml = xml.replace(/<w:tcPr>([\s\S]*?)<\/w:tcPr>/g, (_m, inner) => {
    const cleaned = inner.replace(/<w:vAlign[^>]*\/>/g, "");
    return `<w:tcPr>${cleaned}<w:vAlign w:val="center"/></w:tcPr>`;
  });
  // tcPr 없는 셀 → 추가
  xml = xml.replace(
    /<w:tc><w:p/g,
    '<w:tc><w:tcPr><w:vAlign w:val="center"/></w:tcPr><w:p'
  );
  // 가로 가운데: pPr 에 jc center (기존 jc 제거 후 추가)
  xml = xml.replace(/<w:pPr>([\s\S]*?)<\/w:pPr>/g, (_m, inner) => {
    const cleaned = inner.replace(/<w:jc[^>]*\/>/g, "");
    return `<w:pPr>${cleaned}<w:jc w:val="center"/></w:pPr>`;
  });
  // pPr 없는 문단 → 추가
  xml = xml.replace(/<w:p>(?!<w:pPr)/g, '<w:p><w:pPr><w:jc w:val="center"/></w:pPr>');
  xml = xml.replace(
    /(<w:p [^>]*>)(?!<w:pPr)/g,
    '$1<w:pPr><w:jc w:val="center"/></w:pPr>'
  );
  return xml;
}

(() => {
  const zip = new PizZip(fs.readFileSync(SRC));
  const docXmlPath = "word/document.xml";
  let xml = zip.file(docXmlPath).asText();

  const { xml: tokenXml, injected } = injectTokens(xml);
  console.log("주입된 토큰 수:", injected);
  const centered = centerAll(tokenXml);
  zip.file(docXmlPath, centered);
  fs.writeFileSync(TOKENIZED, zip.generate({ type: "nodebuffer" }));

  // 더미 학생값으로 치환
  const zip2 = new PizZip(fs.readFileSync(TOKENIZED));
  const doc = new Docxtemplater(zip2, {
    delimiters: { start: "{{", end: "}}" },
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => "", // 미매칭 토큰은 공백
  });
  doc.render({
    name_ko: "쩐 티 흐엉",
    name_en: "TRAN THI HUONG",
    exam_no: "2026-0001",
    nationality: "베트남",
    alien_reg_no: "040712-5xxxxxx",
    passport_no: "C45678901",
    visa_expiry: "2027-08-31",
    dob: "2004-07-12",
    dept: "간호학과",
  });
  fs.writeFileSync(FILLED, doc.getZip().generate({ type: "nodebuffer" }));
  console.log("WROTE:", FILLED);
})();
