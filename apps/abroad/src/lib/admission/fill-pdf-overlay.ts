/**
 * 원본 양식 PDF + 좌표 오버레이 + 학생 데이터 → 채운 PDF (좌표 오버레이 방식).
 *
 *   pdf-lib 로 원본 PDF 를 열고, field_overlays 의 각 좌표에
 *   학생 데이터 텍스트를 한글 폰트(임베드)로 그려 넣는다.
 *   원본 레이아웃을 그대로 두고 "그 위에" 글자만 얹는 방식이라
 *   양식이 어떤 모양이든 정확히 채운다.
 */

import "server-only";

import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

import type { FormFieldOverlay } from "@/types/study";

const DEFAULT_SIZE = 11;
const MIN_SIZE = 6;
const LINE_GAP = 2; // 줄 간격 여유 (pt)

export type FillImage = { bytes: Uint8Array; type: "png" | "jpg" };

export type FillOverlayInput = {
  /** 원본 양식 PDF 바이트 */
  pdfBytes: ArrayBuffer | Uint8Array;
  /** 한글 TTF 폰트 바이트 */
  koFontBytes: ArrayBuffer | Uint8Array;
  /** 베트남어·라틴 TTF 폰트 바이트 */
  latinFontBytes: ArrayBuffer | Uint8Array;
  /** 채울 박스 목록 */
  overlays: FormFieldOverlay[];
  /** kind=text: overlay.key → 그릴 텍스트 (문자열로 변환된 값) */
  values: Map<string, string>;
  /** kind=check: overlay.key → 체크 여부 */
  checks?: Map<string, boolean>;
  /** kind=image|signature: overlay.key → 이미지 바이트 */
  images?: Map<string, FillImage>;
};

/** 한글(자모·음절) 포함 여부 — 폰트 선택용. */
const HANGUL_RE = /[ᄀ-ᇿ㄰-㆏가-힣]/;

/**
 * 베트남어·라틴 발음기호 제거 → ASCII 영문.
 *   대부분의 입학서류는 한글 또는 영어로만 작성 → 베트남어 성조 문자(ố Đ ễ ư …)는
 *   기본 알파벳으로 폴딩한다. 한글·숫자·기타 문자는 그대로 둔다.
 *   예) "Nguyễn Văn Bố" → "Nguyen Van Bo", "Số 12, Đường Láng" → "So 12, Duong Lang".
 */
