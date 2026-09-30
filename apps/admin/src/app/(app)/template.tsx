/**
 * 화면 전환 효과 — 페이지를 옮길 때 본문이 0.15초 동안 살짝 페이드인.
 *
 *   template 은 layout 과 달리 페이지 이동마다 새로 마운트되므로 여기서 걸면 이동할 때마다 재생된다.
 *   사이드바·상단바는 layout 쪽이라 움직이지 않는다.
 *   같은 화면에서 검색·필터(쿼리스트링)만 바뀔 때는 다시 마운트되지 않아 재생되지 않는다.
 *   페이드아웃은 넣지 않는다 — 새 화면이 그만큼 늦게 보여 느려진 것처럼 느껴진다.
 *   움직임 줄이기를 켠 사용자에게는 끈다.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-in fade-in duration-150 ease-out motion-reduce:animate-none">
      {children}
    </div>
  );
}
