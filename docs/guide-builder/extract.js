/** build.js 안의 한국어 문자열 리터럴을 추출 → strings.json */
const fs = require("node:fs");

const src = fs.readFileSync("build.js", "utf8");
const HANGUL = /[가-힣]/;

// 문자열 리터럴 스캔 (", ', ` 지원 / 이스케이프 처리)
const out = new Set();
let i = 0;
while (i < src.length) {
  const ch = src[i];
  if (ch === '"' || ch === "'" || ch === "`") {
    const quote = ch;
    let j = i + 1;
    let buf = "";
    let closed = false;
    while (j < src.length) {
      const c = src[j];
      if (c === "\\") { buf += src[j + 1] === "n" ? "\n" : src[j + 1]; j += 2; continue; }
      if (c === quote) { closed = true; break; }
      if (quote === "`" && c === "$" && src[j + 1] === "{") break; // 템플릿 보간 → 스킵
      buf += c;
      j++;
    }
    if (closed && HANGUL.test(buf)) out.add(buf);
    i = closed ? j + 1 : i + 1;
    continue;
  }
  // 주석 스킵
  if (ch === "/" && src[i + 1] === "/") { while (i < src.length && src[i] !== "\n") i++; continue; }
  if (ch === "/" && src[i + 1] === "*") { const e = src.indexOf("*/", i); i = e < 0 ? src.length : e + 2; continue; }
  i++;
}

const arr = [...out].filter((s) => s.trim().length > 0);
fs.writeFileSync("strings.json", JSON.stringify(arr, null, 1), "utf8");
console.log("추출:", arr.length, "개 문자열 /", arr.join("").length, "글자");
