"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  FileText,
  Link2,
  Loader2,
  MessageCircle,
  Receipt,
  Undo2,
} from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  completeSettlementBatch,
  revertSingleCustomer,
  settleSingleCustomer,
} from "@/app/(app)/settlements/actions";
import { sendCommissionSms } from "@/app/(app)/sms/actions";
import {
  createSettlementShareLink,
  prepareSettlementPdfUpload,
  revokeShareLink,
} from "@/app/(app)/sms/share-link-actions";
import { generateSettlementPdf } from "@/lib/settlement-pdf";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";
import { SHARE_FILES_BUCKET, SHARE_LINK_TTL_DAYS } from "@/lib/share-links";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

type Row = {
  commissionId: string;
  customerId: string;
  customerName: string;
  classStartDate: string | null;
  classTypeLabel: string | null;
  tuitionBase: number;
  deduction: number;
  net: number;
};

type Group = {
  centerId: string;
  centerName: string;
  region: string | null;
  /** 대표자 연락처 — 표시용 (없으면 빈 문자열) */
  directorPhone: string;
  /** 대표 번호 — fallback 표시용 */
  mainPhone: string;
  /** 담당자 연락처 */
  contactPhone: string;
  /** 실제 발송에 사용되는 번호 (director_phone > phone fallback) */
  recipientPhone: string;
  phoneSource: "director" | "main" | "contact" | "none";
  directorName: string;
  email: string;
  settlementMonth: string; // YYYY-MM-01
  rows: Row[];
  totals: { total: number; deduction: number; net: number };
  message: string;
};

type Props = {
  groups: Group[];
};

type PhoneChoice = "phone" | "director" | "contact" | "custom";

/** "01012345678" → "010-1234-5678", "0212345678" → "02-1234-5678" */
function formatPhoneInput(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.startsWith("02")) {
    if (d.length <= 2) return d;
    if (d.length <= 5) return `${d.slice(0, 2)}-${d.slice(2)}`;
    if (d.length <= 9) return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`;
    return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6, 10)}`;
  }
  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

