"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft, Loader2, Save } from "lucide-react";

import { createCeoCareHome } from "@/lib/ceo/actions";
import type { FindingCustomer } from "@/lib/ceo/findings";
import { FindingChecklist } from "@/components/ceo/finding-checklist";

type FormState = {
  name: string;
  region: string;
  phone: string;
  director_name: string;
  director_phone: string;
  contact_person: string;
  contact_phone: string;
  address: string;
  bed_capacity: string;
  partnership_notes: string;
};

const EMPTY: FormState = {
  name: "",
  region: "",
  phone: "",
  director_name: "",
  director_phone: "",
  contact_person: "",
  contact_phone: "",
  address: "",
  bed_capacity: "",
  partnership_notes: "",
};

export function CeoHomeForm({ findings }: { findings: FindingCustomer[] }) {
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
      toast.error("요양원 이름은 필수입니다.");
      return;
    }
    startTransition(async () => {
      const r = await createCeoCareHome(
        {
          name: form.name,
          region: form.region,
          phone: form.phone,
          director_name: form.director_name,
          director_phone: form.director_phone,
          contact_person: form.contact_person,
          contact_phone: form.contact_phone,
          address: form.address,
          bed_capacity: form.bed_capacity,
          partnership_notes: form.partnership_notes,
        },
        selected
      );
      if (r.ok) {
        toast.success("요양원이 등록되었습니다.");
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
      <h1 className="text-lg font-semibold">요양원 등록</h1>

      <div className="space-y-3">
        <Field label="요양원 이름" required value={form.name} onChange={set("name")} />
        <Field label="지역" value={form.region} onChange={set("region")} placeholder="예: 부산 해운대구" />
        <Field label="대표 연락처" value={form.phone} onChange={set("phone")} type="tel" placeholder="051-000-0000" />
        <Field label="대표자 이름" value={form.director_name} onChange={set("director_name")} />
        <Field label="대표자 연락처" value={form.director_phone} onChange={set("director_phone")} type="tel" placeholder="010-0000-0000" />
        <Field label="담당자 이름" value={form.contact_person} onChange={set("contact_person")} />
        <Field label="담당자 연락처" value={form.contact_phone} onChange={set("contact_phone")} type="tel" placeholder="010-0000-0000" />
        <Field label="주소" value={form.address} onChange={set("address")} />
        <Field label="병상 수" value={form.bed_capacity} onChange={set("bed_capacity")} placeholder="예: 90병상" />
        <Field label="메모" value={form.partnership_notes} onChange={set("partnership_notes")} textarea placeholder="통화 내용·특이사항" />
      </div>

      <FindingChecklist
        title="요양원 발굴 필요 고객"
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
