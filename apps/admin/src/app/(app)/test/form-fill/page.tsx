/**
 * /test/form-fill — 직접작성 서류(DOCX) 채움 100% 테스트.
 *   방식 A(in-place 템플릿): 운영자가 원본 양식에 토큰을 1회 심고, 시스템이
 *   테스트 학생 데이터 + 서명/사진 이미지로 채운 결과를 확인한다.
 *   (admin 전체가 glocare_admin 게이트 하에 있으므로 별도 게이트 불필요.)
 */

import { PageHeader } from "@/components/page-header";
import { TEXT_TOKENS, IMAGE_TOKENS, todayKo } from "@/lib/test/sample-student";

import { TestFormFill } from "./test-form-fill";

export const dynamic = "force-dynamic";

export default function TestFormFillPage() {
  const textTokens = TEXT_TOKENS.map((t) => ({
    ...t,
    sample: t.token === "today" ? todayKo() : t.sample,
  }));

  return (
    <>
      <PageHeader
        title="양식 채움 테스트"
        description="직접작성 서류(DOCX)에 학생 정보·서명·사진을 100% 자동으로 채우는 실험"
        breadcrumbs={[{ label: "테스트" }, { label: "양식 채움" }]}
      />
      <div className="p-6">
        <TestFormFill textTokens={textTokens} imageTokens={IMAGE_TOKENS} />
      </div>
    </>
  );
}
