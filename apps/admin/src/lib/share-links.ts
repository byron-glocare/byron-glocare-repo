/**
 * 문자 발송용 파일 다운로드 단축 링크 (/d/<code>) 공통 상수.
 * 링크 도메인은 go.glocare.co.kr (Vercel admin 프로젝트에 연결됨).
 * 이 도메인에서는 proxy 가 /d/* 외 모든 경로를 막는다.
 */
export const SHARE_FILES_BUCKET = "share-files";
export const SHARE_LINK_TTL_DAYS = 30;
export const SHARE_LINK_HOST = "go.glocare.co.kr";

export function shareLinkUrl(code: string): string {
  const base = (
    process.env.NEXT_PUBLIC_SHARE_LINK_BASE_URL ?? `https://${SHARE_LINK_HOST}`
  ).replace(/\/+$/, "");
  return `${base}/d/${code}`;
}

/** /d/<code> 코드 형식 (base62 10자). */
export const SHARE_CODE_RE = /^[0-9A-Za-z]{10}$/;
