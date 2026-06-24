import path from "node:path";
import { promises as fs } from "node:fs";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
// CommonJS — default import
import ImageModule from "docxtemplater-image-module-free";

import { resumeDraftDataSchema, type ResumeDraftData } from "@/lib/validators";

const TEMPLATE_PATH = path.join(
  process.cwd(),
  "templates",
  "resume-template.docx"
);

/** EMU 단위 — 사진 크기 (가로 × 세로). 약 3 × 4 cm. */
const PHOTO_SIZE: [number, number] = [113, 151];

/**
 * 이력서 docx 생성 — template (placeholder) 에 학생 입력 + 사진 채워 Buffer 반환.
 */
export async function generateResumeDocx(
  rawData: unknown,
  photoBuffer?: Buffer | null
): Promise<Buffer> {
  const data: ResumeDraftData = resumeDraftDataSchema.parse(rawData);

  const content = await fs.readFile(TEMPLATE_PATH);
  const zip = new PizZip(content);

  // 이미지 모듈 — `{%photo}` 토큰 자리에 사진 삽입. 사진 없으면 빈 칸.
  const imageModule = new ImageModule({
    centered: false,
    getImage: () => photoBuffer ?? Buffer.alloc(0),
    getSize: () => PHOTO_SIZE,
  });

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => "",
    modules: photoBuffer && photoBuffer.length > 0 ? [imageModule] : [],
  });

  const narrative = data.narrative_polished?.trim() || data.narrative_raw || "";

  doc.render({
    name_vi: data.name_vi,
    name_kr: data.name_kr,
    birth_date: data.birth_date,
    phone: data.phone,
    email: data.email,
    address: data.address,
    one_liner: data.one_liner,
    narrative,
    educations: data.educations,
    careers: data.careers,
    certifications: data.certifications,
    skills: data.skills,
    activities: data.activities,
    // 사진 토큰. photo 자체는 image module 의 getImage 로 처리되므로 값 무관.
    photo: photoBuffer && photoBuffer.length > 0 ? "photo" : "",
  });

  const out = doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });
  return out as Buffer;
}
