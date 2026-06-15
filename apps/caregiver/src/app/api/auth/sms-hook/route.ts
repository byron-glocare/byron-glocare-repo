import crypto from "crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Supabase Auth "Send SMS Hook" 수신 → 기존 NHN Cloud SMS 로 OTP 발송.
 *
 * Supabase 설정: Auth > Hooks > Send SMS hook = 이 URL,
 *   시크릿(v1,whsec_...)을 SEND_SMS_HOOK_SECRET 에 저장.
 *
 * 표준 웹훅(standardwebhooks) 서명 검증:
 *   signedContent = `${webhook-id}.${webhook-timestamp}.${rawBody}`
 *   expected = base64(HMAC_SHA256(base64decode(secret), signedContent))
 *
 * 페이로드: { user: { phone }, sms: { otp } }
 *
 * ⚠️ 로컬에서는 Supabase(클라우드)가 이 URL 에 닿지 못함 → 배포 후 동작.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();

  // 1. 서명 검증
  const secretRaw = process.env.SEND_SMS_HOOK_SECRET;
  if (!secretRaw) {
    return NextResponse.json({ error: "hook secret 미설정" }, { status: 500 });
  }
  const id = request.headers.get("webhook-id") ?? "";
  const timestamp = request.headers.get("webhook-timestamp") ?? "";
  const sigHeader = request.headers.get("webhook-signature") ?? "";

  const base64Secret = secretRaw.replace(/^v1,/, "").replace(/^whsec_/, "");
  const secretBytes = Buffer.from(base64Secret, "base64");
  const signedContent = `${id}.${timestamp}.${rawBody}`;
  const expected = crypto
    .createHmac("sha256", secretBytes)
    .update(signedContent)
    .digest("base64");

  // 헤더는 "v1,<sig> v2,<sig> ..." 형태 — 하나라도 일치하면 통과
  const ok = sigHeader
    .split(" ")
    .map((p) => p.split(",")[1])
    .filter(Boolean)
    .some((s) => {
      try {
        return crypto.timingSafeEqual(
          Buffer.from(s),
          Buffer.from(expected)
        );
      } catch {
        return false;
      }
    });
  if (!ok) {
    return NextResponse.json({ error: "서명 불일치" }, { status: 401 });
  }

  // 2. 페이로드 파싱
  let payload: { user?: { phone?: string }; sms?: { otp?: string } };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "JSON 오류" }, { status: 400 });
  }
  const phone = payload.user?.phone;
  const otp = payload.sms?.otp;
  if (!phone || !otp) {
    return NextResponse.json({ error: "phone/otp 누락" }, { status: 400 });
  }

  // 3. NHN 발송 (E.164 +8210... → 국내 010...)
  const appKey = process.env.NHN_SMS_APP_KEY;
  const secretKey = process.env.NHN_SMS_SECRET_KEY;
  const sendNo = process.env.NHN_SMS_SEND_NO;
  const apiBase = (
    process.env.NHN_SMS_API_URL ?? "https://sms.api.nhncloudservice.com"
  ).replace(/\/+$/, "");
  if (!appKey || !secretKey || !sendNo) {
    return NextResponse.json({ error: "NHN 환경변수 미설정" }, { status: 500 });
  }

  let recipientNo = phone.replace(/[^0-9]/g, "");
  if (recipientNo.startsWith("82")) recipientNo = "0" + recipientNo.slice(2);

  const url = `${apiBase}/sms/v3.0/appKeys/${encodeURIComponent(appKey)}/sender/sms`;
  const nhnRes = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Secret-Key": secretKey },
    body: JSON.stringify({
      body: `[글로케어] 인증번호 [${otp}] 를 입력해주세요.`,
      sendNo: sendNo.replace(/[^0-9]/g, ""),
      recipientList: [{ recipientNo, countryCode: "82" }],
    }),
  });
  const nhnJson = await nhnRes.json().catch(() => null);
  if (!nhnRes.ok || !nhnJson?.header?.isSuccessful) {
    return NextResponse.json(
      { error: nhnJson?.header?.resultMessage ?? `HTTP ${nhnRes.status}` },
      { status: 502 }
    );
  }

  return NextResponse.json({}, { status: 200 });
}
