"use client";

import { useState } from "react";

/**
 * TikTok CDN 은 Referer 기반 hotlink 차단을 자주 걸기 때문에
 * referrerPolicy="no-referrer" 로 시도 → 실패 시 코랄 그라데이션 fallback.
 */
export function TikTokThumb({
  src,
  alt,
}: {
  src: string | null | undefined;
  alt: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
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
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
