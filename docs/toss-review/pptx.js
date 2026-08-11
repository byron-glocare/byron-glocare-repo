/**
 * 최소 PresentationML(.pptx) 작성기.
 *
 * pptxgenjs 를 설치할 수 없는 환경이라 OOXML 을 직접 만든다.
 * 필요한 기능만 담았다 — 16:9 빈 레이아웃 한 장에 사각형·텍스트·이미지를 얹는 수준.
 *
 * 좌표 단위는 EMU(1인치 = 914400). 슬라이드는 13.333 x 7.5 인치.
 */

const JSZip = require("jszip");

const EMU_PER_IN = 914400;
const SLIDE_W = Math.round(13.333 * EMU_PER_IN);
const SLIDE_H = Math.round(7.5 * EMU_PER_IN);

const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS_P =
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
  'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';

/** 도형 한 개(사각형 + 선택적 텍스트). */
function shapeXml(id, s) {
  const {
    x,
    y,
    w,
    h,
    fill = null,
    line = null,
    lineW = 12700,
    text = [],
    align = "l",
    anchor = "t",
    inset = 91440, // 0.1in
  } = s;

  const body = text
    .map((p) => {
      const runs = (Array.isArray(p.runs) ? p.runs : [p]).map((r) => {
        const props =
          `<a:rPr lang="ko-KR" altLang="en-US" sz="${r.size ?? 1400}"` +
          `${r.bold ? ' b="1"' : ""} dirty="0">` +
          `<a:solidFill><a:srgbClr val="${r.color ?? "1A1D21"}"/></a:solidFill>` +
          `<a:latin typeface="맑은 고딕"/><a:ea typeface="맑은 고딕"/>` +
          `<a:cs typeface="맑은 고딕"/></a:rPr>`;
        return `<a:r>${props}<a:t>${esc(r.t ?? "")}</a:t></a:r>`;
      });
      const algn = p.align ?? align;
      const pPr = p.spaceBefore
        ? `<a:pPr algn="${algn}"><a:spcBef><a:spcPts val="${p.spaceBefore}"/></a:spcBef></a:pPr>`
        : `<a:pPr algn="${algn}"/>`;
      return `<a:p>${pPr}${runs.join("")}</a:p>`;
    })
    .join("");

  const fillXml = fill
    ? `<a:solidFill><a:srgbClr val="${fill}"/></a:solidFill>`
    : "<a:noFill/>";
  const lineXml = line
    ? `<a:ln w="${lineW}"><a:solidFill><a:srgbClr val="${line}"/></a:solidFill></a:ln>`
    : "<a:ln><a:noFill/></a:ln>";

  return (
    `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="sp${id}"/>` +
    `<p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>` +
    `<p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${fillXml}${lineXml}</p:spPr>` +
    `<p:txBody><a:bodyPr wrap="square" lIns="${inset}" tIns="${inset}" ` +
    `rIns="${inset}" bIns="${inset}" anchor="${anchor}"><a:normAutofit/></a:bodyPr>` +
    `<a:lstStyle/>${body || "<a:p/>"}</p:txBody></p:sp>`
  );
}

function picXml(id, rid, p) {
  return (
    `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="pic${id}"/>` +
    `<p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>` +
    `<p:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>` +
    `<p:spPr><a:xfrm><a:off x="${p.x}" y="${p.y}"/><a:ext cx="${p.w}" cy="${p.h}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>` +
    `<a:ln w="9525"><a:solidFill><a:srgbClr val="C9CED6"/></a:solidFill></a:ln></p:spPr></p:pic>`
  );
}

