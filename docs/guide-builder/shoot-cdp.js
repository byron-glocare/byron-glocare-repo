/**
 * 가이드용 스크린샷 — puppeteer-core 없이 CDP 로 직접 찍는다.
 *
 * shoot.js 와 같은 규칙을 따른다: fullPage(dsf3) 로 받아 <main> 좌표 기준으로 크롭.
 * (요소 캡처·trim 은 짤림 원인이라 쓰지 않는다.)
 *
 * 운영자가 아래처럼 띄운 전용 프로필 크롬에 붙는다.
 *   Start-Process chrome -ArgumentList "--remote-debugging-port=9222",
 *     "--user-data-dir=<전용 경로>", "--no-first-run"
 * 로그인이 필요한 화면은 그 창에서 운영자가 직접 로그인한다.
 *
 *   node shoot-cdp.js <이름>=<경로> [...]
 *   node shoot-cdp.js s10_service=/service
 */
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const { attach, sleep } = require('../toss-review/cdp');

const BASE = 'https://www.youstudyinkorea.com';
const OUT = path.join(__dirname, 'shots');
const DSF = 3;

async function capture(page, name, url, { cropRatio = null, wait = 2200 } = {}) {
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 1440, height: 900, deviceScaleFactor: DSF, mobile: false,
  });
  await page.goto(BASE + url);
  await sleep(wait);
  await page.evaluate('window.scrollTo(0, 0)');

  // main 의 위치와 "실제 내용이 끝나는 지점" 을 좌표로 잰다.
  const rect = await page.evaluate(`(() => {
    const m = document.querySelector('main') || document.body;
    const r = m.getBoundingClientRect();
    const top = r.y + window.scrollY;
    let bottom = top;
    for (const el of m.querySelectorAll('*')) {
      if (!el.offsetParent && el.tagName !== 'BODY') continue;
      const b = el.getBoundingClientRect();
      if (b.height <= 0 || b.width <= 0) continue;
      bottom = Math.max(bottom, b.bottom + window.scrollY);
    }
    return JSON.stringify({ x: r.x, y: top, w: r.width, h: Math.max(120, bottom - top + 24) });
  })()`);
  const R = JSON.parse(rect);

  const shot = await page.send('Page.captureScreenshot', {
    format: 'png', captureBeyondViewport: true,
  });
  const full = Buffer.from(shot.data, 'base64');
  const meta = await sharp(full).metadata();

  const pad = 16;
  const left = Math.max(0, Math.round((R.x - pad) * DSF));
  const top = Math.max(0, Math.round(R.y * DSF));
  let width = Math.min(Math.round((R.w + pad * 2) * DSF), meta.width - left);
  let height = Math.min(Math.round(R.h * DSF), meta.height - top);
  if (cropRatio) height = Math.min(height, Math.round(width * cropRatio));

  fs.mkdirSync(OUT, { recursive: true });
  const dest = path.join(OUT, `${name}.png`);
  await sharp(full).extract({ left, top, width, height }).toFile(dest);
  const m2 = await sharp(dest).metadata();
  console.log(`  o ${name}  ${m2.width}x${m2.height}`);
}

(async () => {
  const args = process.argv.slice(2);
  if (!args.length) { console.error('사용법: node shoot-cdp.js <이름>=<경로> [...]'); process.exit(1); }

  const page = await attach('youstudyinkorea');
  await page.send('Page.enable');
  await page.send('Runtime.enable');
  await page.send('Network.enable');
  // 가이드 스크린샷은 센터 기본 언어(베트남어) 화면으로 통일한다.
  await page.send('Network.setCookie', {
    name: 'locale', value: 'vi', domain: '.youstudyinkorea.com', path: '/',
  });

  for (const a of args) {
    const [name, ...rest] = a.split('=');
    const spec = rest.join('=');
    const [url, ratio] = spec.split('#');
    try {
      await capture(page, name, url, { cropRatio: ratio ? Number(ratio) : null });
    } catch (e) {
      console.log(`  x ${name}: ${e.message}`);
    }
  }
  page.close();
})().catch((e) => { console.error('실패:', e.message); process.exit(1); });
