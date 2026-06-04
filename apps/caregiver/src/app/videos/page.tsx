import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { getAuthState, hasFeatureAccess } from "@/lib/auth";
import { getDict, getLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function VideosListPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string }>;
}) {
  const sp = await searchParams;
  const filterTag = sp.tag ?? "all";

  const t = await getDict();
  const locale = await getLocale();
  const auth = await getAuthState();

  if (auth.kind === "guest") {
    return null; // middleware redirect
  }
  if (auth.kind === "unmapped") {
    return <UnmappedNotice />;
  }
  if (!hasFeatureAccess(auth.customer.product_type, "videos")) {
    return <LockedView t={t} />;
  }

  const supabase = await createClient();

  const [{ data: videos }, { data: views }] = await Promise.all([
    supabase
      .from("videos")
      .select(
        "id, vimeo_id, title_ko, title_vi, desc_ko, desc_vi, tags, duration_seconds, thumbnail_url, sort_order"
      )
      .eq("active", true)
      .order("sort_order")
      .order("id"),
    supabase
      .from("video_views")
      .select("video_id")
      .eq("user_id", auth.userId),
  ]);

  const watchedSet = new Set((views ?? []).map((v) => v.video_id));

  // 태그 풀 (전체)
  const allTags = new Set<string>();
  for (const v of videos ?? []) {
    for (const tag of v.tags ?? []) allTags.add(tag);
  }
  const tagList = Array.from(allTags).sort();

  const filtered =
    filterTag === "all"
      ? (videos ?? [])
      : (videos ?? []).filter((v) => (v.tags ?? []).includes(filterTag));

  return (
    <div className="page-wrap fade-up">
      <div className="eyebrow">{t["videos.eyebrow"]}</div>
      <h1 className="page-title">
        <em>{t["videos.title"]}</em>
      </h1>
      <p className="page-desc">{t["videos.intro"]}</p>

      {/* 태그 필터 */}
      {tagList.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: "0.4rem",
            flexWrap: "wrap",
            marginBottom: "2rem",
          }}
        >
          <TagPill href="/videos" active={filterTag === "all"}>
            {t["videos.tag.all"]} ({videos?.length ?? 0})
          </TagPill>
          {tagList.map((tag) => {
            const count = (videos ?? []).filter((v) =>
              (v.tags ?? []).includes(tag)
            ).length;
            return (
              <TagPill
                key={tag}
                href={`/videos?tag=${encodeURIComponent(tag)}`}
                active={filterTag === tag}
              >
                {tag} ({count})
              </TagPill>
            );
          })}
        </div>
      )}

      {/* 영상 그리드 */}
      {filtered.length === 0 ? (
        <div
          className="card"
          style={{
            textAlign: "center",
            padding: "3rem",
            color: "var(--ink-light)",
            fontSize: "0.9rem",
          }}
        >
          {t["videos.empty"]}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "1.2rem",
          }}
        >
          {filtered.map((v) => {
            const title = locale === "vi" ? v.title_vi : v.title_ko;
            const desc = locale === "vi" ? v.desc_vi : v.desc_ko;
            const watched = watchedSet.has(v.id);
            return (
              <Link
                key={v.id}
                href={`/videos/${v.id}`}
                className="card"
                style={{
                  display: "block",
                  padding: 0,
                  overflow: "hidden",
                  color: "inherit",
                }}
              >
                <div
                  style={{
                    position: "relative",
                    aspectRatio: "16/9",
                    background: "var(--peach)",
                    overflow: "hidden",
                  }}
                >
                  {v.thumbnail_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={v.thumbnail_url}
                      alt={title ?? ""}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "2.4rem",
                      }}
                    >
                      🎬
                    </div>
                  )}
                  {/* play overlay */}
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "rgba(0,0,0,0.15)",
                    }}
                  >
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: "50%",
                        background: "rgba(255,255,255,0.95)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                      }}
                    >
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="var(--coral)"
                      >
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                  {/* watched badge */}
                  {watched && (
                    <div
                      style={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        background: "var(--green)",
                        color: "var(--white)",
                        padding: "3px 9px",
                        borderRadius: 12,
                        fontSize: "0.7rem",
                        fontWeight: 700,
                      }}
                    >
                      ✓ {t["videos.watched"]}
                    </div>
                  )}
                  {/* duration */}
                  {v.duration_seconds && (
                    <div
                      style={{
                        position: "absolute",
                        bottom: 8,
                        right: 8,
                        background: "rgba(0,0,0,0.7)",
                        color: "var(--white)",
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: "0.72rem",
                        fontWeight: 600,
                      }}
                    >
                      {formatDuration(v.duration_seconds)}
                    </div>
                  )}
                </div>
                <div style={{ padding: "1rem" }}>
                  <div
                    style={{
                      fontFamily: "var(--font-noto-serif-kr), serif",
                      fontSize: "0.95rem",
                      fontWeight: 700,
                      color: "var(--ink)",
                      marginBottom: "0.4rem",
                      lineHeight: 1.4,
                    }}
                  >
                    {title || "(제목 없음)"}
                  </div>
                  {desc && (
                    <div
                      style={{
                        fontSize: "0.8rem",
                        color: "var(--ink-light)",
                        lineHeight: 1.6,
                        marginBottom: "0.7rem",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {desc}
                    </div>
                  )}
                  {(v.tags ?? []).length > 0 && (
                    <div
                      style={{
                        display: "flex",
                        gap: "4px",
                        flexWrap: "wrap",
                      }}
                    >
                      {(v.tags ?? []).slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          style={{
                            fontSize: "0.68rem",
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: 10,
                            background: "var(--peach)",
                            color: "var(--coral-d)",
                            border: "1px solid var(--coral-soft)",
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TagPill({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      style={{
        padding: "6px 14px",
        borderRadius: 20,
        fontSize: "0.78rem",
        fontWeight: 700,
        border: `1.5px solid ${active ? "var(--coral)" : "var(--border-d)"}`,
        background: active ? "var(--coral)" : "var(--white)",
        color: active ? "var(--white)" : "var(--ink-light)",
      }}
    >
      {children}
    </Link>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function UnmappedNotice() {
  return (
    <div className="page-wrap" style={{ textAlign: "center", maxWidth: 480 }}>
      <h1 className="page-title">계정 연동 필요</h1>
      <p className="page-desc">먼저 본인 확인을 완료해주세요.</p>
      <Link href="/verify" className="btn-coral">
        본인 확인하기
      </Link>
    </div>
  );
}

function LockedView({ t }: { t: Awaited<ReturnType<typeof getDict>> }) {
  return (
    <div className="page-wrap" style={{ textAlign: "center", maxWidth: 480 }}>
      <div
        className="eyebrow"
        style={{
          background: "#FFF8E1",
          color: "#7E5C00",
          borderColor: "#FFE082",
        }}
      >
        🔒 {t["videos.locked.title"]}
      </div>
      <h1 className="page-title">{t["videos.title"]}</h1>
      <p className="page-desc">{t["videos.locked.desc"]}</p>
      <Link href="/about#training" className="btn-coral">
        교육 신청하기
      </Link>
    </div>
  );
}
