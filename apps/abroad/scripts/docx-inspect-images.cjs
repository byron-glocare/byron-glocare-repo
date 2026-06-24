// docx 안 이미지(인라인/앵커)의 크기·위치·z-order 추출
const fs = require("fs");
const PizZip = require("pizzip");
const EMU = 360000; // 1cm

const z = new PizZip(fs.readFileSync(process.argv[2]));
const xml = z.file("word/document.xml").asText();

const drawings = xml.match(/<w:drawing>[\s\S]*?<\/w:drawing>/g) || [];
console.log("이미지(drawing) 개수:", drawings.length, "\n");

drawings.forEach((d, i) => {
  const isAnchor = /<wp:anchor/.test(d);
  const name = (d.match(/<wp:docPr[^>]*name="([^"]*)"/) || [])[1] || "?";
  const ext = d.match(/<wp:extent cx="(\d+)" cy="(\d+)"/);
  const cx = ext ? +ext[1] : 0, cy = ext ? +ext[2] : 0;
  const behind = (d.match(/behindDoc="(\d)"/) || [])[1];
  const ph = d.match(/<wp:positionH relativeFrom="([^"]*)">[\s\S]*?<wp:posOffset>(-?\d+)<\/wp:posOffset>/);
  const pv = d.match(/<wp:positionV relativeFrom="([^"]*)">[\s\S]*?<wp:posOffset>(-?\d+)<\/wp:posOffset>/);
  const align = d.match(/<wp:align>([^<]+)<\/wp:align>/g);
  const wrap = (d.match(/<wp:wrap(\w+)/) || [])[1];

  console.log(`--- #${i + 1} name="${name}" ---`);
  console.log(`  배치: ${isAnchor ? "앵커(플로팅)" : "인라인(셀 안)"}`);
  console.log(`  크기: ${(cx / EMU).toFixed(2)}cm x ${(cy / EMU).toFixed(2)}cm  (cx=${cx}, cy=${cy})`);
  if (isAnchor) {
    console.log(`  z-order: behindDoc=${behind} (${behind === "1" ? "글자 뒤" : "글자 앞"}), wrap=${wrap || "?"}`);
    if (ph) console.log(`  가로: relativeFrom=${ph[1]}, offset=${(ph[2] / EMU).toFixed(2)}cm`);
    if (pv) console.log(`  세로: relativeFrom=${pv[1]}, offset=${(pv[2] / EMU).toFixed(2)}cm`);
    if (align) console.log(`  align:`, align.join(", "));
  }
  console.log("");
});
