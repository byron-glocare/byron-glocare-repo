import path from "node:path";
import { promises as fs } from "node:fs";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
// CommonJS — default import
import ImageModule from "docxtemplater-image-module-free";
import imageSize from "image-size";

import { buildTestData } from "@/lib/test/sample-student";

const TEMPLATES_DIR = path.join(process.cwd(), "templates");

/** 이미지 박스(px) — 서명은 넓고 낮게, 사진은 3.5×4.5cm 비율. */
const SIGNATURE_BOX: [number, number] = [170, 55];
const PHOTO_BOX: [number, number] = [128, 165];

/** 원본 비율 유지하며 박스 안에 fit (박스를 넘지 않음). */
function fitInBox(
  w: number,
  h: number,
  boxW: number,
  boxH: number
): [number, number] {
  if (w <= 0 || h <= 0) return [boxW, boxH];
  const imgRatio = w / h;
  const boxRatio = boxW / boxH;
  if (imgRatio > boxRatio) return [boxW, Math.round(boxW / imgRatio)];
  return [Math.round(boxH * imgRatio), boxH];
}

export type FillError = {
  message: string;
  /** docxtemplater 다중 오류(닫히지 않은 태그 등) 상세 — 운영자가 원본을 고치도록 안내 */
  details?: string[];
};

/**
 * 템플릿화된 DOCX(운영자가 {{토큰}}·{%사진}·{%서명} 을 심어둔 파일) 를
 * 테스트 학생 데이터로 채워 Buffer 반환.
 *
 * 방식 A: 원본을 재생성하지 않고 in-place 치환 → 서식/레이아웃 100% 보존.
 * 실패한 옛 방식(docx 라이브러리 재생성·셀 통째 덮어쓰기·범용 빈칸 자동탐지)은 쓰지 않음.
 */
export async function fillTestDocx(templateBuffer: Buffer): Promise<Buffer> {
  const [sigBuf, photoBuf] = await Promise.all([
    fs.readFile(path.join(TEMPLATES_DIR, "test-signature.png")),
    fs.readFile(path.join(TEMPLATES_DIR, "test-photo.png")),
  ]);

  const sigDim = safeSize(sigBuf);
  const photoDim = safeSize(photoBuf);

  const zip = new PizZip(templateBuffer);

  const imageModule = new ImageModule({
    centered: false,
    getImage: (value: string) =>
      value === "signature" ? sigBuf : photoBuf,
    getSize: (_img, _value, name): [number, number] =>
      name === "signature"
        ? fitInBox(sigDim[0], sigDim[1], SIGNATURE_BOX[0], SIGNATURE_BOX[1])
        : fitInBox(photoDim[0], photoDim[1], PHOTO_BOX[0], PHOTO_BOX[1]),
  });

  let doc: Docxtemplater;
  try {
    doc = new Docxtemplater(zip, {
      // 겹중괄호 — 원본에 우연히 있는 홑중괄호와 충돌 방지 + 운영자 가독성.
      //   텍스트: {{name_ko}}  ·  이미지: {{%photo}} {{%signature}}
      delimiters: { start: "{{", end: "}}" },
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => "", // 템플릿에 있으나 데이터에 없는 토큰 → 빈칸
      modules: [imageModule],
    });
  } catch (e) {
    throw toFillError(e);
  }

  try {
    doc.render({
      ...buildTestData(),
      // 이미지 토큰 값 — image module 이 값으로 사진/서명을 구분해 삽입
      photo: "photo",
      signature: "signature",
    });
  } catch (e) {
    throw toFillError(e);
  }

  const out = doc
    .getZip()
    .generate({ type: "nodebuffer", compression: "DEFLATE" });
  return out as Buffer;
}

function safeSize(buf: Buffer): [number, number] {
  try {
    const d = imageSize(buf);
    if (d.width && d.height) return [d.width, d.height];
  } catch {
    /* ignore */
  }
  return [1, 1];
}

/** docxtemplater 오류를 운영자용 메시지로 변환 (닫히지 않은 태그 등). */
function toFillError(e: unknown): Error & FillError {
  const err = e as {
    message?: string;
    properties?: { errors?: Array<{ properties?: { explanation?: string } }> };
  };
  const details = (err?.properties?.errors ?? [])
    .map((x) => x?.properties?.explanation)
    .filter((x): x is string => !!x);
  const out = new Error(
    err?.message || "양식 채움에 실패했습니다."
  ) as Error & FillError;
  if (details.length) out.details = details;
  return out;
}
