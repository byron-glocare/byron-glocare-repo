"use client";

/**
 * 정산서 인쇄 페이지(/settlements/print)를 화면 캡처해 A4 PDF(Blob)로 만든다.
 *
 * - 서버에 헤드리스 크롬이 없으므로 브라우저에서 생성.
 * - 라이브러리는 CDN 에서 필요할 때만 로드 (html2canvas-pro: Tailwind v4 의 oklch 색 지원, jsPDF).
 * - 해상도: 3배 캡처 → A4 폭 기준 약 290dpi. 확대·인쇄해도 선명.
 * - 여러 쪽이면 표 행/섹션 경계에서 자른다 (글자가 반으로 잘리지 않게).
 */

const HTML2CANVAS_URL =
  "https://cdn.jsdelivr.net/npm/html2canvas-pro@2.5.0/dist/html2canvas-pro.min.js";
const JSPDF_URL =
  "https://cdn.jsdelivr.net/npm/jspdf@4.2.1/dist/jspdf.umd.min.js";

const SCALE = 3;
const A4_W_MM = 210;
const A4_H_MM = 297;

type Html2Canvas = (
  el: HTMLElement,
  opts: Record<string, unknown>
) => Promise<HTMLCanvasElement>;
type JsPdfCtor = new (opts: Record<string, unknown>) => {
  addPage: () => void;
  addImage: (
    data: string,
    fmt: string,
    x: number,
    y: number,
    w: number,
    h: number
  ) => void;
  output: (type: "blob") => Blob;
};

const scriptCache = new Map<string, Promise<void>>();
function loadScript(src: string): Promise<void> {
  let p = scriptCache.get(src);
  if (!p) {
    p = new Promise<void>((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.crossOrigin = "anonymous";
      s.onload = () => resolve();
      s.onerror = () => {
        scriptCache.delete(src);
        reject(new Error(`라이브러리 로드 실패: ${src}`));
      };
      document.head.appendChild(s);
    });
    scriptCache.set(src, p);
  }
  return p;
}

function loadIframe(src: string): Promise<HTMLIFrameElement> {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    // 화면 밖에 데스크톱 폭으로 렌더 (사이드바 + A4 컨테이너가 다 들어가게)
    iframe.style.cssText =
      "position:fixed;left:-20000px;top:0;width:1400px;height:1600px;border:0;visibility:hidden;";
    iframe.setAttribute("aria-hidden", "true");
    const timer = setTimeout(() => {
      iframe.remove();
      reject(new Error("정산서 페이지 로딩 시간 초과"));
    }, 30000);
    iframe.onload = () => {
      clearTimeout(timer);
      resolve(iframe);
    };
    iframe.src = src;
    document.body.appendChild(iframe);
  });
}

/** 쪽 나눔 후보 y 좌표 (CSS px, root 기준) — 행/섹션의 아래 경계. */
function breakCandidates(root: HTMLElement): number[] {
  const top = root.getBoundingClientRect().top;
  const ys = new Set<number>();
  root
    .querySelectorAll("tr, section, header, footer, h2, p")
    .forEach((el) => {
      if ((el as HTMLElement).closest(".no-print")) return;
      ys.add(Math.round(el.getBoundingClientRect().bottom - top));
    });
  return Array.from(ys).sort((a, b) => a - b);
}

export async function generateSettlementPdf(printHref: string): Promise<Blob> {
  await Promise.all([loadScript(HTML2CANVAS_URL), loadScript(JSPDF_URL)]);
  const w = window as unknown as {
    html2canvas?: Html2Canvas;
    jspdf?: { jsPDF: JsPdfCtor };
  };
  if (!w.html2canvas || !w.jspdf) throw new Error("PDF 라이브러리 초기화 실패");

  const iframe = await loadIframe(printHref);
  try {
    const doc = iframe.contentDocument;
    if (!doc) throw new Error("정산서 페이지에 접근할 수 없습니다.");
    // 인쇄 때처럼 안내 박스(.no-print) 숨김 — 측정·캡처 레이아웃을 인쇄본과 맞춤
    const hide = doc.createElement("style");
    hide.textContent = ".no-print{display:none!important}";
    doc.head.appendChild(hide);
    await doc.fonts?.ready;
    const root = doc.querySelector<HTMLElement>(".print-page");
    if (!root) throw new Error("정산서 내용을 찾지 못했습니다.");

    const cssW = root.offsetWidth;
    const breaks = breakCandidates(root);
    const canvas = await w.html2canvas(root, {
      scale: SCALE,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      ignoreElements: (el: Element) => el.classList?.contains("no-print"),
    });

    // 캡처 결과 높이 기준 (no-print 제외로 root 보다 짧을 수 있음)
    const pxPerCss = canvas.width / cssW;
    const pageHCss = (cssW * A4_H_MM) / A4_W_MM;
    const totalCss = canvas.height / pxPerCss;

    const pdf = new w.jspdf.jsPDF({
      unit: "mm",
      format: "a4",
      orientation: "portrait",
      compress: true,
    });

    // 한 쪽을 살짝 넘는 정도면 축소해서 한 장에
    if (totalCss <= pageHCss * 1.12) {
      const img = canvas.toDataURL("image/jpeg", 0.92);
      const hMm = (totalCss * A4_W_MM) / cssW;
      if (hMm <= A4_H_MM) {
        pdf.addImage(img, "JPEG", 0, 0, A4_W_MM, hMm);
      } else {
        const wMm = (A4_W_MM * A4_H_MM) / hMm;
        pdf.addImage(img, "JPEG", (A4_W_MM - wMm) / 2, 0, wMm, A4_H_MM);
      }
      return pdf.output("blob");
    }

    // 여러 쪽 — 경계에서 자르기 (둘째 쪽부터 위아래 여백 10mm)
    const MARGIN_MM = 10;
    const bodyHCss = (cssW * (A4_H_MM - MARGIN_MM * 2)) / A4_W_MM;
    let startCss = 0;
    let first = true;
    while (startCss < totalCss - 1) {
      const limit = startCss + (first ? bodyHCss + (cssW * MARGIN_MM) / A4_W_MM : bodyHCss);
      let endCss = totalCss;
      if (limit < totalCss) {
        const fit = breaks.filter((y) => y > startCss + 40 && y <= limit);
        endCss = fit.length ? fit[fit.length - 1] : limit;
      }
      const sy = Math.round(startCss * pxPerCss);
      const sh = Math.min(canvas.height - sy, Math.round((endCss - startCss) * pxPerCss));
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = sh;
      const ctx = slice.getContext("2d");
      if (!ctx) throw new Error("캔버스 생성 실패");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, sy, canvas.width, sh, 0, 0, canvas.width, sh);
      if (!first) pdf.addPage();
      const y = first ? 0 : MARGIN_MM;
      first = false;
      pdf.addImage(
        slice.toDataURL("image/jpeg", 0.92),
        "JPEG",
        0,
        y,
        A4_W_MM,
        (sh / pxPerCss) * (A4_W_MM / cssW)
      );
      startCss = endCss;
    }
    return pdf.output("blob");
  } finally {
    iframe.remove();
  }
}
