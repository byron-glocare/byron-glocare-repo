import { PageHeader } from "@/components/page-header";
import { ComingSoon } from "@/components/coming-soon";

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="설정"
        description="상태값 / 결제 설정 / 계정 관리."
        breadcrumbs={[{ label: "설정" }]}
      />
      <ComingSoon
        phase="Phase 8"
        description="상태값 CRUD + 결제 기준값 편집 + 계정 생성/비번 변경"
      />
    </>
  );
}
