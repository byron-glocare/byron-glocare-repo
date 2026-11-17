"use client";

import { useEffect, useRef, useState } from "react";

/**
 * TikTok 썸네일.
 *
 * 우선순위:
 *  1) src(어드민 사례에 넣은 썸네일 주소)가 있으면 → 직접 + referrerPolicy="no-referrer"
 *  2) 없고 videoUrl 이 있으면 → /api/tt-thumb?url=... 프록시 (oEmbed 로 자동 추출)
 *     ※ 2026-11 기준 TikTok oEmbed 가 thumbnail_url 을 주지 않아 실패한다 → 3) 으로 떨어진다.
 *  3) 실패하면 → 연회색 단색 면 (디자인 시스템: 그라디언트·이모지 금지)
 *
 * 서버 렌더된 <img> 가 하이드레이션 전에 실패하면 onError 를 놓친다 → 마운트 때 한 번 더 확인.
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
  const imgRef = useRef<HTMLImageElement>(null);

  const direct = !!src?.trim();
  const finalSrc = direct
    ? src!.trim()
    : videoUrl
      ? `/api/tt-thumb?url=${encodeURIComponent(videoUrl)}`
      : null;

  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, [finalSrc]);

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
      ref={imgRef}
      src={finalSrc}
      alt={alt}
      referrerPolicy={direct ? "no-referrer" : undefined}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
