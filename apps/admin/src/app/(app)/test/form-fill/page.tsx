/**
 * /test/form-fill — 직접작성 서류(DOCX) 채움 100% 테스트.
 *
 * 방식: **웹 클릭 바인딩 + 문자단위 토큰 정밀 치환**.
 *   Word 편집 없이 브라우저에서 빈칸을 클릭해 값 출처를 고르면, 그 위치에만 값이 박힌다.
 *   ("지원자 :____(인)", "___년 ___월 ___일" 처럼 한 칸 안에 다른 텍스트와 섞인 빈칸 지원 —
 *    셀 통째 덮어쓰기였던 기존 방식이 못 하던 것.)
 *
 * (admin 전체가 glocare_admin 게이트 하에 있으므로 별도 게이트 불필요.)
 */

import { createAdminClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { buildBindings, type CatalogRow } from "@/lib/test/bindings";

import { TestFormFill } from "./test-form-fill";

export const dynamic = "force-dynamic";

export default async function TestFormFillPage() {
  const supabase = createAdminClient();
  const { data: types } = await supabase
    .from("study_student_data_types")
    .select("key, label_ko, category, input_type")
    .eq("is_active", true)
    .order("sort_order");

  const { options, values } = buildBindings((types ?? []) as CatalogRow[]);

  return (
    <>
      <PageHeader
        title="양식 채움 테스트"
        description="빈칸을 클릭해 값 출처를 연결 → 테스트 데이터로 채움 (Word 편집 불필요)"
        breadcrumbs={[{ label: "테스트" }, { label: "양식 채움" }]}
      />
      <div className="p-6">
        <TestFormFill options={options} values={values} />
      </div>
    </>
  );
}
