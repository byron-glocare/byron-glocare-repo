/**
 * 업로드 파일 크기 한도 — 한도를 넘으면 화면이 죽지 않고 안내 문구를 보여준다.
 *
 *   · 저장소로 바로 올리는 곳(작성서류 양식): Storage 버킷 한도 30MB.
 *   · 아직 서버로 파일을 실어 보내는 곳(모집요강 AI 추출, 온라인 접수 가이드):
 *     Vercel 서버 함수 요청 본문 한도 ~4.5MB, base64 로 1.33배 커지므로 실제 파일은 3MB 까지.
 *     (next.config 의 bodySizeLimit 로는 이 한도를 못 올린다.)
 */

export const DIRECT_UPLOAD_MAX_MB = 30;
export const INLINE_UPLOAD_MAX_MB = 3;

const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);

/** 한도 안이면 null, 넘으면 안내 문구 */
export function fileTooLargeMessage(file: File, maxMb: number): string | null {
  if (file.size <= maxMb * 1024 * 1024) return null;
  const isDocx = /\.docx$/i.test(file.name);
  const tip = isDocx
    ? " 워드 파일이면 글꼴이 파일 안에 들어가 있는 경우가 많습니다. 워드 → 파일 → 옵션 → 저장에서 \"파일의 글꼴 포함\"을 끄고 다시 저장하면 크게 줄어듭니다."
    : /\.pdf$/i.test(file.name)
      ? " PDF 는 인쇄 → PDF로 저장을 다시 하거나, 필요한 쪽만 나눠 저장하면 줄어듭니다."
      : "";
  return `파일이 큽니다 (${mb(file.size)}MB). 최대 ${maxMb}MB까지 올릴 수 있습니다.${tip}`;
}
