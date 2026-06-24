import path from "node:path";
import { promises as fs } from "node:fs";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

import { resumeDraftDataSchema, type ResumeDraftData } from "@/lib/validators";

const TEMPLATE_PATH = path.join(
  process.cwd(),
  "templates",
  "resume-template.docx"
);

/**
 * 이력서 docx 생성 — template (placeholder) 에 학생 입력 데이터를 채워서 Buffer 반환.
 *
 * Phase 1: narrative 는 raw 그대로 (AI 다듬기 없음). Phase 2 에서 narrative_polished
 * 가 있으면 그것을 우선 사용.
 */
export async function generateResumeDocx(
  rawData: unknown
): Promise<Buffer> {
  const data: ResumeDraftData = resumeDraftDataSchema.parse(rawData);

  const content = await fs.readFile(TEMPLATE_PATH);
  const zip = new PizZip(content);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
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
  });

  const out = doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });
  return out as Buffer;
}
