/**
 * glocare_homepage_abroad 의 /api/admission/analyze-form 호출 헬퍼 (B4-7).
 */

import "server-only";

const DEFAULT_URL = "https://youstudyinkorea.com/api/admission/analyze-form";

function endpointUrl(): string {
  // EXTRACTION_API_URL 의 base 를 재사용 (같은 도메인)
  const ext = process.env.EXTRACTION_API_URL?.trim();
  if (ext) {
    // /extract → /analyze-form 으로 치환
    return ext.replace(/\/api\/admission\/extract\/?$/, "/api/admission/analyze-form");
  }
  return DEFAULT_URL;
}

function internalToken(): string {
  const t = process.env.INTERNAL_API_TOKEN?.trim();
  if (!t) {
    throw new Error("INTERNAL_API_TOKEN 환경변수 누락");
  }
  return t;
}

export type AvailableDataType = {
  key: string;
  label_ko: string;
  category: string;
  is_essay_basis: boolean;
  /** 같은 의미의 다른 이름 — AI 가 양식의 별칭 표현을 이 키로 매칭 */
  aliases?: string[];
  /** 파생(택1) 항목 여부 */
  is_derived?: boolean;
};

export type SuggestedMissingDataType = {
  key: string;
  label_ko: string;
  label_vi: string;
  category:
    | "identity" | "education" | "family" | "financial" | "language"
    | "contact" | "career" | "essay" | "document" | "other";
  input_type:
    | "text" | "long_text" | "date" | "number"
    | "select" | "multi_select" | "file" | "boolean";
  hint_ko?: string;
  reason?: string;
};

export type EssaySubQuestion = {
  question_ko: string;
  question_vi: string;
  hint_vi?: string;
  data_type_key?: string;
};

export type AnalyzeFormCallResult =
  | {
      ok: true;
      essay_questions: Array<{
        question_ko: string;
        max_chars?: number;
        basis_data_type_keys: string[];
        sub_questions: EssaySubQuestion[];
      }>;
      suggested_required_data_keys: string[];
      missing_data_types: SuggestedMissingDataType[];
      detected_format: "hwp" | "hwpx" | "pdf";
      analysis_notes: string;
      usage: {
        input_tokens: number;
        output_tokens: number;
        cache_read_input_tokens?: number;
        cache_creation_input_tokens?: number;
      };
    }
  | { ok: false; error: string };

export async function callAnalyzeForm(input: {
  fileUrl: string;
  fileName: string;
  availableDataTypes: AvailableDataType[];
}): Promise<AnalyzeFormCallResult> {
  let res: Response;
  try {
    res = await fetch(endpointUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Token": internalToken(),
      },
      body: JSON.stringify({
        file_url: input.fileUrl,
        file_name: input.fileName,
        available_data_types: input.availableDataTypes,
      }),
    });
  } catch (e) {
    return {
      ok: false,
      error: `네트워크 오류: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { ok: false, error: `응답 파싱 실패 (HTTP ${res.status})` };
  }

  return json as AnalyzeFormCallResult;
}
