"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";

import { submitContact } from "@/app/actions/contacts";

export function ContactForm() {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input = {
      name: String(fd.get("name") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      email: String(fd.get("email") ?? ""),
      age: String(fd.get("age") ?? ""),
      dept: String(fd.get("dept") ?? ""),
      center: String(fd.get("center") ?? ""),
      recruiting: fd.get("recruiting") === "on" ? "Y" : "N",
      message: String(fd.get("message") ?? ""),
    };
    startTransition(async () => {
      const r = await submitContact(input);
      if (r.ok) {
        setDone(true);
        toast.success(
          "Đăng ký đã được tiếp nhận / 상담 신청이 접수됐습니다"
        );
      } else {
        toast.error(r.error);
      }
    });
  }

  if (done) {
    return (
      <div className="rounded-lg border border-success/30 bg-success/5 p-6 text-sm">
        <p className="font-medium text-success mb-2">
          ✓ Đăng ký thành công / 상담 신청 완료
        </p>
        <p className="text-muted-foreground">
          Chúng tôi sẽ sớm liên hệ với bạn.
          <br />곧 연락드리겠습니다.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Họ tên / 이름" name="name" required autoFocus />
      <Field label="Số điện thoại / 전화" name="phone" type="tel" />
      <Field label="Email" name="email" type="email" />
      <Field label="Tuổi / 나이" name="age" type="number" inputMode="numeric" />
      <Field label="Ngành mong muốn / 희망 학과" name="dept" />
      <Field
        label="Trung tâm giới thiệu / 소개 센터"
        name="center"
        hint="Tùy chọn / 선택"
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="recruiting"
          className="size-4 rounded border-border"
        />
        Mong muốn hỗ trợ việc làm / 취업 연계 희망
      </label>
      <Field
        label="Tin nhắn / 메시지"
        name="message"
        textarea
        rows={4}
      />

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
  type = "text",
  required,
  textarea,
  rows,
  autoFocus,
  hint,
  inputMode,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  textarea?: boolean;
  rows?: number;
  autoFocus?: boolean;
  hint?: string;
  inputMode?: "numeric" | "tel" | "email" | "text";
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
        {hint && <span className="text-xs text-muted-foreground ml-2">{hint}</span>}
      </label>
      {textarea ? (
        <textarea
          name={name}
          required={required}
          rows={rows ?? 3}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      ) : (
        <input
          name={name}
          type={type}
          required={required}
          autoFocus={autoFocus}
          inputMode={inputMode}
          className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      )}
    </div>
  );
}
