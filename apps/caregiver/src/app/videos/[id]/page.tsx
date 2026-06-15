import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { WatchedToggle } from "@/components/watched-toggle";
import { createClient } from "@/lib/supabase/server";
import { getAuthState, hasFeatureAccess } from "@/lib/auth";
import { getDict, getLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function VideoPlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) notFound();

  const auth = await getAuthState();
  if (auth.kind === "guest") redirect(`/login?next=/videos/${id}`);
  if (auth.kind === "unmapped") redirect("/verify");

  if (!hasFeatureAccess(auth.customer, "videos")) {
    redirect("/videos");
  }

  const t = await getDict();
  const locale = await getLocale();
  const supabase = await createClient();

  const [{ data: video }, { data: existingView }] = await Promise.all([
    supabase
      .from("videos")
      .select(
        "id, vimeo_id, title_ko, title_vi, desc_ko, desc_vi, tags, duration_seconds"
      )
      .eq("id", numericId)
      .eq("active", true)
      .maybeSingle(),
    supabase
      .from("video_views")
      .select("id")
      .eq("user_id", auth.userId)
      .eq("video_id", numericId)
      .maybeSingle(),
  ]);

  if (!video) notFound();

  const title =
    locale === "vi" ? video.title_vi : video.title_ko;
  const desc = locale === "vi" ? video.desc_vi : video.desc_ko;
  const watched = !!existingView;

  return (
    <div className="page-wrap fade-up" style={{ maxWidth: 920 }}>
      <Link
        href="/videos"
        style={{
          display: "inline-block",
          fontSize: "0.85rem",
          color: "var(--ink-light)",
          marginBottom: "1.2rem",
        }}
      >
        {t["videos.player.back"]}
      </Link>

      {/* Vimeo Embed */}
      <div
        style={{
          position: "relative",
          aspectRatio: "16/9",
          background: "#000",
          borderRadius: 14,
          overflow: "hidden",
          marginBottom: "1.5rem",
        }}
      >
        <iframe
          src={`https://player.vimeo.com/video/${video.vimeo_id}?title=0&byline=0&portrait=0`}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            border: 0,
          }}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
        />
      </div>

      {/* Title + meta */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "1rem",
          marginBottom: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: 240 }}>
          <h1
            style={{
              fontFamily: "var(--font-noto-serif-kr), serif",
              fontSize: "1.4rem",
              fontWeight: 800,
              color: "var(--ink)",
              lineHeight: 1.4,
              marginBottom: "0.5rem",
            }}
          >
            {title || "(제목 없음)"}
          </h1>
          {(video.tags ?? []).length > 0 && (
            <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
              {(video.tags ?? []).map((tag) => (
                <span
                  key={tag}
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    padding: "3px 9px",
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
        <WatchedToggle
          videoId={video.id}
          initialWatched={watched}
          labels={{
            mark: t["videos.player.mark_watched"],
            unmark: t["videos.player.unmark_watched"],
          }}
        />
      </div>

      {/* Description */}
      {desc && (
        <div
          className="card"
          style={{
            fontSize: "0.92rem",
            color: "var(--ink-mid)",
            lineHeight: 1.8,
            whiteSpace: "pre-line",
          }}
        >
          {desc}
        </div>
      )}
    </div>
  );
}
