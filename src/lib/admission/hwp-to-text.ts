/**
 * HWP / HWPX → Markdown 추출 (Vercel serverless 호환).
 *
 * 라이브러리: @ssabrojs/hwpxjs (Pure TS, .hwp + .hwpx 둘 다 지원)
 *   - .hwp (binary OLE/CFB) → hwpToMarkdown()
 *   - .hwpx (zipped XML) → HwpxReader.extractMarkdown()
 *   - 표·이미지 placeholder 보존
 *
 * 출력: Markdown 텍스트 (Claude Sonnet 의 text input 으로 전달).
 *   PDF 와 달리 vision 불필요 → 입력 토큰 비용 ↓ + 속도 ↑.
 */

import { detectFormat, hwpToMarkdown, HwpxReader } from "@ssabrojs/hwpxjs";

export type HwpExtractResult =
  | { ok: true; markdown: string; format: "hwp" | "hwpx"; bytes: number }
  | { ok: false; error: string };

export async function extractHwpMarkdown(
  buffer: Buffer | Uint8Array
): Promise<HwpExtractResult> {
  const data =
    buffer instanceof Uint8Array && !(buffer instanceof Buffer)
      ? buffer
      : new Uint8Array(buffer);

  const fmt = detectFormat(data);

  if (fmt === "unknown") {
    return {
      ok: false,
      error:
        "HWP / HWPX 형식이 아닙니다 (file signature 미일치). 파일이 손상되었거나 다른 형식일 수 있습니다.",
    };
  }
  if (fmt === "hwp3") {
    return {
      ok: false,
      error:
        "HWP 3.0 은 지원하지 않습니다. 한컴오피스에서 HWP 5.0 또는 HWPX 로 다시 저장 후 시도하세요.",
    };
  }

  try {
    if (fmt === "hwpx") {
      const reader = new HwpxReader();
      // ArrayBuffer 로 변환 (SharedArrayBuffer 회피)
      const ab = data.buffer.slice(
        data.byteOffset,
        data.byteOffset + data.byteLength
      ) as ArrayBuffer;
      await reader.loadFromArrayBuffer(ab);
      const md = await reader.extractMarkdown();
      return { ok: true, markdown: md, format: "hwpx", bytes: data.byteLength };
    }

    // fmt === "hwp"
    const md = await hwpToMarkdown(data);
    return { ok: true, markdown: md, format: "hwp", bytes: data.byteLength };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // 라이브러리가 throw 하는 특정 에러 식별
    if (msg.includes("Encrypted") || msg.includes("암호")) {
      return {
        ok: false,
        error:
          "암호화된 HWP/HWPX 파일입니다. 한컴오피스에서 암호 해제 후 다시 저장 → 업로드하세요.",
      };
    }
    if (msg.includes("Unsupported") || msg.includes("ViewText")) {
      return {
        ok: false,
        error:
          "지원하지 않는 HWP 변형 (배포용 ViewText 등). 한컴오피스에서 일반 HWP 로 다시 저장하세요.",
      };
    }
    return {
      ok: false,
      error: `HWP 파싱 실패: ${msg}`,
    };
  }
}

/**
 * 파일명만으로 HWP 계열 여부 판단.
 */
export function isHwpFileName(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.endsWith(".hwp") || lower.endsWith(".hwpx");
}