export function SmsCommissionView({ groups }: Props) {
  if (groups.length === 0) {
    return (
      <Card className="p-12 text-center space-y-4">
        <div className="size-12 rounded-full bg-muted mx-auto flex items-center justify-center">
          <Receipt className="size-6 text-muted-foreground" />
        </div>
        <div>
          <div className="text-base font-medium">
            확정된 정산 내역이 없습니다.
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            정산 페이지에서 [정산 금액 확정] 을 누르면 발송 대기 상태가 됩니다.
          </p>
        </div>
        <Link
          href="/settlements?tab=pending"
          className={cn(buttonVariants(), "mx-auto")}
        >
          정산 확정하기 →
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground">
        총 {groups.length}건 — 입금 받은 후 [완료 처리] 로 마무리하세요.
      </div>
      {groups.map((g) => (
        <GroupRow
          key={`${g.centerId}::${g.settlementMonth}`}
          group={g}
        />
      ))}
    </div>
  );
}

function GroupRow({ group }: { group: Group }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  // 문자 발송 모달
  const [smsModalOpen, setSmsModalOpen] = useState(false);
  const [smsBody, setSmsBody] = useState(group.message);
  const [smsSending, setSmsSending] = useState(false);

  // 수신 번호 — 교육원의 모든 번호를 라디오로, 기본값은 선택된 발송 번호
  const numberOptions = [
    { key: "phone" as const, label: "대표번호", value: group.mainPhone },
    { key: "director" as const, label: "대표자 연락처", value: group.directorPhone },
    { key: "contact" as const, label: "담당자 연락처", value: group.contactPhone },
  ].filter((o) => o.value);
  function defaultChoice(): PhoneChoice {
    const match = numberOptions.find((o) => o.value === group.recipientPhone);
    return match?.key ?? numberOptions[0]?.key ?? "custom";
  }
  const [phoneChoice, setPhoneChoice] = useState<PhoneChoice>(defaultChoice());
  const [customPhone, setCustomPhone] = useState("");
  const selectedPhone =
    phoneChoice === "custom"
      ? customPhone.trim()
      : numberOptions.find((o) => o.key === phoneChoice)?.value ?? "";

  const ym = group.settlementMonth.slice(0, 7);
  const printItems = group.rows
    .map((r) => `${r.customerId}:${r.deduction}`)
    .join(",");
  const printHref = `/settlements/print?center=${group.centerId}&month=${ym}&items=${encodeURIComponent(printItems)}`;

  // 정산서 PDF 다운로드 링크 (/d/<code>, 30일)
  const [shareLink, setShareLink] = useState<{
    code: string;
    url: string;
    expiresAt: string;
  } | null>(null);
  const [linkStep, setLinkStep] = useState<string | null>(null);

  function withLink(body: string, url: string) {
    return `${body.trimEnd()}\n\n▼ 정산서 PDF 내려받기 (${SHARE_LINK_TTL_DAYS}일간 유효)\n${url}`;
  }

  function openSmsModal() {
    setPhoneChoice(defaultChoice());
    setCustomPhone("");
    setSmsBody(
      shareLink ? withLink(group.message, shareLink.url) : group.message
    );
    setSmsModalOpen(true);
  }

  async function handleCreateLink() {
    try {
      setLinkStep("PDF 만드는 중…");
      const pdf = await generateSettlementPdf(printHref);

      setLinkStep("업로드 중…");
      const prep = await prepareSettlementPdfUpload({
        centerId: group.centerId,
        month: ym,
      });
      if (!prep.ok) throw new Error(prep.error);
      const { error: upErr } = await createBrowserSupabase()
        .storage.from(SHARE_FILES_BUCKET)
        .uploadToSignedUrl(prep.data.path, prep.data.token, pdf, {
          contentType: "application/pdf",
        });
      if (upErr) throw new Error(`업로드 실패: ${upErr.message}`);

      setLinkStep("링크 만드는 중…");
      const made = await createSettlementShareLink({
        centerId: group.centerId,
        month: ym,
        path: prep.data.path,
      });
      if (!made.ok) throw new Error(made.error);

      const link = made.data;
      setShareLink(link);
      setSmsBody((b) => withLink(b, link.url));
      toast.success("정산서 링크를 본문에 넣었습니다.", {
        description: `PDF ${(pdf.size / 1024 / 1024).toFixed(1)}MB`,
      });
    } catch (e) {
      toast.error("정산서 링크 생성 실패", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setLinkStep(null);
    }
  }

  async function handleRevokeLink() {
    if (!shareLink) return;
    if (!confirm("이 링크를 즉시 사용 중지합니다. 이미 보낸 문자의 링크도 열리지 않게 됩니다.")) return;
    const res = await revokeShareLink(shareLink.code);
    if (!res.ok) {
      toast.error("링크 취소 실패", { description: res.error });
      return;
    }
    setSmsBody((b) =>
      b
        .replace(
          `\n\n▼ 정산서 PDF 내려받기 (${SHARE_LINK_TTL_DAYS}일간 유효)\n${shareLink.url}`,
          ""
        )
        .trimEnd()
    );
    setShareLink(null);
    toast.success("링크를 사용 중지했습니다.");
  }

  async function handleSendSms() {
    if (!selectedPhone) {
      toast.error("수신자 전화번호를 선택하거나 입력해주세요.");
      return;
    }
    setSmsSending(true);
    const result = await sendCommissionSms({
      centerId: group.centerId,
      recipientPhone: selectedPhone,
      body: smsBody,
      customerIds: group.rows.map((r) => r.customerId),
    });
    setSmsSending(false);
    if (!result.ok) {
      toast.error("문자 발송 실패", { description: result.error });
      return;
    }
    toast.success("문자 발송 완료" + (result.warning ? ` (${result.warning})` : ""));
    setSmsModalOpen(false);
    router.refresh();
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(group.message);
      toast.success("본문이 복사되었습니다. 카카오톡/이메일에 붙여넣으세요.");
    } catch {
      toast.error("복사 실패");
    }
  }

  function handleBulkComplete() {
    if (
      !confirm(
        `${group.centerName} ${group.rows.length}명을 일괄 완료 처리합니다. 입금 확인되셨나요?`
      )
    ) {
      return;
    }
    startTransition(async () => {
      // 기존 confirmed row 를 모두 delete 후 completed insert.
      // (commission_payments.customer_id unique 제약 — update 보다 안전한 방식)
      for (const r of group.rows) {
        await revertSingleCustomer(r.customerId);
      }
      const result = await completeSettlementBatch({
        settlement_month: group.settlementMonth,
        training_center_id: group.centerId,
        status: "completed",
        items: group.rows.map((r) => ({
          customer_id: r.customerId,
          total_amount: r.tuitionBase,
          deduction_amount: r.deduction,
        })),
      });
      if (!result.ok) {
        toast.error("일괄 완료 실패", { description: result.error });
        return;
      }
      toast.success(`${result.data.inserted}건 완료 처리됨`);
      router.refresh();
    });
  }

  function handleSingleComplete(r: Row) {
    if (
      !confirm(
        `${r.customerName} 완료 처리합니다. 입금 확인되셨나요?\n순 정산액: ${formatCurrency(r.net)}`
      )
    ) {
      return;
    }
    startTransition(async () => {
      // revert (confirmed delete) + completed insert
      await revertSingleCustomer(r.customerId);
      const result = await settleSingleCustomer({
        customer_id: r.customerId,
        training_center_id: group.centerId,
        settlement_month: group.settlementMonth,
        total_amount: r.tuitionBase,
        deduction_amount: r.deduction,
        status: "completed",
      });
      if (!result.ok) {
        toast.error("완료 처리 실패", { description: result.error });
        return;
      }
      toast.success(`${r.customerName} 완료 처리됨`);
      router.refresh();
    });
  }

  function handleSingleRevert(r: Row) {
    if (
      !confirm(
        `${r.customerName} 확정을 되돌려 정산 예정으로 보냅니다. 진행하시겠습니까?`
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await revertSingleCustomer(r.customerId);
      if (!result.ok) {
        toast.error("되돌리기 실패", { description: result.error });
        return;
      }
      toast.success(`${r.customerName} 정산 예정으로 되돌림`);
      router.refresh();
    });
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-start gap-3 p-4 border-b border-border bg-muted/30">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex flex-col items-start gap-1 hover:text-primary min-w-0"
        >
          <div className="flex items-center gap-2">
            {open ? (
              <ChevronDown className="size-4 shrink-0" />
            ) : (
              <ChevronRight className="size-4 shrink-0" />
            )}
            <span className="font-semibold truncate">{group.centerName}</span>
            {group.region && (
              <Badge variant="outline" className="text-xs shrink-0">
                {group.region}
              </Badge>
            )}
            <Badge
              variant="outline"
              className="text-xs font-mono shrink-0 bg-info/10 text-info border-info/20"
            >
              {ym} 확정
            </Badge>
            <Badge variant="secondary" className="text-xs shrink-0">
              {group.rows.length}명
            </Badge>
          </div>
          {/* 원장 연락처 + 이메일 — 표시용. 발송 시 모달에서 편집 가능 */}
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground pl-6">
            <span>
              원장{" "}
              <span className="text-foreground">
                {group.directorName || "—"}
              </span>
              {group.directorPhone ? ` · ${group.directorPhone}` : ""}
            </span>
            {group.email && (
              <span>
                이메일{" "}
                <span className="text-foreground">{group.email}</span>
              </span>
            )}
          </div>
        </button>
        <div className="ml-auto flex items-center gap-3">
          <div className="text-base font-semibold">
            {formatCurrency(group.totals.net)}
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleCopy}
          >
            <Copy className="size-4" />
            본문 복사
          </Button>
          <Link
            href={printHref}
            target="_blank"
            rel="noopener"
            className={cn(
              buttonVariants({ size: "sm", variant: "outline" }),
              "gap-2"
            )}
          >
            <FileText className="size-4" />
            정산서
          </Link>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={openSmsModal}
          >
            <MessageCircle className="size-4" />
            문자 보내기
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleBulkComplete}
            disabled={pending}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            일괄 완료
          </Button>
        </div>
      </div>

      {open && (
        <div className="p-4 space-y-4">
          {/* 교육생 표 */}
          <div className="overflow-hidden rounded-md border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/30">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">이름</th>
                  <th className="px-3 py-2 text-left font-medium">개강일정</th>
                  <th className="px-3 py-2 text-right font-medium">
                    수강료 × 25%
                  </th>
                  <th className="px-3 py-2 text-right font-medium">공제</th>
                  <th className="px-3 py-2 text-right font-medium">정산액</th>
                  <th className="px-3 py-2 text-right font-medium w-32"></th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map((r) => (
                  <tr key={r.customerId} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">
                      <Link
                        href={`/customers/${r.customerId}`}
                        className="hover:text-primary"
                      >
                        {r.customerName}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {r.classStartDate ?? "—"}
                      {r.classTypeLabel ? ` (${r.classTypeLabel})` : ""}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {formatCurrency(r.tuitionBase)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {r.deduction > 0
                        ? `−${formatCurrency(r.deduction)}`
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-medium">
                      {formatCurrency(r.net)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleSingleComplete(r)}
                          disabled={pending}
                          className="h-7 px-2 text-xs"
                        >
                          <Check className="size-3.5" />
                          완료
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSingleRevert(r)}
                          disabled={pending}
                          className="h-7 px-2 text-xs text-muted-foreground"
                          title="확정 되돌리기"
                        >
                          <Undo2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* SMS 본문 미리보기 */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                알림 본문 (카카오톡/이메일에 그대로 붙여넣기)
              </label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleCopy}
              >
                <Copy className="size-3.5" />
                복사
              </Button>
            </div>
            <Textarea
              value={group.message}
              readOnly
              rows={Math.min(28, Math.max(12, group.message.split("\n").length))}
              className="font-mono text-xs leading-relaxed"
              onFocus={(e) => e.target.select()}
            />
          </div>
        </div>
      )}

      {/* 문자 발송 모달 */}
      <Dialog open={smsModalOpen} onOpenChange={setSmsModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>문자 발송 — {group.centerName}</DialogTitle>
            <DialogDescription className="text-xs">
              발신: 010-2825-4849 (글로케어). 수신자 기본값 = 교육원 정보에서
              선택한 문자 발송 번호 → (미선택 시) 대표자 번호 → 대표 번호.
              모두 없으면 아래에서 직접 입력하세요.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">
                수신자 전화번호
              </Label>
              <div className="mt-1 space-y-1.5 rounded-md border border-border p-3">
                {numberOptions.length === 0 && (
                  <p className="text-[11px] text-warning">
                    이 교육원에 등록된 번호가 없습니다. 아래에 직접 입력하세요.
                  </p>
                )}
                {numberOptions.map((o) => (
                  <label
                    key={o.key}
                    className="flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <input
                      type="radio"
                      name={`commission-phone-${group.centerId}-${group.settlementMonth}`}
                      className="accent-primary"
                      checked={phoneChoice === o.key}
                      onChange={() => setPhoneChoice(o.key)}
                      disabled={smsSending}
                    />
                    <span className="font-mono">{o.value}</span>
                    <span className="text-xs text-muted-foreground">
                      {o.label}
                      {o.value === group.recipientPhone ? " · 발송 번호" : ""}
                    </span>
                  </label>
                ))}
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name={`commission-phone-${group.centerId}-${group.settlementMonth}`}
                    className="accent-primary shrink-0"
                    checked={phoneChoice === "custom"}
                    onChange={() => setPhoneChoice("custom")}
                    disabled={smsSending}
                  />
                  <span className="text-xs text-muted-foreground shrink-0">
                    직접 입력
                  </span>
                  <Input
                    value={customPhone}
                    onChange={(e) =>
                      setCustomPhone(formatPhoneInput(e.target.value))
                    }
                    onFocus={() => setPhoneChoice("custom")}
                    placeholder="010-0000-0000"
                    className="h-8 font-mono text-sm"
                    disabled={smsSending}
                  />
                </label>
              </div>
            </div>
            <div className="rounded-md border border-border p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-medium">정산서 PDF 링크</div>
                  <p className="text-[11px] text-muted-foreground">
                    누르면 스마트폰에서 PDF가 바로 저장됩니다 · {SHARE_LINK_TTL_DAYS}일 후 자동 만료
                  </p>
                </div>
                {shareLink ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <a
                      href={shareLink.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        buttonVariants({ size: "sm", variant: "outline" }),
                        "h-7 px-2 text-xs"
                      )}
                    >
                      내려받아 확인
                    </a>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={handleRevokeLink}
                      disabled={smsSending}
                      className="h-7 px-2 text-xs text-destructive"
                    >
                      링크 취소
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleCreateLink}
                    disabled={smsSending || !!linkStep}
                    className="shrink-0"
                  >
                    {linkStep ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Link2 className="size-4" />
                    )}
                    {linkStep ?? "링크 만들어 본문에 넣기"}
                  </Button>
                )}
              </div>
              {shareLink && (
                <p className="text-[11px] font-mono text-muted-foreground break-all">
                  {shareLink.url} · 만료{" "}
                  {new Date(shareLink.expiresAt).toLocaleDateString("ko-KR")}
                </p>
              )}
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">본문</Label>
              <Textarea
                value={smsBody}
                onChange={(e) => setSmsBody(e.target.value)}
                rows={12}
                className="font-mono text-xs leading-relaxed max-h-[40vh] overflow-y-auto resize-none"
                disabled={smsSending}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                {new TextEncoder().encode(smsBody).length} byte / 2000 byte
                (MMS 한도)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSmsModalOpen(false)}
              disabled={smsSending}
            >
              취소
            </Button>
            <Button
              type="button"
              onClick={handleSendSms}
              disabled={smsSending || !selectedPhone}
            >
              {smsSending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <MessageCircle className="size-4" />
              )}
              발송
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