export function foldLatinDiacritics(s: string): string {
  return s
    .replace(/[À-ɏḀ-ỿ]/g, (ch) => {
      const base = ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
      return base || ch;
    })
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

/**
 * 텍스트를 maxWidth 안에 들어가도록 줄바꿈 (공백 우선, 없으면 글자 단위).
 */
function wrapText(
  text: string,
  font: import("pdf-lib").PDFFont,
  size: number,
  maxWidth: number
): string[] {
  const out: string[] = [];
  for (const rawLine of text.split("\n")) {
    if (font.widthOfTextAtSize(rawLine, size) <= maxWidth) {
      out.push(rawLine);
      continue;
    }
    // 공백으로 단어 단위 시도
    const words = rawLine.split(/(\s+)/);
    let cur = "";
    const pushCur = () => {
      if (cur) out.push(cur);
      cur = "";
    };
    for (const w of words) {
      const tryLine = cur + w;
      if (font.widthOfTextAtSize(tryLine, size) <= maxWidth) {
        cur = tryLine;
        continue;
      }
      // 단어 자체가 너무 길면 글자 단위로 쪼갬
      if (font.widthOfTextAtSize(w, size) > maxWidth) {
        pushCur();
        let chunk = "";
        for (const ch of w) {
          if (font.widthOfTextAtSize(chunk + ch, size) <= maxWidth) {
            chunk += ch;
          } else {
            if (chunk) out.push(chunk);
            chunk = ch;
          }
        }
        cur = chunk;
      } else {
        pushCur();
        cur = w.trimStart();
      }
    }
    pushCur();
  }
  return out.length > 0 ? out : [""];
}

export async function fillPdfOverlay(
  input: FillOverlayInput
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(input.pdfBytes);
  pdf.registerFontkit(fontkit);
  const koFont = await pdf.embedFont(input.koFontBytes, { subset: true });
  const latinFont = await pdf.embedFont(input.latinFontBytes, { subset: true });
  // 한글이 섞이면 한글 폰트, 아니면 베트남어/라틴 폰트.
  const pickFont = (s: string) => (HANGUL_RE.test(s) ? koFont : latinFont);

  const pages = pdf.getPages();
  const black = rgb(0.05, 0.05, 0.05);

  const PAD = 2; // 박스 안쪽 여백 pt

  for (const ov of input.overlays) {
    const page = pages[ov.page];
    if (!page) continue;
    const kind = ov.kind ?? "text";

    // ── 체크: 조건 충족 시 박스 안에 ✓ (벡터 — 폰트 글리프 의존 X)
    if (kind === "check") {
      if (!input.checks?.get(ov.key)) continue;
      const bw = ov.w && ov.w > 0 ? ov.w : 12;
      const bh = ov.h && ov.h > 0 ? ov.h : 12;
      const cx = ov.x;
      const cy = ov.y;
      const t = Math.max(1, Math.min(bw, bh) * 0.12);
      // ✓ 모양 두 획
      page.drawLine({
        start: { x: cx + bw * 0.2, y: cy + bh * 0.5 },
        end: { x: cx + bw * 0.42, y: cy + bh * 0.28 },
        thickness: t,
        color: black,
      });
      page.drawLine({
        start: { x: cx + bw * 0.42, y: cy + bh * 0.28 },
        end: { x: cx + bw * 0.82, y: cy + bh * 0.75 },
        thickness: t,
        color: black,
      });
      continue;
    }

    // ── 이미지 / 사인: 박스 안에 비율 유지하며 삽입
    if (kind === "image" || kind === "signature") {
      const img = input.images?.get(ov.key);
      if (!img) continue;
      const bw = ov.w && ov.w > 0 ? ov.w : 80;
      const bh = ov.h && ov.h > 0 ? ov.h : 80;
      try {
        const embedded =
          img.type === "png"
            ? await pdf.embedPng(img.bytes)
            : await pdf.embedJpg(img.bytes);
        const scale = Math.min(bw / embedded.width, bh / embedded.height);
        const dw = embedded.width * scale;
        const dh = embedded.height * scale;
        page.drawImage(embedded, {
          x: ov.x + (bw - dw) / 2,
          y: ov.y + (bh - dh) / 2,
          width: dw,
          height: dh,
        });
      } catch {
        // 임베드 실패(손상·미지원 포맷) — 건너뜀
      }
      continue;
    }

    // ── 텍스트 (학생데이터 / 생성 시 입력)
    const text = foldLatinDiacritics((input.values.get(ov.key) ?? "").trim());
    if (!text) continue;
    const font = pickFont(text);

    if (ov.w && ov.w > 0 && ov.h && ov.h > 0) {
      // ── 박스 모드: (x,y)=좌하단, 텍스트를 박스 안에 맞춰 축소·줄바꿈하고 세로 가운데 정렬.
      const maxW = Math.max(4, ov.w - PAD * 2);
      let size = ov.size ?? DEFAULT_SIZE;
      let lines = wrapText(text, font, size, maxW);
      // 너비 또는 높이를 넘으면 폰트 축소
      while (
        size > MIN_SIZE &&
        (lines.length * (size + LINE_GAP) > ov.h - PAD ||
          lines.some((l) => font.widthOfTextAtSize(l, size) > maxW))
      ) {
        size -= 0.5;
        lines = wrapText(text, font, size, maxW);
      }
      const lineHeight = size + LINE_GAP;
      const blockH = lines.length * lineHeight - LINE_GAP;
      // 첫 줄 baseline: 박스 위에서부터 세로 가운데. (y+h)=박스 top.
      const top = ov.y + ov.h;
      let baseline = top - (ov.h - blockH) / 2 - size;
      for (const line of lines) {
        page.drawText(line, {
          x: ov.x + PAD,
          y: baseline,
          size,
          font,
          color: black,
        });
        baseline -= lineHeight;
      }
    } else {
      // ── 레거시 점 모드: (x,y)=baseline. maxWidth 만 적용.
      let size = ov.size ?? DEFAULT_SIZE;
      const mw = ov.maxWidth && ov.maxWidth > 0 ? ov.maxWidth : 0;
      if (mw && !text.includes("\n")) {
        while (size > MIN_SIZE && font.widthOfTextAtSize(text, size) > mw) {
          size -= 0.5;
        }
      }
      const lines = mw ? wrapText(text, font, size, mw) : text.split("\n");
      const lineHeight = size + LINE_GAP;
      lines.forEach((line, i) => {
        page.drawText(line, {
          x: ov.x,
          y: ov.y - i * lineHeight,
          size,
          font,
          color: black,
        });
      });
    }
  }

  return await pdf.save();
}
