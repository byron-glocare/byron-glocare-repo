/**
 * /center/invoices — 유학센터 인보이스 목록 (read-only, 베트남어).
 *   RLS: invoices_org_member_read 정책으로 자기 org 의 인보이스만 조회.
 */

import Link from "next/link";

import { verifyCenterSession } from "@/lib/center/dal";
import { createCenterClient } from "@/lib/supabase/center";
import { getLocale, tr, type Locale } from "@/lib/i18n";

function statusLabel(locale: Locale, status: string): string {
  switch (status) {
    case "draft":
      return tr(locale, "임시저장", "Bản nháp");
    case "sent":
      return tr(locale, "발송됨", "Đã gửi");
    case "paid":
      return tr(locale, "결제 완료", "Đã thanh toán");
    case "cancelled":
      return tr(locale, "취소됨", "Đã hủy");
    default:
      return status;
  }
}

const STATUS_BG: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  sent: "bg-amber-100 text-amber-800",
  paid: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-rose-100 text-rose-700",
};

export default async function CenterInvoicesPage() {
  const session = await verifyCenterSession();
  const locale = await getLocale();
  const supabase = await createCenterClient();
  const dateLocale = locale === "ko" ? "ko-KR" : "vi-VN";
  const numberLocale = locale === "ko" ? "ko-KR" : "vi-VN";

  // draft 는 운영자만 보는 상태이므로 유학센터는 sent/paid/cancelled 만
  const { data: invoices, error } = await supabase
    .from("study_invoices")
    .select("*")
    .eq("org_id", session.org.id)
    .in("status", ["sent", "paid", "cancelled"])
    .order("period_end", { ascending: false });

  // 납부액 합계 계산
  const invoiceIds = (invoices ?? []).map((i) => i.id);
  const { data: settlements } =
    invoiceIds.length > 0
      ? await supabase
          .from("study_settlements")
          .select("invoice_id, amount")
          .in("invoice_id", invoiceIds)
      : { data: [] as Array<{ invoice_id: string; amount: number }> };
  const paidMap = new Map<string, number>();
  for (const s of settlements ?? []) {
    paidMap.set(
      s.invoice_id,
      (paidMap.get(s.invoice_id) ?? 0) + Number(s.amount)
    );
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">
          {tr(locale, "청구서", "Hóa đơn")}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {tr(
            locale,
            `${(locale === "ko" ? session.org.name_ko : session.org.name_vi) ?? session.org.name_vi} 청구서 및 결제 내역`,
            `Hóa đơn và lịch sử thanh toán cho ${session.org.name_vi}`
          )}
        </p>
      </header>

      {error ? (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          {tr(locale, "데이터 로드 오류", "Lỗi tải dữ liệu")}: {error.message}
        </div>
      ) : !invoices || invoices.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-base text-slate-600">
            {tr(locale, "청구서가 없습니다.", "Chưa có hóa đơn nào.")}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {tr(
              locale,
              "GLOCARE가 청구서를 발행하면 이곳에 표시됩니다.",
              "Khi GLOCARE phát hành hóa đơn, sẽ xuất hiện ở đây."
            )}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium text-slate-700">
                  {tr(locale, "기간", "Kỳ")}
                </th>
                <th className="px-4 py-3 text-right font-medium text-slate-700">
                  {tr(locale, "총액", "Tổng tiền")}
                </th>
                <th className="px-4 py-3 text-right font-medium text-slate-700">
                  {tr(locale, "결제액", "Đã thanh toán")}
                </th>
                <th className="px-4 py-3 text-right font-medium text-slate-700">
                  {tr(locale, "잔액", "Còn lại")}
                </th>
                <th className="px-4 py-3 font-medium text-slate-700">
                  {tr(locale, "상태", "Trạng thái")}
                </th>
                <th className="px-4 py-3 font-medium text-slate-700">
                  {tr(locale, "발행일", "Phát hành")}
                </th>
                <th className="w-20 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const total = Number(inv.total_amount);
                const paid = paidMap.get(inv.id) ?? 0;
                const balance = total - paid;
                return (
                  <tr
                    key={inv.id}
                    className="border-t border-slate-200 hover:bg-slate-50"
                  >
                    <td className="px-4 py-3 text-slate-900">
                      <Link
                        href={`/center/invoices/${inv.id}`}
                        className="hover:text-emerald-700 hover:underline"
                      >
                        {inv.period_start} ~ {inv.period_end}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {total.toLocaleString(numberLocale)} {inv.currency}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {paid > 0 ? (
                        <span
                          className={
                            paid >= total
                              ? "text-emerald-700"
                              : "text-amber-700"
                          }
                        >
                          {paid.toLocaleString(numberLocale)} {inv.currency}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {balance > 0 ? (
                        <span className="font-medium text-rose-700">
                          {balance.toLocaleString(numberLocale)} {inv.currency}
                        </span>
                      ) : balance === 0 ? (
                        <span className="text-emerald-700">—</span>
                      ) : (
                        <span className="text-slate-500">
                          {tr(
                            locale,
                            `(초과 ${Math.abs(balance).toLocaleString(numberLocale)})`,
                            `(dư ${Math.abs(balance).toLocaleString(numberLocale)})`
                          )}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          STATUS_BG[inv.status] ?? "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {statusLabel(locale, inv.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {inv.sent_at
                        ? new Date(inv.sent_at).toLocaleDateString(dateLocale)
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/center/invoices/${inv.id}`}
                        className="text-xs text-emerald-700 hover:underline"
                      >
                        {tr(locale, "상세 →", "Chi tiết →")}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
