import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { analyzeConsultation } from "@/lib/analyze-consultation";
import {
  analyzeConsultationRequestSchema,
} from "@/lib/consultation-tags";

/**
 * POST /api/analyze-consultation
 *
 * Body: { content: string, consultation_type: "training_center" | "care_home" }
 * Response 200: ConsultationAnalysis + usage
 * Response 4xx/5xx: { error: string }
 *
 * 실제 분석 로직은 src/lib/analyze-consultation.ts 의 analyzeConsultation()
 * 에 공유 — 상담 저장 서버 액션도 같은 함수를 직접 호출.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY 가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON 형식 오류" }, { status: 400 });
  }
  const parsed = analyzeConsultationRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "잘못된 입력" },
      { status: 400 }
    );
  }

  const analysis = await analyzeConsultation(
    apiKey,
    parsed.data.content,
    parsed.data.consultation_type
  );
  if (!analysis) {
    return NextResponse.json(
      { error: "분석 결과를 받지 못했습니다." },
      { status: 502 }
    );
  }
  return NextResponse.json(analysis);
}
