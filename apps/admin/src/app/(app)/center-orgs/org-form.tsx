"use client";

import { useActionState } from "react";
import { Check, Loader2, Trash2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  saveOrgAction,
  type SaveOrgState,
  deleteOrgAction,
} from "./actions";

const STATUS_OPTIONS = [
  { value: "pending", label: "대기 (pending)" },
  { value: "active", label: "활성 (active)" },
  { value: "suspended", label: "정지 (suspended)" },
  { value: "closed", label: "종료 (closed)" },
] as const;

const COUNTRY_OPTIONS = [
  { value: "VN", label: "베트남 (VN)" },
  { value: "KR", label: "한국 (KR)" },
  { value: "other", label: "기타" },
];

const CURRENCY_OPTIONS = ["KRW", "USD", "VND"];

export type EditableOrg = {
  id: string;
  name_vi: string;
  name_ko: string | null;
  country: string;
  tax_id: string | null;
  status: string;
  pricing_plan_id: string | null;
  settlement_currency: string;
  contact_info: {
    address?: string;
    phone?: string;
    email?: string;
    website?: string;
    primary_contact_name?: string;
  } | null;
};

export type PlanOption = {
  id: string;
  name: string;
  model: string;
};

export function OrgForm({
  org,
  plans,
}: {
  org?: EditableOrg;
  plans: PlanOption[];
}) {
  const isEdit = !!org;
  const boundAction = isEdit
    ? saveOrgAction.bind(null, org!.id)
    : saveOrgAction.bind(null, null);
  const [state, action, pending] = useActionState<SaveOrgState, FormData>(
    boundAction,
    undefined
  );

  const fieldErr = (k: string) => state?.fieldErrors?.[k];
  const contact = org?.contact_info ?? {};

  return (
    <Card className="p-6">
      <form action={action} className="space-y-5">
        {/* 기본 */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="회사명 (베트남어)" error={fieldErr("name_vi")} required>
            <input
              type="text"
              name="name_vi"
              required
              maxLength={200}
              defaultValue={org?.name_vi ?? ""}
              placeholder="예: Công ty TNHH Du học Hàn"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </Field>

          <Field label="회사명 (한국어)" error={fieldErr("name_ko")}>
            <input
              type="text"
              name="name_ko"
              maxLength={200}
              defaultValue={org?.name_ko ?? ""}
              placeholder="예: ABC 유학원"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </Field>

          <Field label="국가" error={fieldErr("country")}>
            <select
              name="country"
              required
              defaultValue={org?.country ?? "VN"}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {COUNTRY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="세무 번호 (MST / 사업자번호)" error={fieldErr("tax_id")}>
            <input
              type="text"
              name="tax_id"
              maxLength={50}
              defaultValue={org?.tax_id ?? ""}
              placeholder="예: 0312345678"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </Field>

          <Field label="상태" error={fieldErr("status")}>
            <select
              name="status"
              required
              defaultValue={org?.status ?? "pending"}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="정산 통화">
            <select
              name="settlement_currency"
              required
              defaultValue={org?.settlement_currency ?? "KRW"}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="가격 플랜"
            error={fieldErr("pricing_plan_id")}
            full
          >
            <select
              name="pricing_plan_id"
              defaultValue={org?.pricing_plan_id ?? ""}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">— 미할당 —</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.model})
                </option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground">
              플랜이 활성화된 회사만 인보이스 발행 가능.
            </span>
          </Field>
        </div>

        {/* 연락처 */}
        <div className="rounded-md border border-dashed bg-muted/30 p-4 space-y-3">
          <div className="text-sm font-medium">연락처</div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="담당자명">
              <input
                type="text"
                name="contact_primary_name"
                defaultValue={contact.primary_contact_name ?? ""}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </Field>
            <Field label="전화">
              <input
                type="text"
                name="contact_phone"
                defaultValue={contact.phone ?? ""}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </Field>
            <Field label="이메일">
              <input
                type="email"
                name="contact_email"
                defaultValue={contact.email ?? ""}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </Field>
            <Field label="웹사이트">
              <input
                type="text"
                name="contact_website"
                defaultValue={contact.website ?? ""}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </Field>
            <Field label="주소" full>
              <input
                type="text"
                name="contact_address"
                defaultValue={contact.address ?? ""}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </Field>
          </div>
        </div>

        {state?.error ? (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.error}
          </div>
        ) : null}

        <div className="flex items-center justify-between border-t border-border pt-4">
          <div className="flex items-center gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  저장 중...
                </>
              ) : (
                <>
                  <Check className="size-4" />
                  {isEdit ? "저장" : "회사 등록"}
                </>
              )}
            </Button>
            <a
              href="/center-orgs"
              className={buttonVariants({ variant: "outline" })}
            >
              취소
            </a>
          </div>
          {isEdit ? <DeleteButton orgId={org!.id} name={org!.name_vi} /> : null}
        </div>
      </form>
    </Card>
  );
}

function DeleteButton({ orgId, name }: { orgId: string; name: string }) {
  return (
    <form
      action={deleteOrgAction.bind(null, orgId)}
      onSubmit={(e) => {
        if (
          !confirm(
            `정말 "${name}" 을 삭제하시겠습니까? 인보이스가 있으면 삭제할 수 없습니다.`
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <Button
        type="submit"
        variant="outline"
        className="text-destructive hover:bg-destructive/10"
      >
        <Trash2 className="size-4" />
        삭제
      </Button>
    </form>
  );
}

function Field({
  label,
  error,
  full,
  required,
  children,
}: {
  label: string;
  error?: string;
  full?: boolean;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${full ? "md:col-span-2" : ""}`}>
      <span className="text-sm font-medium">
        {label}
        {required ? <span className="text-destructive ml-0.5">*</span> : null}
      </span>
      {children}
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </label>
  );
}