const THEME = `${DECL}<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office">
<a:themeElements><a:clrScheme name="Office"><a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="44546A"/></a:dk2><a:lt2><a:srgbClr val="E7E6E6"/></a:lt2><a:accent1><a:srgbClr val="3D6BFF"/></a:accent1><a:accent2><a:srgbClr val="ED7D31"/></a:accent2><a:accent3><a:srgbClr val="A5A5A5"/></a:accent3><a:accent4><a:srgbClr val="FFC000"/></a:accent4><a:accent5><a:srgbClr val="5B9BD5"/></a:accent5><a:accent6><a:srgbClr val="70AD47"/></a:accent6><a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme>
<a:fontScheme name="Office"><a:majorFont><a:latin typeface="맑은 고딕"/><a:ea typeface="맑은 고딕"/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="맑은 고딕"/><a:ea typeface="맑은 고딕"/><a:cs typeface=""/></a:minorFont></a:fontScheme>
<a:fmtScheme name="Office"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme>
</a:themeElements></a:theme>`;

const SLIDE_MASTER = `${DECL}<p:sldMaster ${NS_P}><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>`;

const SLIDE_LAYOUT = `${DECL}<p:sldLayout ${NS_P} type="blank" preserve="1"><p:cSld name="빈 화면"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;

/**
 * @param {Array<{shapes:Array, image?:{buf:Buffer, x:number,y:number,w:number,h:number}}>} slides
 */
async function buildPptx(slides, { title = "결제경로" } = {}) {
  const zip = new JSZip();
  const media = [];

  zip.file(
    "_rels/.rels",
    `${DECL}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`
  );

  zip.file(
    "docProps/core.xml",
    `${DECL}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(title)}</dc:title><dc:creator>GLOCARE</dc:creator><cp:lastModifiedBy>GLOCARE</cp:lastModifiedBy></cp:coreProperties>`
  );

  zip.file("ppt/theme/theme1.xml", THEME);
  zip.file("ppt/slideMasters/slideMaster1.xml", SLIDE_MASTER);
  zip.file(
    "ppt/slideMasters/_rels/slideMaster1.xml.rels",
    `${DECL}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>`
  );
  zip.file("ppt/slideLayouts/slideLayout1.xml", SLIDE_LAYOUT);
  zip.file(
    "ppt/slideLayouts/_rels/slideLayout1.xml.rels",
    `${DECL}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`
  );

  slides.forEach((s, i) => {
    const n = i + 1;
    let id = 2;
    let body = "";
    let rels = `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>`;

    for (const sh of s.shapes ?? []) body += shapeXml(id++, sh);

    if (s.image) {
      const idx = media.length + 1;
      media.push(s.image.buf);
      zip.file(`ppt/media/image${idx}.png`, s.image.buf);
      rels += `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image${idx}.png"/>`;
      body += picXml(id++, "rId2", s.image);
    }

    zip.file(
      `ppt/slides/slide${n}.xml`,
      `${DECL}<p:sld ${NS_P}><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${body}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`
    );
    zip.file(
      `ppt/slides/_rels/slide${n}.xml.rels`,
      `${DECL}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`
    );
  });

  const sldIds = slides
    .map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${2 + i}"/>`)
    .join("");
  zip.file(
    "ppt/presentation.xml",
    `${DECL}<p:presentation ${NS_P} saveSubsetFonts="1"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${sldIds}</p:sldIdLst><p:sldSz cx="${SLIDE_W}" cy="${SLIDE_H}"/><p:notesSz cx="${SLIDE_H}" cy="${SLIDE_W}"/></p:presentation>`
  );

  const presRels = [
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>`,
    ...slides.map(
      (_, i) =>
        `<Relationship Id="rId${2 + i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`
    ),
    `<Relationship Id="rId${2 + slides.length}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>`,
  ].join("");
  zip.file(
    "ppt/_rels/presentation.xml.rels",
    `${DECL}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${presRels}</Relationships>`
  );

  const overrides = slides
    .map(
      (_, i) =>
        `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`
    )
    .join("");
  zip.file(
    "[Content_Types].xml",
    `${DECL}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>${overrides}</Types>`
  );

  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

module.exports = { buildPptx, shapeXml, EMU_PER_IN, SLIDE_W, SLIDE_H, esc };
