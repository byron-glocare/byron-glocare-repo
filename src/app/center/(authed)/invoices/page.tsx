/**
 * /center/invoices — 유학센터 인보이스 목록 (read-only, 베트남어).
 *   RLS: invoices_org_member_read 정책으로 자기 org 의 인보이스만 조회.
 */

import Link from "next/link";

import { verifyCenterSession } from "@/lib/center/dal";
import { createCenterClient } from "@/lib/supabase/center";

const STATUS_LABEL: Record<string, string> = {
  draft: "Bản nháp",
  sent: "Đã gửi",
  paid: "Đã thanh toán",
  cancelled: "Đã hủy",
};

const STATUS_BG: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  sent: "bg-amber-100 text-amber-800",
  paid: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-rose-100 text-rose-700",
};

export default async function CenterInvoicesPage() {
  const session = await verifyCenterSession();
  const supabase = await createCenterClient();

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
        <h1 className="text-2xl font-bold text-slate-900">Hóa đơn</h1>
        <p className="mt-1 text-sm text-slate-600">
          Hóa đơn và lịch sử thanh toán cho {session.org.name_vi}
        </p>
      </header>

      {error ? (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          Lỗi tải dữ liệu: {error.message}
        </div>
      ) : !invoices || invoices.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-base text-slate-600">
            Chưa có hóa đơn nào.
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Khi GLOCARE phát hành hóa đơn, sẽ xuất hiện ở đây.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium text-slate-700">Kỳ</th>
                <th className="px-4 py-3 text-right font-medium text-slate-700">
                  Tổng tiền
                </th>
                <th className="px-4 py-3 text-right font-medium text-slate-700">
                  Đã thanh toán
                </th>
                <th className="px-4 py-3 text-right font-medium text-slate-700">
                  Còn lại
                </th>
                <th className="px-4 py-3 font-medium text-slate-700">Trạng thái</th>
                <th className="px-4 py-3 font-medium text-slate-700">Phát hành</th>
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
                      {total.toLocaleString("vi-VN")} {inv.currency}
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
                          {paid.toLocaleString("vi-VN")} {inv.currency}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {balance > 0 ? (
                        <span className="font-medium text-rose-700">
                          {balance.toLocaleString("vi-VN")} {inv.currency}
                        </span>
                      ) : balance === 0 ? (
                        <span className="text-emerald-700">—</span>
                      ) : (
                        <span className="text-slate-500">
                          (dư {Math.abs(balance).toLocaleString("vi-VN")})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          STATUS_BG[inv.status] ?? "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {STATUS_LABEL[inv.status] ?? inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {inv.sent_at
                        ? new Date(inv.sent_at).toLocaleDateString("vi-VN")
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/center/invoices/${inv.id}`}
                        className="text-xs text-emerald-700 hover:underline"
                      >
                        Chi tiết →
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
