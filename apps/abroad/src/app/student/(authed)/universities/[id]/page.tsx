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
import { AppliedToast } from "./applied-toast";

export const dynamic = "force-dynamic";

/** 대학 이름 이니셜 2자 — 로고가 없을 때. 이모지는 쓰지 않는다. */
function initials(name: string): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "—";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

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
      "id, name_ko, name_vi, region_ko, region_vi, desc_ko, desc_vi, logo_url"
    )
    .eq("id", uniId)
    .maybeSingle();
  if (!u) notFound();

  const [{ data: allOfferings }, { data: specs }, { data: myApps }] =
    await Promise.all([
      // 모집 등록 여부(협약 판별) + 지원 가능(published) 목록을 한 번에
      supabase
        .from("study_offerings")
        .select(
          "id, department_id, term, intake_quota, source_spec_id, sort_order, status"
        )
        .eq("university_id", uniId)
        .order("sort_order")
        .order("term", { ascending: false }),
      supabase
        .from("study_admission_specs")
        .select("id, term, admission_category, program_type, eligibility, departments")
        .eq("university_id", uniId)
        .eq("status", "approved"),
      supabase
        .from("study_applications")
        .select("offering_id, admission_spec_id, target_department_label")
        .eq("student_id", session.student.id),
    ]);

  const specById = new Map((specs ?? []).map((s) => [s.id, s]));
  const appliedOfferingIds = new Set(
    (myApps ?? []).map((a) => a.offering_id).filter(Boolean)
  );
  // 자유 지원(spec 직접) 중복 판별용 — (모집요강 + 학과라벨)
  const appliedSpecDept = new Set(
    (myApps ?? []).map((a) => `${a.admission_spec_id}::${a.target_department_label ?? ""}`)
  );

  // 협약 = 모집(offerings)에 등록된 대학. 지원 가능 = published + 모집요강 연결.
  const isPartner = (allOfferings ?? []).length > 0;
  const offerings = (allOfferings ?? []).filter(
    (o) => o.status === "published" && o.source_spec_id
  );

  let items: OfferingItem[];
  if (isPartner) {
    // 협약: 모집(offering) 단위로 지원
    const deptIds = Array.from(new Set(offerings.map((o) => o.department_id)));
    const { data: depts } =
      deptIds.length > 0
        ? await supabase
            .from("departments")
            .select("id, name_ko, name_vi")
            .in("id", deptIds)
        : { data: [] as Array<{ id: number; name_ko: string; name_vi: string | null }> };
    const deptMap = new Map((depts ?? []).map((d) => [d.id, d]));

    items = offerings.map((o) => {
      const spec = o.source_spec_id ? specById.get(o.source_spec_id) : null;
      const dept = deptMap.get(o.department_id);
      const deptNameKo = dept?.name_ko ?? `학과 #${o.department_id}`;
      const deptName =
        (locale === "vi" ? dept?.name_vi ?? dept?.name_ko : dept?.name_ko) ??
        deptNameKo;
      return {
        id: o.id,
        offeringId: o.id,
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
  } else {
    // 자유 지원: 승인된 모집요강(spec)의 학과를 직접 골라 지원 (offering 없음)
    items = (specs ?? []).flatMap((s) => {
      const depts = Array.isArray(s.departments)
        ? (s.departments as Array<{ name?: string }>)
        : [];
      return depts
        .filter((d) => d && typeof d.name === "string" && d.name.trim())
        .map((d) => {
          const label = (d.name as string).trim();
          return {
            id: `${s.id}::${label}`,
            offeringId: null,
            sourceSpecId: s.id,
            departmentId: null,
            departmentName: label,
            departmentLabelKo: label,
            term: s.term,
            programType: s.program_type ?? null,
            languages: deriveOfferingLanguages(s.eligibility ?? null, label),
            alreadyApplied: appliedSpecDept.has(`${s.id}::${label}`),
          } satisfies OfferingItem;
        });
    });
  }

  const name = (locale === "vi" ? u.name_vi ?? u.name_ko : u.name_ko) ?? "";
  const region =
    (locale === "vi" ? u.region_vi ?? u.region_ko : u.region_ko) ?? null;
  const desc = locale === "vi" ? u.desc_vi ?? u.desc_ko : u.desc_ko;

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href="/student/universities"
        className="text-sm text-ink-light hover:underline"
      >
        {tr(locale, "← 대학 목록", "← Danh sách trường")}
      </Link>

      <header className="flex items-center gap-4">
        {u.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={u.logo_url}
            alt=""
            className="h-14 w-14 shrink-0 rounded-input border border-line-soft object-cover"
          />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-input bg-subtle">
            {initials(name)}
          </div>
        )}
        <div>
          <h1 className="gc-page-title">{name}</h1>
          {region && <p className="text-sm text-ink-light">{region}</p>}
          <div className="mt-1.5">
            <span
              className={`gc-badge ${
                isPartner ? "gc-badge-tonal" : "gc-badge-neutral"
              }`}
            >
              {isPartner
                ? tr(locale, "협약 대학", "Trường liên kết")
                : tr(locale, "자유 지원 대학", "Trường tự do đăng ký")}
            </span>
            <p className="mt-1 text-xs font-semibold text-ink-light">
              {isPartner
                ? tr(
                    locale,
                    "서류 작성(무료) + 발급 서류 대행(유료) + 지원 컨설팅(무료)",
                    "Soạn hồ sơ (miễn phí) + Dịch vụ xin cấp giấy tờ (trả phí) + Tư vấn đăng ký (miễn phí)"
                  )
                : tr(
                    locale,
                    "서류 작성(무료) + 발급 서류 대행(유료)",
                    "Soạn hồ sơ (miễn phí) + Dịch vụ xin cấp giấy tờ (trả phí)"
                  )}
            </p>
          </div>
        </div>
      </header>

      {applied && (
        <div className="gc-note bg-success-bg flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm font-semibold text-success-ink">
            {tr(locale, "지원이 등록되었습니다", "Đã đăng ký")}
          </span>
          <Link
            href="/student/applications"
            className="shrink-0 gc-btn gc-btn-primary gc-btn-md"
          >
            {tr(locale, "서류 작성하러 가기 →", "Đi soạn hồ sơ →")}
          </Link>
          <AppliedToast locale={locale} />
        </div>
      )}

      {desc && (
        <section className="gc-card whitespace-pre-line text-sm text-ink-mid">
          {desc}
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-ink-mid">
          {isPartner
            ? tr(locale, "모집 중인 과정", "Chương trình đang tuyển")
            : tr(locale, "지원 가능 학과", "Ngành có thể đăng ký")}
        </h2>
        {!isPartner && items.length > 0 && (
          <p className="mb-2 text-xs text-ink-light">
            {tr(
              locale,
              "자유 지원 대학입니다. 학과를 골라 지원을 시작하면 서류 작성을 도와드립니다.",
              "Trường tự do đăng ký. Chọn ngành để bắt đầu — chúng tôi hỗ trợ soạn hồ sơ."
            )}
          </p>
        )}
        {items.length === 0 ? (
          <p className="gc-card-dashed text-center text-sm text-ink-xlight">
            {tr(
              locale,
              "아직 지원 가능한 모집요강이 없습니다. '대학 요청'으로 문의해 주세요.",
              "Chưa có thông tin tuyển sinh để đăng ký. Vui lòng gửi 'Yêu cầu trường'."
            )}
          </p>
        ) : (
          <OfferingList locale={locale} universityId={uniId} items={items} />
        )}
      </section>
    </div>
  );
}
