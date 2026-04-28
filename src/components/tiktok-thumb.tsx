"use client";

import { useState } from "react";

/**
 * TikTok 썸네일.
 *
 * 우선순위:
 *  1) videoUrl 이 있으면 → /api/tt-thumb?url=... 프록시 사용 (oEmbed 통해 자동 추출)
 *  2) src 만 있으면 → 직접 + referrerPolicy="no-referrer"
 *  3) 둘 다 실패하면 → 코랄 그라데이션 fallback
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
          aspectRatio: "9/16",
          background:
            "linear-gradient(135deg,var(--coral-pale),var(--coral-soft))",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "2.4rem",
        }}
        aria-label={alt}
      >
        🎬
      </div>
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
