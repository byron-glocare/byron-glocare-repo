/* DEMO: 텍스트 토큰 + 이미지(사진/서명) 주입 → 채움. */
const fs = require("fs");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const ImageModule = require("docxtemplater-image-module-free");

const SRC = "C:/Users/kajka/Downloads/2026학년도 외국인 특별전형 입학원서.docx";
const FILLED = "C:/Users/kajka/Downloads/입학원서_채움예시3_이미지포함.docx";
const PHOTO = "C:/Users/kajka/Downloads/photo.png";
const SIGN = "C:/Users/kajka/Downloads/sign.png";

for (const p of [SRC, PHOTO, SIGN]) {
  if (!fs.existsSync(p)) {
    console.log("MISSING:", p);
    process.exit(1);
  }
}

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

function injectTextTokens(xml) {
  const cells = [];
  const re = /<w:tc>[\s\S]*?<\/w:tc>/g;
  let m;
  while ((m = re.exec(xml)))
    cells.push({ raw: m[0], start: m.index, end: m.index + m[0].length });
  const inject = new Map();
  const used = new Set();
  for (let i = 0; i < cells.length; i++) {
    const key = MAP[cellText(cells[i].raw)];
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
  let out = xml;
  for (const [idx, key] of [...inject.entries()].sort((a, b) => b[0] - a[0])) {
    const c = cells[idx];
    const run = `<w:r><w:t xml:space="preserve">{{${key}}}</w:t></w:r>`;
    out = out.slice(0, c.start) + c.raw.replace(/<\/w:p>/, `${run}</w:p>`) + out.slice(c.end);
  }
  return out;
}

// 사진 칸의 "사진" 텍스트를 이미지 토큰으로 교체
function injectPhoto(xml) {
  return xml.replace(
    /(<w:tc>[\s\S]*?<w:t[^>]*>)사진(<\/w:t>)/,
    "$1{{%photo}}$2"
  );
}
// "(서명)" 뒤에 서명 이미지 토큰 추가
function injectSign(xml) {
  if (xml.includes("(서명)")) return xml.replace("(서명)", "(서명) {{%sign}}");
  return xml.replace("서명)", "서명) {{%sign}}");
}

function centerAll(xml) {
  xml = xml.replace(/<w:tcPr>([\s\S]*?)<\/w:tcPr>/g, (_m, i) => `<w:tcPr>${i.replace(/<w:vAlign[^>]*\/>/g, "")}<w:vAlign w:val="center"/></w:tcPr>`);
  xml = xml.replace(/<w:tc><w:p/g, '<w:tc><w:tcPr><w:vAlign w:val="center"/></w:tcPr><w:p');
  xml = xml.replace(/<w:pPr>([\s\S]*?)<\/w:pPr>/g, (_m, i) => `<w:pPr>${i.replace(/<w:jc[^>]*\/>/g, "")}<w:jc w:val="center"/></w:pPr>`);
  xml = xml.replace(/<w:p>(?!<w:pPr)/g, '<w:p><w:pPr><w:jc w:val="center"/></w:pPr>');
  xml = xml.replace(/(<w:p [^>]*>)(?!<w:pPr)/g, '$1<w:pPr><w:jc w:val="center"/></w:pPr>');
  return xml;
}

(() => {
  const zip = new PizZip(fs.readFileSync(SRC));
  let xml = zip.file("word/document.xml").asText();
  xml = injectTextTokens(xml);
  xml = injectPhoto(xml);
  xml = injectSign(xml);
  xml = centerAll(xml);
  zip.file("word/document.xml", xml);

  const imageModule = new ImageModule({
    centered: true,
    getImage: (tag) => fs.readFileSync(tag),
    getSize: (_img, _tag, name) =>
      name === "photo" ? [128, 165] : [150, 60],
  });
  const doc = new Docxtemplater(zip, {
    modules: [imageModule],
    delimiters: { start: "{{", end: "}}" },
    nullGetter: () => "",
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
    photo: PHOTO,
    sign: SIGN,
  });
  fs.writeFileSync(FILLED, doc.getZip().generate({ type: "nodebuffer" }));
  console.log("WROTE:", FILLED);
})();
