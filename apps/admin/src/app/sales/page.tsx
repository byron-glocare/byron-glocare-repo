import { ComingSoon } from "@/components/mobile/coming-soon";

export const dynamic = "force-dynamic";

/**
 * 영업직원 홈 — 교육생 리스트/검색(설득 상단), 상담일지·등록 결정.
 * Phase 2 에서 실제 화면으로 채운다. 지금은 접근(역할 게이트) 확인용.
 */
export default function SalesHomePage() {
  return <ComingSoon title="영업 — 교육생 관리" backHref="/sales" />;
}
