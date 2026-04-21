import { PageHeader } from "@/components/page-header";
import { ComingSoon } from "@/components/coming-soon";

export default function SettlementsPage() {
  return (
    <>
      <PageHeader
        title="정산"
        description="예약금 / 소개비 / 이벤트 / 웰컴팩 4종 정산 관리."
        breadcrumbs={[{ label: "정산" }]}
      />
      <ComingSoon
        phase="Phase 6"
        description="교육생별·교육원별 뷰 + 소개비 자동 정산 대상 선정(45/75일) + 예약금 4가지 처리"
      />
    </>
  );
}
