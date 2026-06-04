/**
 * /admissions/forms — (구) 양식 파일 통합 관리.
 *
 *   B1 에서 양식 관리는 "대학 기준 입학서류"(/admissions/[universityId]) 안으로
 *   통합되었다. 기존 북마크/링크 보호를 위해 redirect 만 유지한다.
 *     - ?univ=N 이면 해당 대학 통합 화면으로
 *     - 아니면 입학서류 홈으로
 */

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdmissionFormsRedirect({
  searchParams,
}: {
  searchParams: Promise<{ univ?: string }>;
}) {
  const { univ } = await searchParams;
  const uid = univ ? Number(univ) : NaN;
  if (Number.isFinite(uid)) redirect(`/admissions/${uid}`);
  redirect("/admissions");
}
