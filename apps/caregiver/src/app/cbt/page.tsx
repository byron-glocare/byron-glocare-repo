import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { getAuthState, hasFeatureAccess } from "@/lib/auth";
import { getDict } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function CbtLandingPage() {
  const t = await getDict();
  const auth = await getAuthState();

  // 멤버십 체크 — 비로그인은 middleware 가 가로챔. 여기 도달했으면 로그인은 됨.
  if (auth.kind !== "mapped") {
    return <UnmappedNotice t={t} />;
  }

  const access = hasFeatureAccess(auth.customer, "cbt");
  if (!access) {
    return <LockedView t={t} />;
  }

  const supabase = await createClient();

  // 챕터별 문제 수 집계
  const { data: chapterCounts } = await supabase
    .from("cbt_questions")
    .select("chapter")
    .eq("active", true);

  const counts = new Map<string, number>();
  for (const row of chapterCounts ?? []) {
    counts.set(row.chapter, (counts.get(row.chapter) ?? 0) + 1);
  }
  const totalCount = chapterCounts?.length ?? 0;

  // 챕터 목록 (정렬: 1~15, mock, unknown)
  const chapters = Array.from(counts.keys()).sort((a, b) => {
    const aN = parseInt(a, 10);
    const bN = parseInt(b, 10);
    if (Number.isFinite(aN) && Number.isFinite(bN)) return aN - bN;
    if (Number.isFinite(aN)) return -1;
    if (Number.isFinite(bN)) return 1;
    return a.localeCompare(b);
  });

  // 최근 응시
  const { data: attempts } = await supabase
    .from("cbt_attempts")
    .select("id, finished_at, score, total, chapter_filter")
    .eq("user_id", auth.userId)
    .order("started_at", { ascending: false })
    .limit(5);

  return (
    <div className="page-wrap fade-up" style={{ maxWidth: 880 }}>
      <div className="eyebrow">{t["cbt.eyebrow"]}</div>
      <h1 className="page-title">
        <em>{t["cbt.title"]}</em>
      </h1>
      <p className="page-desc">{t["cbt.intro"]}</p>

      {/* 챕터 선택 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
          gap: "0.7rem",
          marginTop: "1.5rem",
        }}
      >
        {/* 전체 */}
        <Link href="/cbt/quiz?chapter=all" className="card chapter-card">
          <div className="chapter-num">{t["cbt.chapter.all"]}</div>
          <div className="chapter-count">{totalCount}</div>
        </Link>

        {chapters.map((ch) => (
          <Link
            key={ch}
            href={`/cbt/quiz?chapter=${encodeURIComponent(ch)}`}
            className="card chapter-card"
          >
            <div className="chapter-num">
              {ch === "mock"
                ? t["cbt.chapter.mock"]
                : `${t["cbt.chapter.label"]} ${ch}`}
            </div>
            <div className="chapter-count">{counts.get(ch)}</div>
          </Link>
        ))}
      </div>

      {/* 최근 응시 */}
      <h2
        style={{
          fontFamily: "var(--font-noto-serif-kr), serif",
          fontSize: "1.1rem",
          fontWeight: 800,
          marginTop: "3rem",
          marginBottom: "1rem",
        }}
      >
        {t["cbt.recent"]}
      </h2>
      {!attempts || attempts.length === 0 ? (
        <div
          className="card"
          style={{
            textAlign: "center",
            padding: "2rem",
            color: "var(--ink-light)",
            fontSize: "0.9rem",
          }}
        >
          {t["cbt.no_attempts"]}
        </div>
      ) : (
        <div style={{ display: "grid", gap: "0.6rem" }}>
          {attempts.map((a) => (
            <Link
              key={a.id}
              href={`/cbt/result/${a.id}`}
              className="card"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0.9rem 1.2rem",
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.92rem" }}>
                  {a.chapter_filter
                    ? a.chapter_filter === "mock"
                      ? t["cbt.chapter.mock"]
                      : `${t["cbt.chapter.label"]} ${a.chapter_filter}`
                    : t["cbt.chapter.all"]}
                </div>
                <div
                  style={{
                    fontSize: "0.78rem",
                    color: "var(--ink-light)",
                    marginTop: "2px",
                  }}
                >
                  {a.finished_at
                    ? new Date(a.finished_at).toLocaleString("ko-KR")
                    : "—"}
                </div>
              </div>
              <div
                style={{
                  fontFamily: "var(--font-noto-serif-kr), serif",
                  fontSize: "1.4rem",
                  fontWeight: 900,
                  color:
                    (a.score ?? 0) >= a.total * 0.7
                      ? "var(--green)"
                      : "var(--coral)",
                }}
              >
                {a.score}
                <span
                  style={{
                    fontSize: "0.85rem",
                    color: "var(--ink-xlight)",
                    fontWeight: 400,
                  }}
                >
                  /{a.total}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <style>{`
        .chapter-card {
          padding: 1.2rem 1rem;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s;
          color: inherit;
          display: block;
        }
        .chapter-card:hover {
          border-color: var(--coral);
          transform: translateY(-2px);
          background: var(--coral-pale);
        }
        .chapter-num {
          font-family: var(--font-noto-serif-kr), serif;
          font-size: 0.95rem;
          font-weight: 800;
          color: var(--ink);
          margin-bottom: 0.4rem;
        }
        .chapter-count {
          font-family: var(--font-noto-serif-kr), serif;
          font-size: 1.5rem;
          font-weight: 900;
          color: var(--coral);
          line-height: 1;
        }
        .chapter-count::after {
          content: ' 문제';
          font-family: var(--font-be-vietnam), sans-serif;
          font-size: 0.65rem;
          font-weight: 400;
          color: var(--ink-xlight);
          margin-left: 4px;
        }
      `}</style>
    </div>
  );
}

function UnmappedNotice({ t }: { t: Awaited<ReturnType<typeof getDict>> }) {
  return (
    <div
      className="page-wrap"
      style={{ textAlign: "center", maxWidth: 480 }}
    >
      <div className="eyebrow">{t["cbt.eyebrow"]}</div>
      <h1 className="page-title">계정 연동 필요</h1>
      <p className="page-desc">
        먼저 본인 확인을 완료해주세요. 글로케어 등록 정보와 SNS 계정을 연결해야
        CBT 를 시작할 수 있습니다.
      </p>
      <Link href="/verify" className="btn-coral">
        본인 확인하기
      </Link>
    </div>
  );
}

function LockedView({ t }: { t: Awaited<ReturnType<typeof getDict>> }) {
  return (
    <div
      className="page-wrap"
      style={{ textAlign: "center", maxWidth: 480 }}
    >
      <div className="eyebrow" style={{ background: "#FFF8E1", color: "#7E5C00", borderColor: "#FFE082" }}>
        🔒 {t["cbt.locked.title"]}
      </div>
      <h1 className="page-title">{t["cbt.title"]}</h1>
      <p className="page-desc">{t["cbt.locked.desc"]}</p>
      <Link href="/about#training" className="btn-coral">
        {t["cbt.locked.cta"]}
      </Link>
    </div>
  );
}
