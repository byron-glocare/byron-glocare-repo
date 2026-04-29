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
  const isPartnerSubmit = data.recruiting === "partner";
  await sendOperatorNotification({
    subject: isPartnerSubmit
      ? `[글로케어] 새 제휴 문의: ${data.name}`
      : `[글로케어] 새 상담 신청: ${data.name}`,
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

  // 고객 confirmation (이메일 입력 시에만)
  if (data.email) {
    const isPartner = data.recruiting === "partner";
    await sendCustomerConfirmation({
      to: data.email,
      subject: isPartner
        ? "[GLOCARE] Đã nhận đề nghị hợp tác / 제휴 문의가 접수되었습니다"
        : "[GLOCARE] Đã nhận đăng ký tư vấn / 상담 신청이 접수되었습니다",
      html: confirmationEmail({
        name: data.name,
        kind: isPartner ? "partner" : "consultation",
      }),
    });
  }

  return { ok: true };
}

/**
 * 접수 확인 이메일 템플릿 (한·베 병기, 발신 전용 안내 포함).
 */
function confirmationEmail({
  name,
  kind,
}: {
  name: string;
  kind: "consultation" | "partner";
}): string {
  const safeName = escape(name);
  const ko = {
    consultation: {
      lead: "상담 신청이 정상 접수되었습니다.",
      reply: "담당자가 확인 후 <strong>5 영업일 이내</strong>에 회신드리겠습니다.",
    },
    partner: {
      lead: "제휴 문의가 정상 접수되었습니다.",
      reply: "담당자가 확인 후 <strong>5 영업일 이내</strong>에 회신드리겠습니다.",
    },
  }[kind];
  const vi = {
    consultation: {
      lead: "Đăng ký tư vấn của bạn đã được tiếp nhận.",
      reply:
        "Nhân viên phụ trách sẽ liên hệ bạn trong vòng <strong>5 ngày làm việc</strong>.",
    },
    partner: {
      lead: "Đề nghị hợp tác của bạn đã được tiếp nhận.",
      reply:
        "Nhân viên phụ trách sẽ liên hệ bạn trong vòng <strong>5 ngày làm việc</strong>.",
    },
  }[kind];

  return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1c1c1e;line-height:1.6">

  <div style="font-family:'Noto Serif KR',serif;font-size:1.4rem;font-weight:900;color:#F25C5C;letter-spacing:-0.5px;margin-bottom:24px">
    GLOCARE
  </div>

  <h2 style="font-size:18px;font-weight:700;margin:0 0 16px">
    안녕하세요 ${safeName}님 / Xin chào ${safeName},
  </h2>

  <div style="background:#FFF7F5;border:1px solid #FFE0E0;border-radius:10px;padding:16px 20px;margin-bottom:20px">
    <p style="margin:0 0 8px;font-weight:700;color:#1c1c1e">${ko.lead}</p>
    <p style="margin:0;color:#3a3a3c;font-size:14px">${ko.reply}</p>
  </div>

  <div style="background:#FFF7F5;border:1px solid #FFE0E0;border-radius:10px;padding:16px 20px;margin-bottom:24px">
    <p style="margin:0 0 8px;font-weight:700;color:#1c1c1e">${vi.lead}</p>
    <p style="margin:0;color:#3a3a3c;font-size:14px">${vi.reply}</p>
  </div>

  <hr style="border:none;border-top:1px solid #f0eded;margin:24px 0">

  <p style="color:#aeaeb2;font-size:12px;line-height:1.6;margin:0 0 8px">
    이 메일은 발신 전용입니다. 답장은 처리되지 않습니다.<br>
    Đây là email tự động — vui lòng không trả lời.
  </p>

  <p style="color:#6e6e73;font-size:12px;margin:16px 0 0">
    <strong>GLOCARE</strong> · help@glocare.co.kr<br>
    <a href="https://youstudyinkorea.com" style="color:#F25C5C;text-decoration:none">youstudyinkorea.com</a>
  </p>

</div>
  `.trim();
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
