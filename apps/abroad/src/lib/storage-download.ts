/**
 * Supabase Storage 공개 URL 을 "저장" 링크로 바꾼다.
 *
 * 공개 오브젝트 URL 은 Content-Disposition 없이 inline 으로 내려오기 때문에,
 * docx·hwp 처럼 브라우저가 렌더할 수 없는 형식은 탭만 열리고 아무 일도 일어나지
 * 않는다. `?download=<파일명>` 을 붙이면 스토리지가
 * `Content-Disposition: attachment; filename*=UTF-8''…` 로 응답한다.
 *
 * (<a download> 속성은 교차 출처에서 무시되므로 대안이 되지 않는다.)
 */

/** 파일명에 쓸 수 없는 문자 제거 + 공백 정리. */
function safeName(s: string): string {
  return s
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** 실제 이름이라 볼 수 있는가 (업로드 시 한글이 날아가 "__.docx" 만 남은 경우 방지). */
function isMeaningful(name: string): boolean {
  return /[\p{L}\p{N}]/u.test(name.replace(/\.[^.]+$/, ""));
}

/**
 * @param url        스토리지 공개 URL
 * @param preferred  내려받을 때 쓸 이름(서류명 등). 확장자는 없어도 된다.
 * @param fallback   업로드 당시 파일명. preferred 가 없을 때 사용.
 */
export function downloadUrl(
  url: string,
  preferred?: string | null,
  fallback?: string | null
): string {
  if (!url) return url;

  const ext =
    /\.([a-z0-9]{1,8})(?:\?|$)/i.exec(url.split("/").pop() ?? "")?.[1] ?? "";

  const candidates = [preferred, fallback].filter(
    (n): n is string => !!n && isMeaningful(n)
  );
  let name = candidates.length > 0 ? safeName(candidates[0]) : "";
  if (!name) name = "download";
  if (ext && !name.toLowerCase().endsWith(`.${ext.toLowerCase()}`)) {
    name = `${name}.${ext}`;
  }

  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}download=${encodeURIComponent(name)}`;
}
