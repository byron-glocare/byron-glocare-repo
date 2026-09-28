"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft, Loader2, Save } from "lucide-react";

import { createCeoTrainingCenter } from "@/lib/ceo/actions";
import type { FindingCustomer } from "@/lib/ceo/findings";
import { FindingChecklist } from "@/components/ceo/finding-checklist";

type FormState = {
  name: string;
  region: string;
  phone: string;
  director_name: string;
  director_phone: string;
  address: string;
  notes: string;
};

const EMPTY: FormState = {
  name: "",
  region: "",
  phone: "",
  director_name: "",
  director_phone: "",
  address: "",
  notes: "",
};

export function CeoCenterForm({ findings }: { findings: FindingCustomer[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [selected, setSelected] = useState<string[]>([]);

  const set = (k: keyof FormState) => (v: string) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function onSubmit() {
    if (!form.name.trim()) {
      toast.error("교육원 이름은 필수입니다.");
      return;
    }
    startTransition(async () => {
      const r = await createCeoTrainingCenter(
        {
          name: form.name,
          region: form.region,
          phone: form.phone,
          director_name: form.director_name,
          director_phone: form.director_phone,
          address: form.address,
          notes: form.notes,
        },
        selected
      );
      if (r.ok) {
        toast.success("교육원이 등록되었습니다.");
        router.push("/ceo");
        router.refresh();
      } else {
        toast.error("등록 실패", { description: r.error });
      }
    });
  }

  return (
    <div className="space-y-5">
      <Link
        href="/ceo"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        뒤로
      </Link>
      <h1 className="text-lg font-semibold">교육원 등록</h1>

      <div className="space-y-3">
        <Field label="교육원 이름" required value={form.name} onChange={set("name")} />
        <Field label="지역" value={form.region} onChange={set("region")} placeholder="예: 대구 달서구" />
        <Field label="대표 연락처" value={form.phone} onChange={set("phone")} type="tel" placeholder="053-000-0000" />
        <Field label="대표자 이름" value={form.director_name} onChange={set("director_name")} />
        <Field label="대표자 연락처" value={form.director_phone} onChange={set("director_phone")} type="tel" placeholder="010-0000-0000" />
        <Field label="주소" value={form.address} onChange={set("address")} />
        <Field label="메모" value={form.notes} onChange={set("notes")} textarea placeholder="통화 내용·특이사항" />
      </div>

      <FindingChecklist
        title="교육원 발굴 필요 고객"
        customers={findings}
        selected={selected}
        onToggle={toggle}
        disabled={pending}
      />

      <button
        type="button"
        onClick={onSubmit}
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3.5 text-base font-semibold text-primary-foreground disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          <Save className="size-5" />
        )}
        저장하기
      </button>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  type = "text",
  placeholder,
  textarea,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
  placeholder?: string;
  textarea?: boolean;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">
        {label}
        {required ? <span className="ml-0.5 text-destructive">*</span> : null}
      </span>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          placeholder={placeholder}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-base"
        />
      )}
    </label>
  );
}
