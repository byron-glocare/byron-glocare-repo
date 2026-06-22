"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save, Users } from "lucide-react";

import { saveStudyCenterSettlement } from "@/app/(app)/study-centers/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type Plan = { id: string; name: string; model: string };
type CenterUser = { email: string; role: "admin" | "user"; status: string };

const CURRENCIES = ["KRW", "USD", "VND"] as const;
const STATUSES = [
  { value: "pending", label: "대기" },
  { value: "active", label: "활성" },
  { value: "suspended", label: "정지" },
  { value: "closed", label: "종료" },
] as const;

export function StudyCenterSettlement({
  studyCenterId,
  plans,
  current,
  accounts,
}: {
  studyCenterId: number;
  plans: Plan[];
  current: {
    pricingPlanId: string | null;
    currency: string;
    status: string;
  } | null;
  accounts: CenterUser[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pricingPlanId, setPricingPlanId] = useState(
    current?.pricingPlanId ?? ""
  );
  const [currency, setCurrency] = useState(current?.currency ?? "KRW");
  const [status, setStatus] = useState(current?.status ?? "active");

  function onSave() {
    startTransition(async () => {
      const r = await saveStudyCenterSettlement(studyCenterId, {
        pricingPlanId: pricingPlanId || null,
        currency: currency as "KRW" | "USD" | "VND",
        status: status as "pending" | "active" | "suspended" | "closed",
      });
      if (r.ok) {
        toast.success("정산 설정을 저장했습니다.");
        router.refresh();
      } else {
        toast.error("저장 실패", { description: r.error });
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">정산 설정</CardTitle>
        <CardDescription>
          이 유학센터의 B2B 정산 단위입니다. (가격 플랜은 “가격 플랜” 메뉴에서 정의)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label className="text-xs">가격 플랜</Label>
            <select
              value={pricingPlanId}
              onChange={(e) => setPricingPlanId(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">미할당</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.model})
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs">정산 통화</Label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs">상태</Label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="button" size="sm" onClick={onSave} disabled={pending}>
            {pending ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Save className="size-3" />
            )}
            저장
          </Button>
        </div>

        {/* 이 센터의 로그인 계정 */}
        <div className="rounded-md border border-border bg-muted/30 p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <Users className="size-3.5" />
              로그인 계정 {accounts.length}명
            </div>
            <Link
              href="/accounts"
              className="text-xs text-primary hover:underline"
            >
              계정 관리 →
            </Link>
          </div>
          {accounts.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              아직 로그인 계정이 없습니다. “계정 관리” 메뉴에서 추가하세요.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {accounts.map((a) => (
                <Badge
                  key={a.email}
                  variant="outline"
                  className={
                    a.status === "active"
                      ? ""
                      : "border-destructive/20 text-destructive"
                  }
                >
                  {a.email}
                  {a.role === "admin" ? " · 관리자" : ""}
                  {a.status !== "active" ? " · 정지" : ""}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
