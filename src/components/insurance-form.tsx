"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";

import { submitInsurance } from "@/app/actions/contacts";

export function InsuranceForm() {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input = {
      name: String(fd.get("name") ?? ""),
      alien_no: String(fd.get("alien_no") ?? ""),
      zalo: String(fd.get("zalo") ?? ""),
      marketing: fd.get("marketing") === "on" ? "Y" : "N",
    };
    startTransition(async () => {
      const r = await submitInsurance(input);
      if (r.ok) {
        setDone(true);
        toast.success("Đăng ký đã được tiếp nhận");
      } else {
        toast.error(r.error);
      }
    });
  }

  if (done) {
    return (
      <div className="rounded-lg border border-success/30 bg-success/5 p-6 text-sm">
        <p className="font-medium text-success mb-2">
          ✓ Đăng ký bảo hiểm đã được tiếp nhận
        </p>
        <p className="text-muted-foreground">곧 연락드리겠습니다.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Họ tên / 이름" name="name" required autoFocus />
      <Field
        label="Số đăng ký người nước ngoài / 외국인등록번호"
        name="alien_no"
        required
      />
      <Field label="Zalo / 전화" name="zalo" required />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="marketing"
          className="size-4 rounded border-border"
        />
        Đồng ý nhận thông tin marketing / 마케팅 정보 수신 동의
      </label>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 w-full"
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Send className="size-4" />
        )}
        Đăng ký / 신청
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  required,
  autoFocus,
}: {
  label: string;
  name: string;
  required?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      <input
        name={name}
        required={required}
        autoFocus={autoFocus}
        className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
    </div>
  );
}
