import { PageHeader } from "@/components/page-header";
import { ComingSoon } from "@/components/coming-soon";

export default function CareHomesPage() {
  return (
    <>
      <PageHeader
        title="요양원"
        description="교육생의 취업처. 매칭/면접 일정 관리."
        breadcrumbs={[{ label: "요양원" }]}
      />
      <ComingSoon phase="Phase 4" description="요양원 CRUD + 소속 교육생(등록/구직/취업)" />
    </>
  );
}
