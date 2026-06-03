"use server";

import { callExtractAdmission, type CallExtractResult } from "@/lib/admission/call-extract";

export type ExtractActionState =
  | {
      pending?: false;
      error?: string;
      result?: CallExtractResult;
    }
  | undefined;

export async function runExtractionAction(
  _prev: ExtractActionState,
  formData: FormData
): Promise<ExtractActionState> {
  const file = formData.get("file");
  const universityNameKo = formData.get("university_name_ko");
  const term = formData.get("term");
  const admissionCategory = formData.get("admission_category");

  if (!(file instanceof File) || file.size === 0) {
    return { error: "파일을 선택해주세요." };
  }
  const lower = file.name.toLowerCase();
  if (
    !lower.endsWith(".pdf") &&
    !lower.endsWith(".hwp") &&
    !lower.endsWith(".hwpx")
  ) {
    return {
      error: "지원 형식: .pdf / .hwp / .hwpx",
    };
  }
  if (typeof universityNameKo !== "string" || !universityNameKo.trim()) {
    return { error: "대학을 선택해주세요." };
  }
  if (typeof term !== "string" || !/^\d{4}-(Spring|Fall|Summer|Winter|Year)$/.test(term)) {
    return { error: "학기 형식 오류 (예: 2026-Spring)" };
  }

  const result = await callExtractAdmission({
    file,
    universityNameKo: universityNameKo.trim(),
    term,
    admissionCategory:
      typeof admissionCategory === "string" && admissionCategory.trim()
        ? admissionCategory.trim()
        : undefined,
  });

  return { result };
}
