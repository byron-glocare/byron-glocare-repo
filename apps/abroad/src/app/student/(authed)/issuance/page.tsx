/**
 * /student/issuance — 발급 서류 대행 신청 (P3a: 신청·견적·주문 생성, 결제 직전까지).
 *   활성 단가표(study_issuance_pricing)를 카탈로그로 노출 → 선택·수량 → 견적 → 주문 생성.
 *   결제(토스)·현지발급·PDF 업로드는 이후 단계.
 */

import Link from "next/link";

import { verifyStudentSession } from "@/lib/student/dal";
import { createClient } from "@/lib/supabase/server";
import { getLocale, tr } from "@/lib/i18n";
import {
  classifyRequiredDocs,
  type RequiredDoc,
} from "@/lib/admission/classify-documents";
import {
  issuanceStatusLabel,
  issuanceStatusTone,
} from "./status";
import { IssuanceClient, type PricingRow, type UniOption } from "./issuance-client";

export const dynamic = "force-dynamic";

export default async function StudentIssuancePage() {
  const session = await verifyStudentSession();
  const locale = await getLocale();
  const supabase = await createClient();
  const studentId = session.student.id;

  const [{ data: pricing }, { data: orders }, { data: apps }] =
    await Promise.all([
      supabase
        .from("study_issuance_pricing")
        .select(
          "id, std_key, label_ko, notarization, unit_price, proxy_unavailable_surcharge, sort_order"
        )
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("study_issuance_orders")
        .select("id, status, subtotal, university_id, created_at")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false }),
      supabase
        .from("study_applications")
        .select("admission_spec_id")
        .eq("student_id", studentId),
    ]);

  // 필요 서류 힌트 + 지원 대학(주문 컨텍스트)
  const specIds = Array.from(
    new Set((apps ?? []).map((a) => a.admission_spec_id).filter(Boolean))
  );
  const { data: specs } =
    specIds.length > 0
      ? await supabase
          .from("study_admission_specs")
          .select("id, university_id, required_documents")
          .in("id", specIds)
      : { data: [] as Array<{ id: string; university_id: number; required_documents: unknown }> };

  const neededNames = new Set<string>();
  for (const s of specs ?? []) {
    const { issued } = classifyRequiredDocs(
      (s.required_documents as RequiredDoc[]) ?? []
    );
    for (const d of issued) neededNames.add(d.name_ko);
  }

  const uniIds = Array.from(new Set((specs ?? []).map((s) => s.university_id)));
  const { data: unis } =
    uniIds.length > 0
      ? await supabase
          .from("universities")
          .select("id, name_ko, name_vi")
          .in("id", uniIds)
      : { data: [] as Array<{ id: number; name_ko: string; name_vi: string | null }> };
  const uniOptions: UniOption[] = (unis ?? []).map((u) => ({
    id: u.id,
    name: (locale === "vi" ? u.name_vi ?? u.name_ko : u.name_ko) ?? `#${u.id}`,
  }));
  const uniNameById = new Map(uniOptions.map((u) => [u.id, u.name]));

  const rows: PricingRow[] = (pricing ?? []).map((p) => ({
    id: p.id,
    labelKo: p.label_ko,
    notarization: p.notarization,
    unitPrice: p.unit_price,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="gc-page-title">
          {tr(locale, "발급 서류 대행 신청", "Dịch vụ xin cấp giấy tờ")}
        </h1>
        <p className="gc-page-desc">
          {tr(
            locale,
            "졸업·성적·가족관계 등 발급 서류를 글로케어가 대신 발급·인증해 드립니다.",
            "Glocare xin cấp & chứng thực giấy tờ (tốt nghiệp, học bạ, hộ tịch...) thay bạn."
          )}
        </p>
      </div>

      {/* 진행 중인 주문 */}
      {orders && orders.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-ink-mid">
            {tr(locale, "내 신청 내역", "Đơn của tôi")}
          </h2>
          <ul className="space-y-2">
            {orders.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/student/issuance/${o.id}`}
                  className="gc-card gc-card-hover flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-ink">
                      {o.university_id
                        ? uniNameById.get(o.university_id) ??
                          tr(locale, "발급 대행", "Xin cấp")
                        : tr(locale, "발급 대행", "Xin cấp")}
                    </div>
                    <div className="text-xs text-ink-light">
                      {o.subtotal.toLocaleString()}
                      {tr(locale, "원", " ₩")}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${issuanceStatusTone(
                      o.status
                    )}`}
                  >
                    {issuanceStatusLabel(locale, o.status)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {rows.length === 0 ? (
        <div className="gc-card-dashed text-center text-sm text-ink-light">
          {tr(
            locale,
            "현재 신청 가능한 발급 서류가 없습니다. 잠시 후 다시 확인해 주세요.",
            "Hiện chưa có giấy tờ để đăng ký. Vui lòng thử lại sau."
          )}
        </div>
      ) : (
        <IssuanceClient
          locale={locale}
          rows={rows}
          universities={uniOptions}
          neededNames={Array.from(neededNames)}
        />
      )}
    </div>
  );
}
