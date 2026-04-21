import { PageHeader } from "@/components/page-header";
import { ComingSoon } from "@/components/coming-soon";

export default function TrainingCentersPage() {
  return (
    <>
      <PageHeader
        title="교육원"
        description="요양보호사 교육원과 월별 개강 정보 관리."
        breadcrumbs={[{ label: "교육원" }]}
      />
      <ComingSoon phase="Phase 4" description="교육원 CRUD + 월별 개강 정보 + 소속 교육생 목록" />
    </>
  );
}
