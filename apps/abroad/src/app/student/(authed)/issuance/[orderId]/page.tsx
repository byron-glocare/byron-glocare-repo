/**
 * /student/issuance/[orderId] — 발급대행 주문 상세/진행 상황.
 *   항목·금액·상태. 결제(토스, P4)·발급 결과 PDF·발송은 이후 단계.
 */

import Link from "next/link";
import { notFound } from "next/navigation";

import { verifyStudentSession } from "@/lib/student/dal";
import { createClient } from "@/lib/supabase/server";
import { getLocale, tr } from "@/lib/i18n";
import {
  issuanceStatusLabel,
  issuanceStatusTone,
  issuanceNotarizationLabel,
} from "../status";

export const dynamic = "force-dynamic";

export default async function IssuanceOrderPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const session = await verifyStudentSession();
  const locale = await getLocale();
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("study_issuance_orders")
    .select(
      "id, student_id, university_id, status, subtotal, eta_date, result_pdf_path, manager_note, cancel_reason, created_at"
    )
    .eq("id", orderId)
    .maybeSingle();
  if (!order || order.student_id !== session.student.id) notFound();

  const { data: items } = await supabase
    .from("study_issuance_order_items")
    .select("id, label_ko, notarization, unit_price, qty")
    .eq("order_id", orderId);

  const won = (n: number) => `${n.toLocaleString()}${tr(locale, "원", " ₩")}`;
  const isPending = order.status === "payment_pending";

  return (
    <div className="max-w-2xl space-y-5">
      <Link
        href="/student/issuance"
        className="text-sm text-slate-500 hover:underline"
      >
        {tr(locale, "← 발급 대행", "← Xin cấp giấy tờ")}
      </Link>

      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900">
          {tr(locale, "발급 대행 신청", "Đơn xin cấp giấy tờ")}
        </h1>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${issuanceStatusTone(
            order.status
          )}`}
        >
          {issuanceStatusLabel(locale, order.status)}
        </span>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white">
        <ul className="divide-y divide-slate-100">
          {(items ?? []).map((it) => (
            <li
              key={it.id}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div>
                <span className="text-sm font-medium text-slate-900">
                  {it.label_ko}
                </span>
                {it.notarization !== "none" && (
                  <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-700">
                    {issuanceNotarizationLabel(locale, it.notarization)}
                  </span>
                )}
                <span className="ml-2 text-xs text-slate-500">× {it.qty}</span>
              </div>
              <span className="text-sm tabular-nums text-slate-700">
                {won(it.unit_price * it.qty)}
              </span>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
          <span className="text-sm font-semibold text-slate-700">
            {tr(locale, "합계", "Tổng")}
          </span>
          <span className="text-lg font-bold text-slate-900">
            {won(order.subtotal)}
          </span>
        </div>
      </section>

      {order.eta_date && (
        <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {tr(locale, "발급 완료 예정일", "Dự kiến hoàn tất")}: {order.eta_date}
        </p>
      )}
      {order.manager_note && (
        <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700 whitespace-pre-wrap">
          {order.manager_note}
        </p>
      )}
      {order.status === "cancelled" && order.cancel_reason && (
        <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {tr(locale, "취소 사유", "Lý do hủy")}: {order.cancel_reason}
        </p>
      )}

      {isPending && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-800">
            {tr(locale, "결제 대기 중", "Chờ thanh toán")}
          </p>
          <p className="mt-1 text-xs text-amber-700">
            {tr(
              locale,
              "결제 기능은 준비 중입니다. 곧 이 화면에서 토스로 결제할 수 있게 됩니다.",
              "Tính năng thanh toán đang chuẩn bị. Sắp tới bạn có thể thanh toán qua Toss tại đây."
            )}
          </p>
        </div>
      )}
    </div>
  );
}
