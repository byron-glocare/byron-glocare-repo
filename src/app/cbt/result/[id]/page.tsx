import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getAuthState } from "@/lib/auth";
import { getDict, getLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function CbtResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) notFound();

  const auth = await getAuthState();
  if (auth.kind === "guest") {
    redirect(`/login?next=/cbt/result/${id}`);
  }

  const supabase = await createClient();
  const t = await getDict();
  const locale = await getLocale();

  const { data: attempt } = await supabase
    .from("cbt_attempts")
    .select("*")
    .eq("id", numericId)
    .maybeSingle();

  if (!attempt) notFound();

  // 본인만 조회 가능
  if (auth.kind !== "mapped" || attempt.user_id !== auth.userId) {
    redirect("/cbt");
  }

  const { data: questions } = await supabase
    .from("cbt_questions")
    .select(
      "id, chapter, question, choices, answer_index, intent_ko, intent_vi, choice_explanations, key_terms"
    )
    .in("id", attempt.question_ids);

  const qMap = new Map((questions ?? []).map((q) => [q.id, q]));
  const score = attempt.score ?? 0;
  const total = attempt.total;
  const pct = (score / total) * 100;

  return (
    <div className="page-wrap fade-up" style={{ maxWidth: 720 }}>
      <div className="eyebrow">{t["cbt.result.title"]}</div>

      {/* Score banner */}
      <div
        className="card"
        style={{
          textAlign: "center",
          padding: "2.5rem",
          background:
            pct >= 70
              ? "linear-gradient(135deg, var(--green) 0%, #57c399 100%)"
              : "linear-gradient(135deg, var(--coral) 0%, var(--coral-l) 100%)",
          color: "var(--white)",
          border: "none",
        }}
      >
        <div style={{ fontSize: "0.9rem", opacity: 0.85, marginBottom: "0.6rem" }}>
          {attempt.chapter_filter
            ? attempt.chapter_filter === "mock"
              ? t["cbt.chapter.mock"]
              : `${t["cbt.chapter.label"]} ${attempt.chapter_filter}`
            : t["cbt.chapter.all"]}
        </div>
        <div
          style={{
            fontFamily: "var(--font-noto-serif-kr), serif",
            fontSize: "4rem",
            fontWeight: 900,
            lineHeight: 1,
          }}
        >
          {score}
          <span style={{ fontSize: "2rem", opacity: 0.7 }}>/{total}</span>
        </div>
        <div
          style={{
            fontSize: "1.05rem",
            fontWeight: 700,
            marginTop: "0.7rem",
            opacity: 0.95,
          }}
        >
          {pct.toFixed(0)}%
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: "0.6rem",
          margin: "1.5rem 0",
          justifyContent: "center",
        }}
      >
        <Link href="/cbt" className="btn-coral">
          {t["cbt.result.retry"]}
        </Link>
      </div>

      {/* 각 문제 리뷰 */}
      <div style={{ display: "grid", gap: "1rem" }}>
        {attempt.question_ids.map((qid, idx) => {
          const q = qMap.get(qid);
          if (!q) return null;
          const picked = attempt.answers[String(qid)];
          const correct = q.answer_index;
          const isCorrect = picked === correct;
          const intent = locale === "vi" ? q.intent_vi : q.intent_ko;
          const explanations = (q.choice_explanations ?? {}) as Record<
            string,
            string
          >;
          const keyTerms = (q.key_terms ?? []) as Array<{
            term_ko?: string;
            term_vi?: string;
            def_ko?: string;
            def_vi?: string;
          }>;

          return (
            <div
              key={qid}
              className="card"
              style={{
                borderLeft: `4px solid ${isCorrect ? "var(--green)" : "var(--coral)"}`,
                paddingLeft: "1.4rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "0.5rem",
                  fontSize: "0.78rem",
                }}
              >
                <span
                  style={{
                    color: "var(--ink-xlight)",
                  }}
                >
                  {idx + 1} / {total}
                  {q.chapter !== "mock" && (
                    <>
                      {" · "}
                      {t["cbt.chapter.label"]} {q.chapter}
                    </>
                  )}
                </span>
                <span
                  style={{
                    fontWeight: 700,
                    color: isCorrect ? "var(--green)" : "var(--coral)",
                  }}
                >
                  {isCorrect ? "✓" : "✗"}
                </span>
              </div>

              <div
                style={{
                  fontSize: "0.95rem",
                  color: "var(--ink)",
                  lineHeight: 1.7,
                  marginBottom: "1rem",
                  whiteSpace: "pre-line",
                }}
              >
                {q.question}
              </div>

              {/* 선택지 */}
              <div style={{ display: "grid", gap: "0.4rem", marginBottom: "1rem" }}>
                {q.choices.map((choice, i) => {
                  const cidx = i + 1;
                  const isCorrectChoice = cidx === correct;
                  const isPickedChoice = cidx === picked;
                  let bg = "var(--white)";
                  let border = "var(--border)";
                  let color = "var(--ink)";
                  if (isCorrectChoice) {
                    bg = "rgba(45,158,107,0.08)";
                    border = "var(--green)";
                  } else if (isPickedChoice && !isCorrectChoice) {
                    bg = "rgba(242,92,92,0.08)";
                    border = "var(--coral)";
                  }
                  return (
                    <div
                      key={i}
                      style={{
                        padding: "0.7rem 0.9rem",
                        background: bg,
                        border: `1.5px solid ${border}`,
                        borderRadius: 8,
                        fontSize: "0.88rem",
                        color,
                        lineHeight: 1.6,
                        display: "flex",
                        gap: "0.6rem",
                      }}
                    >
                      <span style={{ fontWeight: 700, opacity: 0.6 }}>
                        {cidx}.
                      </span>
                      <span style={{ flex: 1 }}>{choice}</span>
                      {isCorrectChoice && (
                        <span
                          style={{
                            fontSize: "0.72rem",
                            fontWeight: 800,
                            color: "var(--green)",
                          }}
                        >
                          {t["cbt.result.correct"]}
                        </span>
                      )}
                      {isPickedChoice && !isCorrectChoice && (
                        <span
                          style={{
                            fontSize: "0.72rem",
                            fontWeight: 800,
                            color: "var(--coral)",
                          }}
                        >
                          {t["cbt.result.your_answer"]}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 의도 */}
              {intent && (
                <details style={{ marginTop: "0.8rem" }}>
                  <summary
                    style={{
                      cursor: "pointer",
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      color: "var(--coral)",
                      padding: "0.4rem 0",
                    }}
                  >
                    📖 {t["cbt.result.intent"]}
                  </summary>
                  <div
                    style={{
                      fontSize: "0.85rem",
                      color: "var(--ink-mid)",
                      lineHeight: 1.7,
                      padding: "0.6rem 0",
                      whiteSpace: "pre-line",
                    }}
                  >
                    {intent}
                  </div>
                </details>
              )}

              {/* 보기 해설 */}
              {Object.keys(explanations).length > 0 && (
                <details style={{ marginTop: "0.4rem" }}>
                  <summary
                    style={{
                      cursor: "pointer",
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      color: "var(--coral)",
                      padding: "0.4rem 0",
                    }}
                  >
                    💬 {t["cbt.result.explanation"]}
                  </summary>
                  <div
                    style={{
                      fontSize: "0.82rem",
                      color: "var(--ink-mid)",
                      lineHeight: 1.7,
                      padding: "0.6rem 0",
                    }}
                  >
                    {Object.entries(explanations)
                      .filter(([, v]) => v && v.trim())
                      .map(([n, v]) => (
                        <div key={n} style={{ marginBottom: "0.5rem" }}>
                          <strong>({n})</strong>{" "}
                          <span style={{ whiteSpace: "pre-line" }}>{v}</span>
                        </div>
                      ))}
                  </div>
                </details>
              )}

              {/* 핵심 용어 */}
              {keyTerms.length > 0 && (
                <details style={{ marginTop: "0.4rem" }}>
                  <summary
                    style={{
                      cursor: "pointer",
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      color: "var(--coral)",
                      padding: "0.4rem 0",
                    }}
                  >
                    🔑 {t["cbt.result.terms"]}
                  </summary>
                  <div
                    style={{
                      fontSize: "0.82rem",
                      color: "var(--ink-mid)",
                      lineHeight: 1.7,
                      padding: "0.6rem 0",
                    }}
                  >
                    {keyTerms.map((kt, i) => (
                      <div
                        key={i}
                        style={{
                          marginBottom: "0.7rem",
                          padding: "0.6rem 0.8rem",
                          background: "var(--peach)",
                          borderRadius: 8,
                        }}
                      >
                        {kt.term_ko && (
                          <div>
                            <strong>{kt.term_ko}</strong>
                            {kt.def_ko && <>: {kt.def_ko}</>}
                          </div>
                        )}
                        {kt.term_vi && (
                          <div
                            style={{
                              color: "var(--ink-light)",
                              marginTop: 2,
                              fontStyle: "italic",
                            }}
                          >
                            <strong>{kt.term_vi}</strong>
                            {kt.def_vi && <>: {kt.def_vi}</>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
