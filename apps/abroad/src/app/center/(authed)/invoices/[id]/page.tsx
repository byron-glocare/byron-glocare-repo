/**
 * /center/invoices/[id] — 인보이스 상세 + 송금 내역 (read-only, 베트남어).
 */

import Link from "next/link";
import { notFound } from "next/navigation";

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

export default async function CenterInvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await verifyCenterSession();
  const { id } = await params;
  const supabase = await createCenterClient();

  // org_id 검증은 RLS 가 자동 처리, 추가 안전장치로 명시
  const { data: inv } = await supabase
    .from("study_invoices")
    .select("*")
    .eq("id", id)
    .eq("org_id", session.org.id)
    .maybeSingle();

  if (!inv) notFound();

  const { data: settlements } = await supabase
    .from("study_settlements")
    .select("*")
    .eq("invoice_id", inv.id)
    .order("received_at", { ascending: false });

  const lineItems = (Array.isArray(inv.line_items) ? inv.line_items : []) as Array<{
    description?: string;
    qty?: number;
    unit_price?: number;
    amount?: number;
  }>;

  const total = Number(inv.total_amount);
  const paid = (settlements ?? []).reduce(
    (s, x) => s + Number(x.amount),
    0
  );
  const balance = total - paid;

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/center/invoices"
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          ← Quay lại danh sách
        </Link>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Hóa đơn {inv.period_start} ~ {inv.period_end}
            </h1>
            <p className="mt-1 text-sm text-slate-600">{session.org.name_vi}</p>
          </div>
          <span
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
              STATUS_BG[inv.status] ?? "bg-slate-100 text-slate-700"
            }`}
          >
            {STATUS_LABEL[inv.status] ?? inv.status}
          </span>
        </div>
      </div>

      {/* 요약 */}
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-3 text-base font-semibold text-slate-900">Tóm tắt</h2>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm md:grid-cols-3">
          <Info label="Kỳ" value={`${inv.period_start} ~ ${inv.period_end}`} />
          <Info
            label="Tổng tiền"
            value={`${total.toLocaleString("vi-VN")} ${inv.currency}`}
          />
          <Info
            label="Đã thanh toán"
            value={`${paid.toLocaleString("vi-VN")} ${inv.currency}`}
          />
          <Info
            label="Còn lại"
            value={
              balance > 0
                ? `${balance.toLocaleString("vi-VN")} ${inv.currency}`
                : balance === 0
                  ? "Đã hoàn tất"
                  : `Dư ${Math.abs(balance).toLocaleString("vi-VN")} ${inv.currency}`
            }
          />
          <Info
            label="Ngày phát hành"
            value={
              inv.sent_at
                ? new Date(inv.sent_at).toLocaleDateString("vi-VN")
                : null
            }
          />
          <Info
            label="Ngày thanh toán"
            value={
              inv.paid_at
                ? new Date(inv.paid_at).toLocaleDateString("vi-VN")
                : null
            }
          />
        </dl>
        {inv.tax_invoice_url ? (
          <div className="mt-3 text-sm">
            <a
              href={inv.tax_invoice_url}
              target="_blank"
              rel="noreferrer"
              className="text-emerald-700 hover:underline"
            >
              Tải hóa đơn VAT (PDF)
            </a>
          </div>
        ) : null}
      </section>

      {/* 라인 아이템 */}
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-3 text-base font-semibold text-slate-900">
          Chi tiết khoản phí
        </h2>
        {lineItems.length === 0 ? (
          <p className="text-sm text-slate-500">Không có khoản nào</p>
        ) : (
          <div className="overflow-hidden rounded-md border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium">Nội dung</th>
                  <th className="w-20 px-3 py-2 text-right font-medium">SL</th>
                  <th className="w-32 px-3 py-2 text-right font-medium">Đơn giá</th>
                  <th className="w-32 px-3 py-2 text-right font-medium">Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((it, idx) => (
                  <tr key={idx} className="border-t border-slate-100">
                    <td className="px-3 py-2">{it.description ?? "—"}</td>
                    <td className="px-3 py-2 text-right">{it.qty ?? "—"}</td>
                    <td className="px-3 py-2 text-right">
                      {it.unit_price != null
                        ? Number(it.unit_price).toLocaleString("vi-VN")
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-medium">
                      {it.amount != null
                        ? Number(it.amount).toLocaleString("vi-VN")
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50">
                <tr className="border-t">
                  <td colSpan={3} className="px-3 py-2 text-right font-medium">
                    Tổng cộng
                  </td>
                  <td className="px-3 py-2 text-right font-bold">
                    {total.toLocaleString("vi-VN")} {inv.currency}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {/* 송금 내역 */}
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-3 text-base font-semibold text-slate-900">
          Lịch sử thanh toán ({settlements?.length ?? 0})
        </h2>
        {!settlements || settlements.length === 0 ? (
          <p className="text-sm text-slate-500">
            Chưa có thanh toán nào được ghi nhận.
          </p>
        ) : (
          <div className="overflow-hidden rounded-md border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium">Ngày nhận</th>
                  <th className="px-3 py-2 text-right font-medium">Số tiền</th>
                  <th className="px-3 py-2 font-medium">Tham chiếu</th>
                  <th className="px-3 py-2 font-medium">Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {settlements.map((s) => (
                  <tr key={s.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">
                      {new Date(s.received_at).toLocaleDateString("vi-VN")}
                    </td>
                    <td className="px-3 py-2 text-right font-medium">
                      {Number(s.amount).toLocaleString("vi-VN")} {s.currency}
                    </td>
                    <td className="px-3 py-2 text-sm">{s.bank_reference ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">
                      {s.note ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{value ?? "—"}</dd>
    </div>
  );
}
