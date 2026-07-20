/**
 * 유학센터 포털(/center) 스크린샷 캡처 — 확립된 방식.
 *   fullPage(dsf3) 캡처 → <main> boundingRect 기준 sharp extract (좌우 ±16px, top=main 시작)
 *   ※ 요소캡처·trim 금지 (짤림 원인). 초장신은 dsf2 또는 상단 크롭.
 *   화면 언어 = 베트남어(센터 기본값) — 쿠키 건드리지 않음.
 */
const puppeteer = require("puppeteer-core");
const sharp = require("sharp");
const fs = require("node:fs");
const path = require("node:path");

const BASE = "https://www.youstudyinkorea.com";
const OUT = path.join(__dirname, "shots");
const MAX_DEV_PX = 16384; // dsf3 fullPage 한계

async function capture(page, name, url, opts = {}) {
  const {
    dsf = 3,
    cropRatio = null,
    waitFor = null,
    action = null,
    band = null, // { text, padTop, padBottom } — 특정 요소 주변 띠만 크롭(클로즈업)
  } = opts;

  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: dsf });
  await page.goto(BASE + url, { waitUntil: "domcontentloaded" });
  await new Promise((r) => setTimeout(r, 2200));
  if (waitFor) {
    try { await page.waitForSelector(waitFor, { timeout: 8000 }); } catch {}
  }
  if (action) { await action(page); await new Promise((r) => setTimeout(r, 1500)); }

  // 스크롤 0 에서 main rect 측정
  await page.evaluate(() => window.scrollTo(0, 0));
  const rect = await page.evaluate(() => {
    const m = document.querySelector("main");
    if (!m) return null;
    const r = m.getBoundingClientRect();
    const top = r.y + window.scrollY;
    // 실제 콘텐츠 끝 = main 내부 요소들의 최대 bottom (짧은 페이지 하단 흰 여백 제거)
    //   ※ sharp .trim() 은 과도 절단으로 금지 — 좌표 기반으로만 자른다.
    let bottom = top;
    for (const el of m.querySelectorAll("*")) {
      if (!el.offsetParent && el.tagName !== "BODY") continue;
      const b = el.getBoundingClientRect();
      if (b.height <= 0 || b.width <= 0) continue;
      bottom = Math.max(bottom, b.bottom + window.scrollY);
    }
    const contentH = Math.max(120, bottom - top + 24); // 하단 여백 24px
    return { x: r.x, y: top, w: r.width, h: Math.min(m.scrollHeight, contentH) };
  });

  const full = path.join(OUT, `_full_${name}.png`);
  await page.screenshot({ path: full, fullPage: true });

  const meta = await sharp(full).metadata();
  if (meta.height >= MAX_DEV_PX && dsf === 3) {
    fs.unlinkSync(full);
    console.log(`  ! ${name}: ${meta.height}px > 한계 → dsf2 재촬영`);
    return capture(page, name, url, { ...opts, dsf: 2 });
  }

  const dest = path.join(OUT, `${name}.png`);
  if (!rect) {
    await sharp(full).toFile(dest);
  } else {
    const pad = 16;
    const left = Math.max(0, Math.round((rect.x - pad) * dsf));
    let top = Math.max(0, Math.round(rect.y * dsf));
    let width = Math.round((rect.w + pad * 2) * dsf);
    let height = Math.round(rect.h * dsf);

    if (band) {
      // 지정 텍스트를 가진 요소 주변만 크롭 (신규 기능 클로즈업용)
      const br = await page.evaluate((t) => {
        const el = Array.from(document.querySelectorAll("div,section,label"))
          .filter((e) => (e.innerText || "").includes(t))
          .sort((a, b) => (a.innerText || "").length - (b.innerText || "").length)[0];
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { top: r.top + window.scrollY, bottom: r.bottom + window.scrollY };
      }, band.text);
      if (br) {
        const t0 = Math.max(0, Math.round((br.top - (band.padTop ?? 120)) * dsf));
        const t1 = Math.round((br.bottom + (band.padBottom ?? 120)) * dsf);
        top = t0;
        height = t1 - t0;
      }
    }

    width = Math.min(width, meta.width - left);
    height = Math.min(height, meta.height - top);
    if (cropRatio) height = Math.min(height, Math.round(width * cropRatio));
    await sharp(full).extract({ left, top, width, height }).toFile(dest);
  }
  fs.unlinkSync(full);
  const m2 = await sharp(dest).metadata();
  console.log(`  ✓ ${name}  ${m2.width}x${m2.height}  (dsf${dsf})`);
  return dest;
}

(async () => {
  const browser = await puppeteer.connect({
    browserURL: "http://127.0.0.1:9222",
    defaultViewport: null,
  });
  const pages = await browser.pages();
  const page = pages.find((p) => p.url().includes("youstudyinkorea")) || pages[0];

  const only = process.argv[2]; // 'sample' 이면 앞 3장만
  fs.mkdirSync(OUT, { recursive: true });

  // 예시 학생 = 테스트학생 (가짜 PII, 데이터 풍부) — 실제 학생 개인정보 노출 방지
  const sid = "322138e1-e789-45ab-b550-a29666720d95";
  const S = `/center/students/${sid}`;

  /** 텍스트로 요소 찾아 클릭 (가장 구체적 = 텍스트 최단) */
  const clickText = (txt) => async (page) => {
    await page.evaluate((t) => {
      const els = Array.from(
        document.querySelectorAll('button,a,[role="button"],summary')
      ).filter((e) => (e.innerText || "").includes(t));
      els.sort((a, b) => (a.innerText || "").length - (b.innerText || "").length);
      els[0]?.click();
    }, txt);
  };

  const LIST = [
    ["c00_login", "/center/login", {}],
    ["c10_dashboard", "/center", {}],
    ["c20_students", "/center/students", {}],
    ["c21_student_new", "/center/students/new", {}],
    ["c30_overview", S, {}],
    ["c40_select", `${S}/select`, {}],
    ["c41_select_new", `${S}/applications/new`, {}],
    ["c50_documents", `${S}/documents`, {}],
    // 정보 입력: 초장신(폭의 7.8배) → 상단 개요만
    ["c60_data", `${S}/data`, { cropRatio: 1.5 }],
    // 도구(외부 입력 링크 · AI 자동채움) 펼친 상태 — 상단만
    ["c61_data_tools", `${S}/data`, { action: clickText("Công cụ"), cropRatio: 1.2 }],
    // ⭐신규: 입력값(원문)/최종값(서류용) 이중 칸 클로즈업
    ["c62_translate", `${S}/data`, {
      band: { text: "Dịch KR", padTop: 240, padBottom: 300 },
    }],
    ["c70_final", `${S}/final`, {}],
    ["c80_essays", `${S}/essays`, {}],
  ];

  const list =
    only === "sample"
      ? LIST.slice(0, 3)
      : only
        ? LIST.filter(([n]) => n.includes(only))
        : LIST;
  for (const [name, url, opts] of list) {
    try { await capture(page, name, url, opts); }
    catch (e) { console.log(`  ✗ ${name}: ${e.message}`); }
  }

  console.log("\n저장 위치:", OUT);
  await browser.disconnect();
})();
