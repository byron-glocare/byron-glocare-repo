/**
 * Resend 이메일 발송 헬퍼.
 * RESEND_API_KEY / RESEND_FROM_EMAIL / RESEND_NOTIFY_EMAIL 환경변수 필요.
 *
 * 폼 제출 시 2통 발송:
 *  (a) 운영자 알림 (RESEND_NOTIFY_EMAIL 로)
 *  (b) 고객 confirmation (고객이 입력한 이메일로)
 */

import { Resend } from "resend";

let _resend: Resend | null = null;

function client(): Resend | null {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  _resend = new Resend(key);
  return _resend;
}

const FROM = process.env.RESEND_FROM_EMAIL ?? "help@glocare.co.kr";
const NOTIFY = process.env.RESEND_NOTIFY_EMAIL ?? "kajkaj202@gmail.com";

export async function sendOperatorNotification(input: {
  subject: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
  const c = client();
  if (!c) {
    console.warn("[email] RESEND_API_KEY 없음 — 운영자 알림 스킵");
    return { ok: true };
  }
  try {
    await c.emails.send({
      from: `Glocare <${FROM}>`,
      to: NOTIFY,
      subject: input.subject,
      html: input.html,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "send failed" };
  }
}

export async function sendCustomerConfirmation(input: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
  const c = client();
  if (!c) return { ok: true };
  try {
    await c.emails.send({
      from: `Glocare <${FROM}>`,
      to: input.to,
      subject: input.subject,
      html: input.html,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "send failed" };
  }
}
