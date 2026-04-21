import { PageHeader } from "@/components/page-header";
import { ComingSoon } from "@/components/coming-soon";

export default function SmsPage() {
  return (
    <>
      <PageHeader
        title="알림발송"
        description="신규 교육생 알림 / 수수료 정산 알림 SMS 발송."
        breadcrumbs={[{ label: "알림발송" }]}
      />
      <ComingSoon
        phase="Phase 7"
        description="NHN Cloud SMS API 연동 + 메시지 템플릿 + 발송 이력"
      />
    </>
  );
}
