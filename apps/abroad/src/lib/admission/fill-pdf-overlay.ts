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

export type FillOverlayInput = {
  /** 원본 양식 PDF 바이트 */
  pdfBytes: ArrayBuffer | Uint8Array;
  /** 한글 TTF 폰트 바이트 */
  fontBytes: ArrayBuffer | Uint8Array;
  /** 채울 좌표 목록 */
  overlays: FormFieldOverlay[];
  /** overlay.key → 그릴 텍스트 (이미 문자열로 변환된 값) */
  values: Map<string, string>;
};

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
  const font = await pdf.embedFont(input.fontBytes, { subset: true });

  const pages = pdf.getPages();
  const black = rgb(0.05, 0.05, 0.05);

  for (const ov of input.overlays) {
    const text = (input.values.get(ov.key) ?? "").trim();
    if (!text) continue;
    const page = pages[ov.page];
    if (!page) continue;

    let size = ov.size ?? DEFAULT_SIZE;

    if (ov.maxWidth && ov.maxWidth > 0) {
      // 한 줄로 들어가도록 폰트 축소 (MIN_SIZE 까지) → 그래도 넘치면 줄바꿈
      if (!text.includes("\n")) {
        while (
          size > MIN_SIZE &&
          font.widthOfTextAtSize(text, size) > ov.maxWidth
        ) {
          size -= 0.5;
        }
      }
      const lines = wrapText(text, font, size, ov.maxWidth);
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
    } else {
      // maxWidth 없음 — 명시적 \n 만 줄바꿈
      const lines = text.split("\n");
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
