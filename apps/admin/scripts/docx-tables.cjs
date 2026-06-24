// docx 표 구조 덤프 — 라벨/빈칸 인접 감지 가능성 확인용
const JSZip = require("jszip");
const fs = require("fs");

function cellText(tcXml) {
  // <w:tc> 안의 모든 텍스트
  const m = tcXml.match(/<w:t[ >][\s\S]*?<\/w:t>/g) || [];
  return m
    .map((t) => t.replace(/<[^>]+>/g, ""))
    .join("")
    .replace(/&amp;/g, "&")
    .trim();
}

(async () => {
  const p = process.argv[2];
  const zip = await JSZip.loadAsync(fs.readFileSync(p));
  const xml = await zip.file("word/document.xml").async("string");
  const tables = xml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/g) || [];
  console.log("표 개수:", tables.length);
  tables.forEach((tbl, ti) => {
    const rows = tbl.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) || [];
    console.log(`\n=== 표 ${ti + 1} (행 ${rows.length}) ===`);
    rows.forEach((tr, ri) => {
      const cells = tr.match(/<w:tc>[\s\S]*?<\/w:tc>/g) || [];
      const texts = cells.map((c) => {
        const t = cellText(c);
        return t === "" ? "▢" : t; // 빈칸 = ▢
      });
      console.log(`R${ri}: ` + texts.join("  |  "));
    });
  });
})();
