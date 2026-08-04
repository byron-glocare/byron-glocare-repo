import { notFound } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";

import { ORDER_STATUS_LABEL, orderStatusVariant } from "../status";
import { OrderControls } from "./order-controls";

export const dynamic = "force-dynamic";

export default async function IssuanceOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data: order } = await admin
    .from("study_issuance_orders")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!order) notFound();

  const [{ data: items }, { data: student }, { data: uni }] = await Promise.all([
    admin
      .from("study_issuance_order_items")
      .select("id, label_ko, notarization, unit_price, qty")
      .eq("order_id", id),
    admin
      .from("study_managed_students")
      .select("id, name, phone, email")
      .eq("id", order.student_id)
      .maybeSingle(),
    order.university_id
      ? admin
          .from("universities")
          .select("name_ko")
          .eq("id", order.university_id)
          .maybeSingle()
      : Promise.resolve({ data: null as { name_ko: string } | null }),
  ]);

  const snapshot =
    order.contact_snapshot && typeof order.contact_snapshot === "object"
      ? (order.contact_snapshot as Record<string, unknown>)
      : null;

  return (
    <>
      <PageHeader
        title={`발급 대행 — ${student?.name ?? "학생"}`}
        description="발급 서류 대행 주문 진행·결과 관리"
        breadcrumbs={[
          { href: "/issuance-orders", label: "발급 대행" },
          { label: student?.name ?? "주문" },
        ]}
      />
      <div className="p-6 grid gap-6 lg:grid-cols-2">
        {/* 좌: 주문 내용 */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3">
              <CardTitle className="text-base">주문 내역</CardTitle>
              <Badge variant={orderStatusVariant(order.status)}>
                {ORDER_STATUS_LABEL[order.status] ?? order.status}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm text-muted-foreground">
                학생: <span className="text-foreground">{student?.name ?? "—"}</span>
                {" · "}대상 대학:{" "}
                <span className="text-foreground">{uni?.name_ko ?? "공통"}</span>
                {" · "}신청일 {formatDate(order.created_at)}
              </div>
              <ul className="divide-y">
                {(items ?? []).map((it) => (
                  <li key={it.id} className="flex justify-between py-2 text-sm">
                    <span>
                      {it.label_ko}
                      {it.notarization !== "none" ? (
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({it.notarization})
                        </span>
                      ) : null}
                      <span className="ml-2 text-muted-foreground">× {it.qty}</span>
                    </span>
                    <span className="tabular-nums">
                      {(it.unit_price * it.qty).toLocaleString()}원
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex justify-between border-t pt-2 font-semibold">
                <span>합계</span>
                <span>{order.subtotal.toLocaleString()}원</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">연락·신원 정보</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <div className="mb-2 text-muted-foreground">
                연락처: {student?.phone ?? "—"} · {student?.email ?? "—"}
              </div>
              {snapshot ? (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {Object.entries(snapshot).map(([k, v]) => (
                    <div key={k} className="col-span-2 sm:col-span-1">
                      <dt className="text-xs text-muted-foreground">{k}</dt>
                      <dd className="text-sm">
                        {typeof v === "object"
                          ? JSON.stringify(v)
                          : String(v ?? "—")}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-xs text-muted-foreground">
                  아직 수집된 추가 정보가 없습니다. (결제 후 필수정보 수집 — P3b)
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 우: 진행 관리 */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">진행 관리</CardTitle>
            </CardHeader>
            <CardContent>
              <OrderControls
                id={order.id}
                status={order.status}
                etaDate={order.eta_date}
                managerNote={order.manager_note}
                resultPdfPath={order.result_pdf_path}
                cancelled={order.status === "cancelled"}
              />
              {order.status === "cancelled" && order.cancel_reason ? (
                <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  취소 사유: {order.cancel_reason}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
