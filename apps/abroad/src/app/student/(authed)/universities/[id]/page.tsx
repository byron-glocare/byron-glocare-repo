/**
 * /student/universities/[id] — 대학 상세 + 지원 시작(셀프 학생).
 *   published & 모집요강 연결된 offering 을 학과/과정별로 노출 → 지원 생성.
 */

import Link from "next/link";
import { notFound } from "next/navigation";

import { verifyStudentSession } from "@/lib/student/dal";
import { createClient } from "@/lib/supabase/server";
import { getLocale, tr } from "@/lib/i18n";
import { deriveOfferingLanguages } from "@/lib/admission/offering-languages";

import { OfferingList, type OfferingItem } from "./offering-list";

export const dynamic = "force-dynamic";

export default async function StudentUniversityDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ applied?: string }>;
}) {
  const { id } = await params;
  const { applied } = await searchParams;
  const uniId = Number(id);
  if (!Number.isInteger(uniId) || uniId <= 0) notFound();

  const session = await verifyStudentSession();
  const locale = await getLocale();
  const supabase = await createClient();

  const { data: u } = await supabase
    .from("universities")
    .select(
      "id, name_ko, name_vi, region_ko, region_vi, desc_ko, desc_vi, emoji, logo_url, tier"
    )
    .eq("id", uniId)
    .maybeSingle();
  if (!u) notFound();

  const [{ data: offerings }, { data: specs }, { data: myApps }] =
    await Promise.all([
      supabase
        .from("study_offerings")
        .select(
          "id, department_id, term, intake_quota, source_spec_id, sort_order"
        )
        .eq("university_id", uniId)
        .eq("status", "published")
        .not("source_spec_id", "is", null)
        .order("sort_order")
        .order("term", { ascending: false }),
      supabase
        .from("study_admission_specs")
        .select("id, term, admission_category, program_type, eligibility")
        .eq("university_id", uniId)
        .eq("status", "approved"),
      supabase
        .from("study_applications")
        .select("offering_id")
        .eq("student_id", session.student.id),
    ]);

  const specById = new Map((specs ?? []).map((s) => [s.id, s]));
  const appliedOfferingIds = new Set(
    (myApps ?? []).map((a) => a.offering_id).filter(Boolean)
  );

  // 학과명 join
  const deptIds = Array.from(
    new Set((offerings ?? []).map((o) => o.department_id))
  );
  const { data: depts } =
    deptIds.length > 0
      ? await supabase
          .from("departments")
          .select("id, name_ko, name_vi")
          .in("id", deptIds)
      : { data: [] as Array<{ id: number; name_ko: string; name_vi: string | null }> };
  const deptMap = new Map((depts ?? []).map((d) => [d.id, d]));

  const items: OfferingItem[] = (offerings ?? []).map((o) => {
    const spec = o.source_spec_id ? specById.get(o.source_spec_id) : null;
    const dept = deptMap.get(o.department_id);
    const deptNameKo = dept?.name_ko ?? `학과 #${o.department_id}`;
    const deptName =
      (locale === "vi" ? dept?.name_vi ?? dept?.name_ko : dept?.name_ko) ??
      deptNameKo;
    return {
      id: o.id,
      sourceSpecId: (o.source_spec_id as string) ?? "",
      departmentId: o.department_id,
      departmentName: deptName,
      departmentLabelKo: deptNameKo,
      term: o.term,
      programType: spec?.program_type ?? null,
      languages: deriveOfferingLanguages(spec?.eligibility ?? null, deptNameKo),
      alreadyApplied: appliedOfferingIds.has(o.id),
    };
  });

  const name = (locale === "vi" ? u.name_vi ?? u.name_ko : u.name_ko) ?? "";
  const region =
    (locale === "vi" ? u.region_vi ?? u.region_ko : u.region_ko) ?? null;
  const desc = locale === "vi" ? u.desc_vi ?? u.desc_ko : u.desc_ko;
  const isPartner = u.tier === "partner";

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href="/student/universities"
        className="text-sm text-slate-500 hover:underline"
      >
        {tr(locale, "← 대학 목록", "← Danh sách trường")}
      </Link>

      <header className="flex items-center gap-4">
        {u.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={u.logo_url}
            alt=""
            className="h-14 w-14 shrink-0 rounded-xl border border-slate-100 object-cover"
          />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-2xl">
            {u.emoji ?? "🎓"}
          </div>
        )}
        <div>
          <h1 className="text-xl font-bold text-slate-900">{name}</h1>
          {region && <p className="text-sm text-slate-500">{region}</p>}
          <span
            className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] ${
              isPartner
                ? "bg-emerald-50 text-emerald-700"
                : "bg-sky-50 text-sky-700"
            }`}
          >
            {isPartner
              ? tr(locale, "협약 대학 · 서류작성 + 컨설팅", "Trường liên kết · Hồ sơ + tư vấn")
              : tr(locale, "자유 지원 · 서류작성 지원", "Tự do đăng ký · Hỗ trợ hồ sơ")}
          </span>
        </div>
      </header>

      {applied && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {tr(
            locale,
            "지원이 등록되었습니다. '내 지원'에서 서류 작성을 이어가세요.",
            "Đã đăng ký. Tiếp tục soạn hồ sơ tại 'Hồ sơ của tôi'."
          )}
        </p>
      )}

      {desc && (
        <section className="whitespace-pre-line rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
          {desc}
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-800">
          {tr(locale, "모집 중인 과정", "Chương trình đang tuyển")}
        </h2>
        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center text-sm text-slate-400">
            {tr(
              locale,
              "아직 모집 중인 과정이 없습니다.",
              "Hiện chưa có chương trình đang tuyển."
            )}
          </p>
        ) : (
          <OfferingList locale={locale} universityId={uniId} items={items} />
        )}
      </section>
    </div>
  );
}
