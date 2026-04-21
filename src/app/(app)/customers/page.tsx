import { PageHeader } from "@/components/page-header";
import { ComingSoon } from "@/components/coming-soon";

export default function CustomersPage() {
  return (
    <>
      <PageHeader
        title="고객관리"
        description="베트남 교육생 등록·매칭·진행 단계 관리."
        breadcrumbs={[{ label: "고객관리" }]}
      />
      <ComingSoon
        phase="Phase 5"
        description="목록/상세/등록 + 진행 단계 자동 판정 + 상담 일지(번역)"
      />
    </>
  );
}
