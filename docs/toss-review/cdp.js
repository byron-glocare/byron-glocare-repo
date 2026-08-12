/**
 * 최소 CDP(Chrome DevTools Protocol) 클라이언트.
 *
 * puppeteer-core 를 설치할 수 없는 환경이라 직접 붙는다.
 * Node 24 의 내장 WebSocket 을 쓰므로 의존성이 없다.
 *
 * 붙는 대상은 **운영자가 띄운 전용 프로필 크롬**(--remote-debugging-port=9222).
 * puppeteer 가 직접 띄운 크롬이 아니라서 "자동화된 소프트웨어의 제어를 받고 있습니다"
 * 배너가 뜨지 않는다 — 카드사에 낼 캡처에 그런 게 찍히면 안 된다.
 */

const PORT = 9222;
const BASE = `http://127.0.0.1:${PORT}`;

async function listTargets() {
  const r = await fetch(`${BASE}/json/list`);
  if (!r.ok) throw new Error(`CDP 목록 실패: ${r.status}`);
  return r.json();
}

/** 페이지 타겟 하나에 붙는다. url 힌트를 주면 그걸 우선 고른다. */
async function attach(urlHint = "") {
  const targets = (await listTargets()).filter((t) => t.type === "page");
  if (targets.length === 0) throw new Error("열린 탭이 없습니다");
  const t =
    (urlHint && targets.find((x) => x.url.includes(urlHint))) || targets[0];

  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener("open", res, { once: true });
    ws.addEventListener("error", () => rej(new Error("WS 연결 실패")), {
      once: true,
    });
  });

  let id = 0;
  const pending = new Map();
  const listeners = [];

  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id != null && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    } else if (msg.method) {
      for (const fn of listeners) fn(msg);
    }
  });

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const myId = ++id;
      pending.set(myId, { resolve, reject });
      ws.send(JSON.stringify({ id: myId, method, params }));
      setTimeout(() => {
        if (pending.has(myId)) {
          pending.delete(myId);
          reject(new Error(`${method} 시간 초과`));
        }
      }, 30000);
    });

  /** 특정 이벤트를 기다린다. */
  const waitFor = (method, timeout = 15000) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const i = listeners.indexOf(fn);
        if (i >= 0) listeners.splice(i, 1);
        reject(new Error(`${method} 대기 시간 초과`));
      }, timeout);
      const fn = (msg) => {
        if (msg.method !== method) return;
        clearTimeout(timer);
        const i = listeners.indexOf(fn);
        if (i >= 0) listeners.splice(i, 1);
        resolve(msg.params);
      };
      listeners.push(fn);
    });

  const evaluate = async (expr) => {
    const r = await send("Runtime.evaluate", {
      expression: expr,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.exceptionDetails) {
      throw new Error(r.exceptionDetails.exception?.description ?? "JS 오류");
    }
    return r.result?.value;
  };

  async function goto(url) {
    const loaded = waitFor("Page.loadEventFired", 25000).catch(() => null);
    await send("Page.navigate", { url });
    await loaded;
  }

  return {
    send,
    evaluate,
    goto,
    waitFor,
    bringToFront: () => send("Page.bringToFront"),
    close: () => ws.close(),
    targetUrl: t.url,
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = { attach, listTargets, sleep, BASE };
