import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * 매일 CBT 알림톡 — Vercel Cron 에서 호출 (vercel.json).
 *   대상: 교육중(class_start_date ≤ 오늘 ≤ class_end_date) + kakao_consent + phone 보유
 *   발송: NHN Cloud 카카오 알림톡 (기존 발신프로필·템플릿 재사용)
 *
 * ⚠️ 배포 후 동작. NHN_ALIMTALK_* + CRON_SECRET 환경변수 필요.
 *    templateParameter 키는 승인된 템플릿 변수에 맞춰 조정.
 */
export async function GET(request: Request) {
  // 1. 크론 인증 — fail-closed (시크릿 미설정/불일치 모두 차단)
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 2. env
  const appKey = process.env.NHN_ALIMTALK_APPKEY;
  const secretKey = process.env.NHN_ALIMTALK_SECRETKEY;
  const senderKey = process.env.NHN_ALIMTALK_SENDERKEY;
  const templateCode = process.env.NHN_ALIMTALK_TEMPLATE_CODE;
  const apiBase = (
    process.env.NHN_ALIMTALK_API_URL ?? "https://api-alimtalk.cloud.toast.com"
  ).replace(/\/+$/, "");
  if (!appKey || !secretKey || !senderKey || !templateCode) {
    return NextResponse.json({ error: "NHN 알림톡 env 미설정" }, { status: 500 });
  }

  // 3. 대상 조회 (교육중 + 수신동의 + 전화)
  const today = new Date().toISOString().slice(0, 10);
  const admin = createAdminClient();
  const { data: targets, error } = await admin
    .from("customers")
    .select("id, name_kr, name_vi, phone")
    .eq("kakao_consent", true)
    .not("phone", "is", null)
    .lte("class_start_date", today)
    .or(`class_end_date.is.null,class_end_date.gte.${today}`);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!targets || targets.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  // 4. recipientList 구성 (1000개 단위 분할)
  const recipients = targets
    .map((c) => {
      const no = (c.phone ?? "").replace(/[^0-9]/g, "");
      if (!/^01\d{7,9}$/.test(no)) return null;
      return {
        recipientNo: no,
        templateParameter: { name: c.name_vi || c.name_kr || "" },
      };
    })
    .filter(Boolean) as { recipientNo: string; templateParameter: Record<string, string> }[];

  const url = `${apiBase}/alimtalk/v2.3/appkeys/${encodeURIComponent(appKey)}/messages`;
  let sent = 0;
  const errors: string[] = [];

  for (let i = 0; i < recipients.length; i += 1000) {
    const chunk = recipients.slice(i, i + 1000);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Secret-Key": secretKey },
      body: JSON.stringify({ senderKey, templateCode, recipientList: chunk }),
    });
    const json = await res.json().catch(() => null);
    if (res.ok && json?.header?.isSuccessful) {
      sent += chunk.length;
    } else {
      errors.push(json?.header?.resultMessage ?? `HTTP ${res.status}`);
    }
  }

  return NextResponse.json({ ok: errors.length === 0, sent, errors });
}
