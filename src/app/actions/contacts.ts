"use server";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import {
  sendCustomerConfirmation,
  sendOperatorNotification,
} from "@/lib/email";

// =============================================================================
// 상담 신청
// =============================================================================

const contactSchema = z.object({
  name: z.string().trim().min(1, "이름을 입력해주세요."),
  phone: z.string().trim().optional().nullable(),
  email: z.string().trim().email("이메일 형식이 올바르지 않습니다.").optional()
    .or(z.literal("")),
  age: z.union([z.string(), z.number()]).optional().nullable(),
  dept: z.string().trim().optional().nullable(),
  center: z.string().trim().optional().nullable(),
  recruiting: z.string().optional().nullable(),
  message: z.string().trim().optional().nullable(),
});

export type ContactInput = z.input<typeof contactSchema>;

export async function submitContact(
  input: ContactInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const data = parsed.data;
  const ageNum =
    data.age == null || data.age === ""
      ? null
      : typeof data.age === "number"
        ? data.age
        : Number(data.age);

  const supabase = await createClient();
  const { error } = await supabase.from("study_contacts").insert({
    name: data.name,
    phone: data.phone || null,
    email: data.email || null,
    age: Number.isFinite(ageNum as number) ? (ageNum as number) : null,
    dept: data.dept || null,
    center: data.center || null,
    recruiting: data.recruiting || null,
    message: data.message || null,
  });

  if (error) return { ok: false, error: error.message };

  // 운영자 알림
  await sendOperatorNotification({
    subject: `[글로케어] 새 상담 신청: ${data.name}`,
    html: `
      <h2>새 상담 신청이 접수되었습니다</h2>
      <table cellpadding="6" style="border-collapse:collapse;border:1px solid #eee">
        <tr><td><b>이름</b></td><td>${escape(data.name)}</td></tr>
        <tr><td><b>전화</b></td><td>${escape(data.phone) || "—"}</td></tr>
        <tr><td><b>이메일</b></td><td>${escape(data.email) || "—"}</td></tr>
        <tr><td><b>나이</b></td><td>${ageNum ?? "—"}</td></tr>
        <tr><td><b>희망 학과</b></td><td>${escape(data.dept) || "—"}</td></tr>
        <tr><td><b>소개 센터</b></td><td>${escape(data.center) || "—"}</td></tr>
        <tr><td><b>취업 희망</b></td><td>${data.recruiting === "Y" ? "예" : "아니오"}</td></tr>
        <tr><td valign="top"><b>메시지</b></td><td><pre style="margin:0;white-space:pre-wrap">${escape(data.message) || "—"}</pre></td></tr>
      </table>
      <p style="color:#888;font-size:12px;margin-top:16px">
        admin: <a href="https://glocare-customer.vercel.app/students">https://glocare-customer.vercel.app/students</a>
      </p>
    `,
  });

  // 고객 confirmation
  if (data.email) {
    await sendCustomerConfirmation({
      to: data.email,
      subject: "[Glocare] Đã nhận đăng ký tư vấn / 상담 신청 접수",
      html: `
        <p>Xin chào ${escape(data.name)},</p>
        <p>Đăng ký tư vấn của bạn đã được tiếp nhận. Chúng tôi sẽ sớm liên hệ.</p>
        <p>안녕하세요 ${escape(data.name)}님,<br>
        상담 신청이 정상 접수되었습니다. 곧 연락드리겠습니다.</p>
        <hr>
        <p style="color:#888;font-size:12px">Glocare · help@glocare.co.kr</p>
      `,
    });
  }

  return { ok: true };
}

// =============================================================================
// 보험 신청
// =============================================================================

const insuranceSchema = z.object({
  name: z.string().trim().min(1, "이름을 입력해주세요."),
  alien_no: z.string().trim().min(1, "외국인등록번호를 입력해주세요."),
  zalo: z.string().trim().min(1, "Zalo 또는 전화번호를 입력해주세요."),
  marketing: z.string().optional().nullable(),
});

export type InsuranceInput = z.input<typeof insuranceSchema>;

export async function submitInsurance(
  input: InsuranceInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = insuranceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const data = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("study_insurance_claims").insert({
    name: data.name,
    alien_no: data.alien_no,
    zalo: data.zalo,
    marketing: data.marketing || "N",
  });

  if (error) return { ok: false, error: error.message };

  await sendOperatorNotification({
    subject: `[글로케어] 새 보험 신청: ${data.name}`,
    html: `
      <h2>새 보험 신청이 접수되었습니다</h2>
      <table cellpadding="6" style="border-collapse:collapse;border:1px solid #eee">
        <tr><td><b>이름</b></td><td>${escape(data.name)}</td></tr>
        <tr><td><b>외국인등록번호</b></td><td>${escape(data.alien_no)}</td></tr>
        <tr><td><b>Zalo / 전화</b></td><td>${escape(data.zalo)}</td></tr>
        <tr><td><b>마케팅 동의</b></td><td>${data.marketing === "Y" ? "예" : "아니오"}</td></tr>
      </table>
      <p style="color:#888;font-size:12px;margin-top:16px">
        admin: <a href="https://glocare-customer.vercel.app/students?tab=insurance">https://glocare-customer.vercel.app/students?tab=insurance</a>
      </p>
    `,
  });

  return { ok: true };
}

// =============================================================================
// HTML escape
// =============================================================================
function escape(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
