/**
 * 토스 결제경로 캡처 — 전용 프로필 크롬을 CDP 로 몰면서 화면 전체를 찍는다.
 *
 *   node docs/toss-review/capture.js pre    ② ③ ④  (로그아웃 상태)
 *   node docs/toss-review/capture.js post   ⑤ ⑥    (로그인 후)
 *   node docs/toss-review/capture.js 03_refund      낱장 재촬영
 *
 * 왜 화면 전체인가: 토스 가이드 4쪽 2·3항이 "주소창 도메인"과 "PC 시계"를 함께
 * 요구한다. 브라우저 뷰포트 캡처로는 둘 다 안 나온다. 그래서 CDP 로 화면만 맞추고,
 * 실제 촬영은 PowerShell 전체화면 캡처로 한다.
 */

const { execFileSync } = require("node:child_process");
const path = require("node:path");
const { attach, sleep } = require("./cdp");

const SITE = "https://www.youstudyinkorea.com";
const SHOT_PS1 = path.join(__dirname, "shot.ps1");

function shoot(name) {
  const out = execFileSync(
    "powershell",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", SHOT_PS1, "-Name", name],
    { encoding: "utf8" }
  );
  console.log("   " + out.trim());
}

/** 페이지 맨 아래까지 내린다 (푸터 캡처용). */
const SCROLL_BOTTOM = `(() => {
  window.scrollTo(0, document.body.scrollHeight);
  return document.body.scrollHeight;
})()`;

/** 텍스트로 요소를 찾아 화면 중앙에 오도록 스크롤 */
const scrollToText = (t) => `(() => {
  const els = [...document.querySelectorAll('h1,h2,h3,dt,li,p,div')]
    .filter(e => (e.textContent || '').includes(${JSON.stringify(t)}));
  if (!els.length) return 'not-found';
  els.sort((a,b) => (a.textContent||'').length - (b.textContent||'').length);
  els[0].scrollIntoView({ block: 'center' });
  return 'ok';
})()`;

const STEPS = {
  "02_footer": {
    label: "② 하단 사업자정보",
    url: `${SITE}/`,
    prep: async (p) => {
      await p.evaluate(SCROLL_BOTTOM);
      await sleep(900);
    },
  },
  "03_refund": {
    label: "③ 환불규정",
    url: `${SITE}/refund`,
    prep: async (p) => {
      const r = await p.evaluate(scrollToText("환불"));
      if (r === "not-found") await p.evaluate("window.scrollTo(0,400)");
      await sleep(700);
    },
  },
  "04_login": {
    label: "④ 로그인",
    url: `${SITE}/student/login`,
    prep: async () => sleep(600),
  },
  "05a_products": {
    label: "⑤ 상품 목록",
    url: `${SITE}/service`,
    prep: async () => sleep(700),
  },
  "05b_detail": {
    label: "⑤ 상품 상세",
    url: `${SITE}/service/full-consulting`,
    prep: async () => sleep(700),
  },
  "05c_order": {
    label: "⑤ 주문서",
    url: `${SITE}/student/order/full-consulting`,
    // 결제위젯 iframe 이 다 그려질 때까지 기다린다
    prep: async (p) => {
      for (let i = 0; i < 20; i++) {
        const ok = await p.evaluate(
          `document.querySelectorAll('iframe').length >= 2`
        );
        if (ok) break;
        await sleep(700);
      }
      await sleep(1500);
    },
  },
  "06_payment": {
    label: "⑥ 카드 결제창",
    url: null, // 주문서에서 이어서 진행
    prep: async (p) => {
      const clicked = await p.evaluate(`(() => {
        const b = [...document.querySelectorAll('button')]
          .find(x => /결제하기/.test(x.textContent || ''));
        if (!b || b.disabled) return false;
        b.click();
        return true;
      })()`);
      if (!clicked) throw new Error("결제하기 버튼을 누르지 못했습니다");
      await sleep(4500); // 결제창 렌더 대기
    },
  },
};

const GROUPS = {
  pre: ["02_footer", "03_refund", "04_login"],
  post: ["05a_products", "05b_detail", "05c_order", "06_payment"],
};

(async () => {
  const arg = process.argv[2] || "pre";
  const keys = GROUPS[arg] ?? (STEPS[arg] ? [arg] : null);
  if (!keys) {
    console.error(`알 수 없는 인자: ${arg}`);
    console.error(`  pre | post | ${Object.keys(STEPS).join(" | ")}`);
    process.exit(1);
  }

  const page = await attach("youstudyinkorea");
  await page.send("Page.enable");
  await page.send("Runtime.enable");
  await page.send("Network.enable");

  // 화면 언어를 한국어로 고정 — 카드사 심사자가 읽어야 한다.
  await page.send("Network.setCookie", {
    name: "locale",
    value: "ko",
    domain: ".youstudyinkorea.com",
    path: "/",
  });

  await page.bringToFront();
  await sleep(400);

  for (const k of keys) {
    const s = STEPS[k];
    console.log(`\n${s.label}  (${k})`);
    if (s.url) {
      await page.goto(s.url);
      await sleep(1200);
    }
    await s.prep(page);
    await page.bringToFront();
    await sleep(300);
    shoot(k);
  }

  page.close();
  console.log("\n완료. 확인 후 → node docs/toss-review/build.js");
})().catch((e) => {
  console.error("실패:", e.message);
  process.exit(1);
});
