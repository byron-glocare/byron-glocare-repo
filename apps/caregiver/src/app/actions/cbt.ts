"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type SubmitQuizResult =
  | { ok: true; attemptId: number; score: number }
  | { ok: false; error: string };

/**
 * 30 문제 응시 결과 저장 → result 페이지로 redirect.
 *
 * @param questionIds 출제된 문제 id 30개 (순서 유지)
 * @param answers     {qid: 선택한 보기 1~5} — 미응답은 0 또는 누락 가능
 * @param chapterFilter 'all' / '1' ~ '15' / 'mock'
 */
export async function submitQuizAttempt(
  questionIds: number[],
  answers: Record<string, number>,
  chapterFilter: string
): Promise<SubmitQuizResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };

  // 정답 채점 — 출제된 문제만 fetch
  const { data: questions } = await supabase
    .from("cbt_questions")
    .select("id, answer_index")
    .in("id", questionIds);

  if (!questions) return { ok: false, error: "문제 조회 실패" };

  const correctMap = new Map(questions.map((q) => [q.id, q.answer_index]));
  let score = 0;
  for (const qid of questionIds) {
    const picked = answers[String(qid)];
    if (picked && picked === correctMap.get(qid)) score++;
  }

  // 응시 저장
  const { data: attempt, error } = await supabase
    .from("cbt_attempts")
    .insert({
      user_id: user.id,
      finished_at: new Date().toISOString(),
      question_ids: questionIds,
      answers,
      score,
      total: questionIds.length,
      chapter_filter: chapterFilter === "all" ? null : chapterFilter,
    })
    .select("id")
    .single();

  if (error || !attempt) {
    return { ok: false, error: error?.message ?? "저장 실패" };
  }

  redirect(`/cbt/result/${attempt.id}`);
}
