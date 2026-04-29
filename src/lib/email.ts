/**
 * Resend 이메일 발송 헬퍼.
 * RESEND_API_KEY / RESEND_FROM_EMAIL / RESEND_NOTIFY_EMAIL 환경변수 필요.
 *
 * 폼 제출 시 2통 발송:
 *  (a) 운영자 알림 (RESEND_NOTIFY_EMAIL 로)
 *  (b) 고객 confirmation (고객이 입력한 이메일로)
 *
 * 모든 단계에 console 로그 — Vercel Function Logs 에서 추적 가능.
 */

import { Resend } from "resend";

let _resend: Resend | null = null;

function client(): Resend | null {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.error(
      "[email] RESEND_API_KEY 환경변수 없음. process.env.RESEND_API_KEY=" +
        JSON.stringify(key)
    );
    return null;
  }
  _resend = new Resend(key);
  console.log("[email] Resend client 초기화 완료");
  return _resend;
}

const FROM = process.env.RESEND_FROM_EMAIL ?? "help@glocare.co.kr";
const NOTIFY = process.env.RESEND_NOTIFY_EMAIL ?? "kajkaj202@gmail.com";

export async function sendOperatorNotification(input: {
  subject: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
  console.log(
    `[email] sendOperatorNotification 호출됨 — to=${NOTIFY}, from=${FROM}, subject=${input.subject}`
  );
  const c = client();
  if (!c) {
    console.error("[email] 운영자 알림 스킵 (client null)");
    return { ok: false, error: "RESEND_API_KEY missing" };
  }
  try {
    const result = await c.emails.send({
      from: `Glocare <${FROM}>`,
      to: NOTIFY,
      subject: input.subject,
      html: input.html,
    });
    console.log(
      `[email] 운영자 알림 전송 응답: ${JSON.stringify(result)}`
    );
    if (result.error) {
      console.error(`[email] Resend 운영자 알림 에러: ${JSON.stringify(result.error)}`);
      return { ok: false, error: result.error.message };
    }
    return { ok: true };
  } catch (e) {
    console.error(`[email] 운영자 알림 예외: ${e instanceof Error ? e.message : String(e)}`);
    return { ok: false, error: e instanceof Error ? e.message : "send failed" };
  }
}

export async function sendCustomerConfirmation(input: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
  console.log(
    `[email] sendCustomerConfirmation 호출됨 — to=${input.to}, from=${FROM}, subject=${input.subject}`
  );
  const c = client();
  if (!c) {
    console.error("[email] 고객 confirmation 스킵 (client null)");
    return { ok: false, error: "RESEND_API_KEY missing" };
  }
  try {
    const result = await c.emails.send({
      from: `Glocare <${FROM}>`,
      to: input.to,
      subject: input.subject,
      html: input.html,
    });
    console.log(
      `[email] 고객 confirmation 전송 응답: ${JSON.stringify(result)}`
    );
    if (result.error) {
      console.error(
        `[email] Resend 고객 confirmation 에러: ${JSON.stringify(result.error)}`
      );
      return { ok: false, error: result.error.message };
    }
    return { ok: true };
  } catch (e) {
    console.error(
      `[email] 고객 confirmation 예외: ${e instanceof Error ? e.message : String(e)}`
    );
    return { ok: false, error: e instanceof Error ? e.message : "send failed" };
  }
}
