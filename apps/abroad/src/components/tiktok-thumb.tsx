"use client";

import { useState } from "react";

/**
 * TikTok 썸네일.
 *
 * 우선순위:
 *  1) videoUrl 이 있으면 → /api/tt-thumb?url=... 프록시 사용 (oEmbed 통해 자동 추출)
 *  2) src 만 있으면 → 직접 + referrerPolicy="no-referrer"
 *  3) 둘 다 실패하면 → 연회색 단색 면 (디자인 시스템: 그라디언트·이모지 금지)
 */
export function TikTokThumb({
  src,
  videoUrl,
  alt,
}: {
  src?: string | null;
  videoUrl?: string | null;
  alt: string;
}) {
  const [failed, setFailed] = useState(false);

  const useProxy = !!videoUrl;
  const finalSrc = useProxy
    ? `/api/tt-thumb?url=${encodeURIComponent(videoUrl)}`
    : src || null;

  if (!finalSrc || failed) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          minHeight: 120,
          background: "var(--gc-subtle)",
        }}
        aria-label={alt}
      />
    );
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={finalSrc}
      alt={alt}
      referrerPolicy={useProxy ? undefined : "no-referrer"}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
