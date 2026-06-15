import { redirect } from "next/navigation";

import { CbtQuiz } from "@/components/cbt-quiz";
import { createClient } from "@/lib/supabase/server";
import { getAuthState, hasFeatureAccess } from "@/lib/auth";
import { getDict } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const TOTAL_QUESTIONS = 30;

function sampleArray<T>(arr: T[], n: number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

export default async function CbtQuizPage({
  searchParams,
}: {
  searchParams: Promise<{ chapter?: string }>;
}) {
  const sp = await searchParams;
  const chapter = sp.chapter ?? "all";

  const auth = await getAuthState();
  if (auth.kind !== "mapped") {
    redirect(auth.kind === "guest" ? "/login?next=/cbt" : "/verify");
  }

  if (!hasFeatureAccess(auth.customer, "cbt")) {
    redirect("/cbt");
  }

  const supabase = await createClient();
  const t = await getDict();

  // 1. 후보 ID 풀 fetch
  const idsQuery = supabase
    .from("cbt_questions")
    .select("id")
    .eq("active", true);
  if (chapter !== "all") idsQuery.eq("chapter", chapter);
  const { data: idRows } = await idsQuery;

  if (!idRows || idRows.length === 0) {
    return (
      <div className="page-wrap" style={{ textAlign: "center" }}>
        <p>출제 가능한 문제가 없습니다.</p>
      </div>
    );
  }

  // 2. 30개 랜덤 샘플
  const sampledIds = sampleArray(
    idRows.map((r) => r.id),
    Math.min(TOTAL_QUESTIONS, idRows.length)
  );

  // 3. 풀 데이터 fetch (id 순서대로 받아서 다시 셔플)
  const { data: questions } = await supabase
    .from("cbt_questions")
    .select("id, chapter, question, choices")
    .in("id", sampledIds);

  if (!questions || questions.length === 0) {
    return (
      <div className="page-wrap" style={{ textAlign: "center" }}>
        <p>출제 가능한 문제가 없습니다.</p>
      </div>
    );
  }

  // 셔플 (sampledIds 순서대로 정렬)
  const indexMap = new Map(sampledIds.map((id, i) => [id, i]));
  const ordered = [...questions].sort(
    (a, b) => (indexMap.get(a.id) ?? 0) - (indexMap.get(b.id) ?? 0)
  );

  return (
    <div className="page-wrap fade-up">
      <CbtQuiz
        questions={ordered}
        chapterFilter={chapter}
        strings={{
          q: t["cbt.quiz.q"],
          of: t["cbt.quiz.of"],
          unanswered: t["cbt.quiz.unanswered"],
          submit: t["cbt.quiz.submit"],
          confirm: t["cbt.quiz.confirm_unanswered"],
          prev: t["cbt.quiz.previous"],
          next: t["cbt.quiz.next"],
        }}
      />
    </div>
  );
}
