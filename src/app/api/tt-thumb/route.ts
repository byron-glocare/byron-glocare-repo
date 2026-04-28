/**
 * TikTok 썸네일 프록시.
 *
 * 클라이언트가 TikTok CDN 으로 직접 요청하면 Referer 기반 hotlink 차단 가능.
 * 서버 사이드에서:
 *   1) oEmbed → thumbnail_url 획득
 *   2) thumbnail_url 을 TikTok-friendly Referer 로 직접 fetch
 *   3) 이미지 바이트를 그대로 스트리밍 + 1일 캐시
 *
 * 사용: <img src="/api/tt-thumb?url={tiktok_video_url}" />
 */

const ALLOWED_PREFIX = "https://www.tiktok.com/";
const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
} as const;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const videoUrl = searchParams.get("url");

  if (!videoUrl || !videoUrl.startsWith(ALLOWED_PREFIX)) {
    return new Response("invalid url", { status: 400 });
  }

  try {
    // 1) oEmbed
    const oembed = await fetch(
      `https://www.tiktok.com/oembed?url=${encodeURIComponent(videoUrl)}`,
      { next: { revalidate: 86400 } }
    );
    if (!oembed.ok) {
      return new Response("oembed failed", {
        status: 502,
        headers: CACHE_HEADERS,
      });
    }
    const data = (await oembed.json()) as { thumbnail_url?: string };
    const thumbUrl = data.thumbnail_url;
    if (!thumbUrl) {
      return new Response("no thumbnail", {
        status: 404,
        headers: CACHE_HEADERS,
      });
    }

    // 2) Fetch the actual image with TikTok Referer
    const img = await fetch(thumbUrl, {
      headers: {
        Referer: "https://www.tiktok.com/",
        "User-Agent":
          "Mozilla/5.0 (compatible; GlocareBot/1.0; +https://youstudyinkorea.com)",
      },
      next: { revalidate: 86400 },
    });
    if (!img.ok) {
      return new Response("image fetch failed", {
        status: 502,
        headers: CACHE_HEADERS,
      });
    }

    const contentType = img.headers.get("content-type") ?? "image/jpeg";
    const buf = await img.arrayBuffer();

    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        ...CACHE_HEADERS,
      },
    });
  } catch (err) {
    return new Response("proxy error: " + (err as Error).message, {
      status: 500,
    });
  }
}
