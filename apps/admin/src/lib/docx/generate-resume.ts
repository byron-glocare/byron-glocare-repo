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

/** pixels — 사진 크기 (가로 × 세로). 약 3.5 × 4.5 cm (abroad demo 패턴). */
const PHOTO_SIZE: [number, number] = [128, 165];

/** 1x1 투명 PNG — photo 없을 때 placeholder 자리 채움 (image module 항상 활성). */
const EMPTY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64"
);

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

  const hasPhoto = !!(photoBuffer && photoBuffer.length > 0);

  // 이미지 모듈 — `{%photo}` 토큰 자리에 사진 삽입. 항상 활성 (없으면 1x1 투명 png).
  const imageModule = new ImageModule({
    centered: true,
    getImage: () => (hasPhoto ? (photoBuffer as Buffer) : EMPTY_PNG),
    getSize: (_img, _tag, name) =>
      name === "photo" && hasPhoto ? PHOTO_SIZE : [1, 1],
  });

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => "",
    modules: [imageModule],
  });

  const narrative = data.narrative_polished?.trim() || data.narrative_raw || "";

  // 양식의 column 구조에 맞춰 schema 필드명 변환
  const educations = data.educations.map((e) => ({
    school: e.school,
    major: e.major,
    period:
      e.start_year && e.end_year
        ? `${e.start_year} ~ ${e.end_year}`
        : e.start_year || e.end_year,
    status: e.status,
  }));
  const certifications = data.certifications.map((c) => ({
    name: c.name,
    issuer: c.detail, // 양식의 "발급기관" 자리에 우리는 "상세" 표시
    date: c.date,
  }));
  const activities = data.activities.map((a) => ({
    name: a.name,
    period: a.period,
    org: "", // 양식에 "기관" 컬럼이 있지만 새 schema 엔 없음 — 빈 칸
    detail: a.detail,
  }));

  doc.render({
    name_vi: data.name_vi,
    name_kr: data.name_kr,
    birth_date: data.birth_date,
    phone: data.phone,
    email: data.email,
    address: data.address,
    one_liner: data.one_liner,
    narrative,
    educations,
    careers: data.careers,
    certifications,
    skills: data.skills,
    activities,
    // 사진 토큰. 값은 image module 의 getImage 에서 무시되지만 모든 케이스에서
    // 같은 키 전달 → 항상 image module 가 `{%photo}` placeholder 처리.
    photo: "photo",
  });

  const out = doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });
  return out as Buffer;
}
