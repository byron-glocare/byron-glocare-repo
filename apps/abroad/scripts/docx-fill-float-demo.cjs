/* DEMO v3: 값 셀만 가운데정렬 + 플로팅 이미지(사진=글자앞, 서명=글자뒤), 박스 변형 없음. */
const fs = require("fs");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");

const SRC = "C:/Users/kajka/Downloads/2026학년도 외국인 특별전형 입학원서.docx";
const OUT = "C:/Users/kajka/Downloads/입학원서_채움예시4_플로팅.docx";
const PHOTO = "C:/Users/kajka/Downloads/photo.png";
const SIGN = "C:/Users/kajka/Downloads/sign.png";
const CM = 360000; // 1cm = 360000 EMU

const MAP = {
  한글: "name_ko", 영문: "name_en", 수험번호: "exam_no", 국적: "nationality",
  외국인등록번호: "alien_reg_no", 여권번호: "passport_no", 비자만기일: "visa_expiry",
  생년월일: "dob", 지원학과: "dept",
};

const cellText = (tc) =>
  (tc.match(/<w:t[ >][\s\S]*?<\/w:t>/g) || [])
    .map((t) => t.replace(/<[^>]+>/g, "")).join("").replace(/&amp;/g, "&").trim();

// 값 셀: vAlign center + 첫 문단 jc center + 토큰 주입 (이 셀만)
function transformValueCell(raw, key) {
  let r = raw;
  if (/<w:tcPr>/.test(r))
    r = r.replace(/<w:tcPr>([\s\S]*?)<\/w:tcPr>/, (_m, i) =>
      `<w:tcPr>${i.replace(/<w:vAlign[^>]*\/>/g, "")}<w:vAlign w:val="center"/></w:tcPr>`);
  else r = r.replace(/<w:tc>/, '<w:tc><w:tcPr><w:vAlign w:val="center"/></w:tcPr>');

  let done = false;
  r = r.replace(/(<w:p(?: [^>]*)?>)([\s\S]*?)(<\/w:p>)/, (m, po, inner, pc) => {
    if (done) return m; done = true;
    let body = inner;
    if (/<w:pPr>/.test(body))
      body = body.replace(/<w:pPr>([\s\S]*?)<\/w:pPr>/, (_x, pi) =>
        `<w:pPr>${pi.replace(/<w:jc[^>]*\/>/g, "")}<w:jc w:val="center"/></w:pPr>`);
    else body = `<w:pPr><w:jc w:val="center"/></w:pPr>` + body;
    return po + body + `<w:r><w:t xml:space="preserve">{{${key}}}</w:t></w:r>` + pc;
  });
  return r;
}

function injectTextTokens(xml) {
  const cells = [];
  const re = /<w:tc>[\s\S]*?<\/w:tc>/g; let m;
  while ((m = re.exec(xml))) cells.push({ raw: m[0], start: m.index, end: m.index + m[0].length });
  const inject = new Map(); const used = new Set();
  for (let i = 0; i < cells.length; i++) {
    const key = MAP[cellText(cells[i].raw)]; if (!key) continue;
    for (let j = i + 1; j < cells.length; j++) {
      if (used.has(j)) continue;
      if (cellText(cells[j].raw) === "") { inject.set(j, key); used.add(j); break; }
    }
  }
  let out = xml;
  for (const [idx, key] of [...inject.entries()].sort((a, b) => b[0] - a[0])) {
    const c = cells[idx];
    out = out.slice(0, c.start) + transformValueCell(c.raw, key) + out.slice(c.end);
  }
  return out;
}

// 앵커(플로팅) 이미지 run
function floatDrawing({ rId, id, name, cx, cy, behind }) {
  const rel = behind ? "1" : "251658240";
  return `<w:r><w:drawing><wp:anchor xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="${rel}" behindDoc="${behind ? "1" : "0"}" locked="0" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="column"><wp:posOffset>0</wp:posOffset></wp:positionH><wp:positionV relativeFrom="paragraph"><wp:posOffset>0</wp:posOffset></wp:positionV><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/><wp:docPr id="${id}" name="${name}"/><wp:cNvGraphicFramePr/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${id}" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r>`;
}

// 사진 셀("사진" 텍스트 유지)의 첫 문단에 사진 앵커 삽입
function injectPhotoFloat(xml, run) {
  const re = /<w:tc>[\s\S]*?<\/w:tc>/g; let m;
  while ((m = re.exec(xml))) {
    if (cellText(m[0]) === "사진") {
      const newCell = m[0].replace(/<\/w:p>/, `${run}</w:p>`);
      return xml.slice(0, m.index) + newCell + xml.slice(m.index + m[0].length);
    }
  }
  return xml;
}
// "(서명)" 들어있는 문단에 서명 앵커 삽입
function injectSignFloat(xml, run) {
  const idx = xml.indexOf("서명)");
  if (idx < 0) return xml;
  const close = xml.indexOf("</w:p>", idx);
  if (close < 0) return xml;
  return xml.slice(0, close) + run + xml.slice(close);
}

(() => {
  for (const p of [SRC, PHOTO, SIGN]) if (!fs.existsSync(p)) { console.log("MISSING", p); process.exit(1); }
  const zip = new PizZip(fs.readFileSync(SRC));
  let xml = zip.file("word/document.xml").asText();

  // 1) 텍스트 토큰(값 셀만 가운데정렬)
  xml = injectTextTokens(xml);

  // 2) 미디어 + 관계 추가
  zip.file("word/media/img_photo.png", fs.readFileSync(PHOTO));
  zip.file("word/media/img_sign.png", fs.readFileSync(SIGN));
  const relsPath = "word/_rels/document.xml.rels";
  let rels = zip.file(relsPath).asText();
  const rIdPhoto = "rIdImgPhoto900", rIdSign = "rIdImgSign901";
  rels = rels.replace(/<\/Relationships>/,
    `<Relationship Id="${rIdPhoto}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/img_photo.png"/>` +
    `<Relationship Id="${rIdSign}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/img_sign.png"/></Relationships>`);
  zip.file(relsPath, rels);

  // png Content-Type 보장
  const ctPath = "[Content_Types].xml";
  let ct = zip.file(ctPath).asText();
  if (!/Extension="png"/.test(ct))
    ct = ct.replace(/<\/Types>/, '<Default Extension="png" ContentType="image/png"/></Types>');
  zip.file(ctPath, ct);

  // 3) 플로팅 이미지 주입 (사진=앞, 서명=뒤 / 작게)
  const photoRun = floatDrawing({ rId: rIdPhoto, id: 900, name: "photo", cx: 2.3 * CM, cy: 3.0 * CM, behind: false });
  const signRun = floatDrawing({ rId: rIdSign, id: 901, name: "sign", cx: 3.2 * CM, cy: 1.1 * CM, behind: true });
  xml = injectPhotoFloat(xml, photoRun);
  xml = injectSignFloat(xml, signRun);

  zip.file("word/document.xml", xml);

  // 4) 텍스트 치환
  const doc = new Docxtemplater(zip, { delimiters: { start: "{{", end: "}}" }, nullGetter: () => "" });
  doc.render({
    name_ko: "쩐 티 흐엉", name_en: "TRAN THI HUONG", exam_no: "2026-0001",
    nationality: "베트남", alien_reg_no: "040712-5xxxxxx", passport_no: "C45678901",
    visa_expiry: "2027-08-31", dob: "2004-07-12", dept: "간호학과",
  });
  fs.writeFileSync(OUT, doc.getZip().generate({ type: "nodebuffer" }));
  console.log("WROTE:", OUT);
})();
