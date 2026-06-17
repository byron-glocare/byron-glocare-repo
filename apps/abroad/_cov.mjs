import fontkit from "@pdf-lib/fontkit";
import { readFileSync } from "fs";
const tests = {
  basicLatin: [..."NGUYEN VAN TEST"].map(c=>c.codePointAt(0)),
  viet: [...("Số Đường Láng Đống Đa Nguyễn Văn THPT")].map(c=>c.codePointAt(0)),
  korean: [...("성명홍길동베트남서울특별시")].map(c=>c.codePointAt(0)),
};
for (const file of ["public/fonts/NanumGothic-Regular.ttf","_pretendard.otf","_noto.ttf"]) {
  try {
    const f = fontkit.create(readFileSync(file));
    const r = {};
    for (const [k,cps] of Object.entries(tests)) {
      const miss = cps.filter(cp=>!f.hasGlyphForCodePoint(cp));
      r[k] = miss.length===0 ? "OK" : `MISS ${miss.length}: ${miss.map(c=>String.fromCodePoint(c)).join("")}`;
    }
    console.log(file, "=>", JSON.stringify(r));
  } catch(e){ console.log(file, "ERR", e.message); }
}
