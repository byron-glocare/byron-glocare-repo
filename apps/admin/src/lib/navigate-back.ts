/**
 * 폼 저장 후 이전 화면 복귀 — 히스토리 비면 fallback URL.
 * 모든 메인 폼 저장 버튼에서 호출.
 */
export function navigateBackOrTo(
  router: { back: () => void; push: (href: string) => void },
  fallback: string
) {
  if (typeof window !== "undefined" && window.history.length > 1) {
    router.back();
  } else {
    router.push(fallback);
  }
}
