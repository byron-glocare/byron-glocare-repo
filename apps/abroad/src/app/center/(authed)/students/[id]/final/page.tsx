/**
 * /center/students/[id]/final — 최종 서류 탭.
 *   (P4에서 본격 구현: 작성서류 생성 + 제출서류 리네임 다운로드 통합)
 *   현재는 기존 '서류 작성'(/forms) 화면으로 연결한다.
 */

import { redirect } from "next/navigation";

export default async function FinalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/center/students/${id}/forms`);
}
