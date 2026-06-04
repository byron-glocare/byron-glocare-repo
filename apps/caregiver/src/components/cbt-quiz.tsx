"use client";

import { useMemo, useState, useTransition } from "react";

import { submitQuizAttempt } from "@/app/actions/cbt";

type Question = {
  id: number;
  chapter: string;
  question: string;
  choices: string[];
};

type Strings = {
  q: string;
  of: string;
  unanswered: string;
  submit: string;
  confirm: string;
  prev: string;
  next: string;
};

export function CbtQuiz({
  questions,
  chapterFilter,
  strings,
}: {
  questions: Question[];
  chapterFilter: string;
  strings: Strings;
}) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [pending, startTransition] = useTransition();
  const [activeIdx, setActiveIdx] = useState(0);

  const total = questions.length;
  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);
  const unansweredCount = total - answeredCount;
  const progressPct = (answeredCount / total) * 100;

  function pick(qid: number, choiceIdx: number) {
    setAnswers((prev) => ({ ...prev, [String(qid)]: choiceIdx }));
  }

  function onSubmit() {
    if (
      unansweredCount > 0 &&
      !window.confirm(strings.confirm)
    ) {
      return;
    }
    startTransition(async () => {
      await submitQuizAttempt(
        questions.map((q) => q.id),
        answers,
        chapterFilter
      );
    });
  }

  const q = questions[activeIdx];

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      {/* Progress */}
      <div
        style={{
          position: "sticky",
          top: 66, // nav height
          background: "var(--white)",
          padding: "1rem 0",
          marginBottom: "1.5rem",
          borderBottom: "1px solid var(--border)",
          zIndex: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "0.5rem",
          }}
        >
          <div
            style={{
              fontSize: "0.85rem",
              fontWeight: 700,
              color: "var(--ink)",
            }}
          >
            {strings.q} {activeIdx + 1} {strings.of} {total}
          </div>
          <div
            style={{
              fontSize: "0.78rem",
              color: unansweredCount > 0 ? "var(--coral)" : "var(--green)",
              fontWeight: 600,
            }}
          >
            {answeredCount}/{total}
            {unansweredCount > 0 && ` · ${strings.unanswered} ${unansweredCount}`}
          </div>
        </div>
        <div
          style={{
            height: 4,
            background: "var(--coral-pale)",
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progressPct}%`,
              background: "var(--coral)",
              transition: "width 0.2s",
            }}
          />
        </div>
      </div>

      {/* Active question */}
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div
          style={{
            fontSize: "0.78rem",
            color: "var(--ink-xlight)",
            marginBottom: "0.5rem",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>
            {q.chapter === "mock"
              ? "그림 중심 실전모의고사"
              : `챕터 ${q.chapter}`}
          </span>
          <span>#{q.id}</span>
        </div>
        <div
          style={{
            fontSize: "1rem",
            color: "var(--ink)",
            lineHeight: 1.7,
            marginBottom: "1.4rem",
            whiteSpace: "pre-line",
          }}
        >
          {q.question}
        </div>

        <div style={{ display: "grid", gap: "0.5rem" }}>
          {q.choices.map((choice, i) => {
            const idx = i + 1;
            const selected = answers[String(q.id)] === idx;
            return (
              <button
                key={i}
                type="button"
                onClick={() => pick(q.id, idx)}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.7rem",
                  padding: "0.9rem 1rem",
                  textAlign: "left",
                  border: `1.5px solid ${selected ? "var(--coral)" : "var(--border)"}`,
                  background: selected ? "var(--coral-pale)" : "var(--white)",
                  borderRadius: 10,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: "0.92rem",
                  color: "var(--ink)",
                  lineHeight: 1.6,
                  transition: "all 0.15s",
                }}
              >
                <span
                  style={{
                    flexShrink: 0,
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    background: selected ? "var(--coral)" : "var(--peach)",
                    color: selected ? "var(--white)" : "var(--ink-light)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 800,
                    fontSize: "0.78rem",
                  }}
                >
                  {idx}
                </span>
                <span>{choice}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Nav */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "0.6rem",
          marginBottom: "1.5rem",
        }}
      >
        <button
          type="button"
          className="btn-ghost"
          onClick={() => setActiveIdx(Math.max(0, activeIdx - 1))}
          disabled={activeIdx === 0}
          style={{ flex: 1 }}
        >
          ← {strings.prev}
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => setActiveIdx(Math.min(total - 1, activeIdx + 1))}
          disabled={activeIdx === total - 1}
          style={{ flex: 1 }}
        >
          {strings.next} →
        </button>
      </div>

      {/* Question grid (jump) */}
      <div
        style={{
          padding: "1rem",
          background: "var(--peach)",
          borderRadius: 12,
          marginBottom: "1.5rem",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(36px, 1fr))",
            gap: "6px",
          }}
        >
          {questions.map((qq, i) => {
            const answered = answers[String(qq.id)] !== undefined;
            const isActive = i === activeIdx;
            return (
              <button
                key={qq.id}
                type="button"
                onClick={() => setActiveIdx(i)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  border: `1.5px solid ${isActive ? "var(--coral)" : "var(--border)"}`,
                  background: isActive
                    ? "var(--coral)"
                    : answered
                      ? "var(--white)"
                      : "transparent",
                  color: isActive
                    ? "var(--white)"
                    : answered
                      ? "var(--coral)"
                      : "var(--ink-xlight)",
                  fontWeight: 700,
                  fontSize: "0.78rem",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      </div>

      {/* Submit */}
      <button
        type="button"
        className="btn-coral"
        onClick={onSubmit}
        disabled={pending}
        style={{ width: "100%", padding: "1rem" }}
      >
        {pending ? "..." : strings.submit}
      </button>
    </div>
  );
}
