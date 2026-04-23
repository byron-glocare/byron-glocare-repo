import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// TODO(C3): 이 페이지를 모달로 대체 — 고객 검색 + 상담 작성 + AI 자동 분석/적용
export default function ConsultationsNewPage() {
  return (
    <>
      <PageHeader
        title="상담 일지 작성"
        breadcrumbs={[
          { href: "/customers", label: "고객관리" },
          { label: "상담 일지 작성" },
        ]}
      />
      <div className="p-6">
        <Card className="p-12 text-center space-y-3">
          <p className="text-sm text-muted-foreground">
            상담 일지 작성 모달은 곧 연결됩니다. 지금은 고객을 먼저 선택한 뒤
            상세 페이지의 <b>상담 일지</b> 탭에서 작성해주세요.
          </p>
          <Link href="/customers" className={buttonVariants()}>
            고객관리로 이동
          </Link>
        </Card>
      </div>
    </>
  );
}
