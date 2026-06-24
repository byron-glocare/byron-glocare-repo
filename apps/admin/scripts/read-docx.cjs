const JSZip = require("jszip");
const fs = require("fs");

(async () => {
  const p = process.argv[2];
  const buf = fs.readFileSync(p);
  let zip;
  try {
    zip = await JSZip.loadAsync(buf);
  } catch (e) {
    console.log("NOT_A_ZIP (변환 실패 — 여전히 옛 .doc):", e.message);
    return;
  }
  const f = zip.file("word/document.xml");
  if (!f) {
    console.log("no document.xml — entries:", Object.keys(zip.files).join(", "));
    return;
  }
  const xml = await f.async("string");
  const text = xml
    .replace(/<w:p[ >]/g, "\n")
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
  console.log("CHARS", text.length);
  console.log("=== TEXT ===");
  console.log(text.slice(0, 2200));
})();
