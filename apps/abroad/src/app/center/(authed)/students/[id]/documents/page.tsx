/**
 * /center/students/[id]/documents — 서류 등록 탭.
 *   (P3에서 본격 구현) 학생이 모집요강 제출서류를 업로드하고,
 *   업로드한 서류에서 '정보 입력' 데이터를 AI로 미리 채운다.
 */

import Link from "next/link";

import { verifyCenterSession } from "@/lib/center/dal";
import { getLocale, tr } from "@/lib/i18n";

export default async function DocumentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await verifyCenterSession();
  const locale = await getLocale();

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-slate-900">
        {tr(locale, "서류 등록", "Tải giấy tờ")}
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        {tr(
          locale,
          "대학 모집요강의 제출서류를 업로드합니다. 가능한 서류만 올려도 되고, 하나도 없이 다음 단계로 넘어갈 수 있습니다.",
          "Tải lên các giấy tờ theo yêu cầu của trường. Chỉ cần tải những gì có; có thể bỏ qua để sang bước tiếp."
        )}
      </p>
      <div className="mt-4 rounded-md border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
        {tr(
          locale,
          "업로드 · AI 자동 채움 기능은 곧 제공됩니다.",
          "Tải lên · tự động điền bằng AI sẽ sớm có."
        )}
        <div className="mt-3">
          <Link
            href={`/center/students/${id}/data`}
            className="text-emerald-700 underline"
          >
            {tr(locale, "정보 입력으로 이동 →", "Sang Nhập thông tin →")}
          </Link>
        </div>
      </div>
    </section>
  );
}
