/**
 * /universities/[id]/forms — (구) 대학교 양식 관리.
 *
 *   양식(서류 양식) 관리는 모집요강(입학서류) 화면
 *   `/admissions/[universityId]` 안으로 통합되었다.
 *   대학교 메뉴 = 대학 등록·정보 편집 전용. 양식은 모집요강에서만 관리.
 *
 *   기존 링크/북마크 보호를 위해 redirect 만 유지한다.
 *   (FormFilesManager 컴포넌트는 이 폴더에 그대로 두고 admissions 화면이 재사용.)
 */

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function UniversityFormsRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/admissions/${id}`);
}
