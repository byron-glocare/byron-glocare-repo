/**
 * glocare_homepage_abroad 의 /api/admission/extract 호출 헬퍼.
 *   - 서버 사이드 호출 (Server Action 또는 Route Handler 에서)
 *   - INTERNAL_API_TOKEN 헤더 인증
 *   - 다른 저장소(glocare_homepage_abroad) 의 백엔드를 thin client 로 활용
 */

import "server-only";

const DEFAULT_URL = "https://youstudyinkorea.com/api/admission/extract";

/** glocare_homepage_abroad API endpoint URL. env 우선, 없으면 production */
function endpointUrl(): string {
  return process.env.EXTRACTION_API_URL?.trim() || DEFAULT_URL;
}

function internalToken(): string {
  const t = process.env.INTERNAL_API_TOKEN?.trim();
  if (!t) {
    throw new Error(
      "INTERNAL_API_TOKEN 환경변수가 설정되지 않았습니다. .env.local 과 Vercel 환경변수에 추가하세요."
    );
  }
  return t;
}

// 본 저장소의 src/lib/admission/extract.ts 의 ExtractResult 와 동일 타입
// (전체 spec 타입은 후속 라운드에 zod 또는 OpenAPI 로 공유)
export type CallExtractResult =
  | {
      ok: true;
      spec: Record<string, unknown>;
      raw: string;
      usage: {
        input_tokens: number;
        output_tokens: number;
        cache_read_input_tokens?: number;
        cache_creation_input_tokens?: number;
      };
      confidence: number;
    }
  | {
      ok: false;
      error: string;
      raw?: string;
    };

export async function callExtractAdmission(params: {
  file: File;
  universityNameKo: string;
  term: string;
  admissionCategory?: string;
}): Promise<CallExtractResult> {
  const fd = new FormData();
  fd.append("file", params.file, params.file.name);
  fd.append("university_name_ko", params.universityNameKo);
  fd.append("term", params.term);
  if (params.admissionCategory) {
    fd.append("admission_category", params.admissionCategory);
  }

  let res: Response;
  try {
    res = await fetch(endpointUrl(), {
      method: "POST",
      headers: {
        "X-Internal-Token": internalToken(),
      },
      body: fd,
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
    return {
      ok: false,
      error: `응답 파싱 실패 (HTTP ${res.status})`,
    };
  }

  return json as CallExtractResult;
}
