/**
 * /fill/[token] — 정보 입력 공개 링크 (로그인 불필요, 유효기간 토큰).
 *   토큰을 service-role 로 검증(만료/취소) 후 해당 학생의 정보입력을 채우게 한다.
 *   파일/서명/파생 항목은 제외(센터에서 처리) — 텍스트성 항목 위주.
 */

import { createServiceClient } from "@/lib/supabase/service";
import { PublicDataEditor, type PublicFieldMeta } from "./public-data-editor";

export const dynamic = "force-dynamic";

type SP = { lang?: string };

export default async function FillPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<SP>;
}) {
  const { token } = await params;
  const { lang } = await searchParams;
  const locale: "ko" | "vi" = lang === "ko" ? "ko" : "vi";

  const svc = createServiceClient();
  const { data: link } = await svc
    .from("study_student_fill_links")
    .select("student_id, expires_at, revoked")
    .eq("token", token)
    .maybeSingle();

  const valid =
    !!link &&
    !link.revoked &&
    new Date(link.expires_at).getTime() >= Date.now();

  if (!valid) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="text-4xl">🔗</div>
        <h1 className="text-lg font-bold text-slate-900">
          {locale === "ko" ? "링크가 만료되었습니다" : "Liên kết đã hết hạn"}
        </h1>
        <p className="text-sm text-slate-600">
          {locale === "ko"
            ? "이 입력 링크는 만료되었거나 사용할 수 없습니다. 담당 센터에 새 링크를 요청하세요."
            : "Liên kết này đã hết hạn hoặc không khả dụng. Vui lòng yêu cầu liên kết mới từ trung tâm."}
        </p>
      </main>
    );
  }

  const studentId = link.student_id;
  const [{ data: student }, { data: dataTypes }, { data: values }] =
    await Promise.all([
      svc
        .from("study_managed_students")
        .select("name")
        .eq("id", studentId)
        .maybeSingle(),
      svc
        .from("study_student_data_types")
        .select("*")
        .eq("is_active", true)
        .order("category")
        .order("sort_order"),
      svc
        .from("study_student_data_values")
        .select("data_type_key, value")
        .eq("student_id", studentId),
    ]);

  // 공개 입력은 텍스트성 항목만 (파일·서명·파생 제외)
  const EXCLUDED = new Set(["file", "signature"]);
  const fields: PublicFieldMeta[] = (dataTypes ?? [])
    .filter((d) => !EXCLUDED.has(d.input_type) && !d.is_derived)
    .map((d) => ({
      key: d.key,
      label_ko: d.label_ko,
      label_vi: d.label_vi,
      category: d.category,
      input_type: d.input_type,
      options: d.options,
      hint_ko: d.hint_ko,
      hint_vi: d.hint_vi,
    }));

  const existing = Object.fromEntries(
    (values ?? []).map((v) => [v.data_type_key, v.value])
  );

  return (
    <PublicDataEditor
      token={token}
      locale={locale}
      studentName={student?.name ?? ""}
      expiresAt={link.expires_at}
      fields={fields}
      existingValues={existing}
    />
  );
}
