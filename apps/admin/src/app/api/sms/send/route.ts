import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/sms/send
 *
 * Body: {
 *   phone: string,                   // 수신번호 (010-XXXX-XXXX 또는 01XXXXXXXXXX)
 *   body: string,                    // 메시지 본문
 *   title?: string,                  // LMS title (기본값: "[글로케어]")
 *   message_type: string,            // 기록용 타입 (new_student / commission_settlement / ...)
 *   target_customer_id?: string | null,
 *   target_center_id?: string | null,
 * }
 *
 * 로직:
 *  1. 인증 사용자 확인
 *  2. NHN_SMS_* 환경변수 존재 확인
 *  3. 전화번호 정규화 (하이픈·공백 제거)
 *  4. MMS 엔드포인트 호출 (장문 2000byte 수용, 이미지 없이도 동작)
 *  5. 성공 시 sms_messages 테이블에 기록
 *
 * NHN Cloud SMS v3.0 MMS 엔드포인트:
 *   POST {NHN_SMS_API_URL}/sms/v3.0/appKeys/{appKey}/sender/mms
 *   Headers: Content-Type: application/json, X-Secret-Key: {secretKey}
 *   Body: { title, body, sendNo, recipientList: [{ recipientNo, countryCode: "82" }] }
 *
 * Base URL 은 Console → Notification > SMS → URL & Appkey 화면에 표시된 값을 사용.
 * 구 Toast 계정: https://api-sms.cloud.toast.com
 * 신 NHN Cloud 계정: https://sms.api.nhncloudservice.com
 *
 * 왜 LMS 대신 MMS?
 *   - 이 계정은 /sender/lms 엔드포인트가 비활성 (-9998 Not found)
 *   - /sender/mms 는 이미지 없이 텍스트만 보내도 정상 동작 → 장문 용도로 사용
 *   - 요금도 LMS/MMS 동일 과금 구간
 */
export async function POST(request: Request) {
  // 1. 인증
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. 환경변수
  const appKey = process.env.NHN_SMS_APP_KEY;
  const secretKey = process.env.NHN_SMS_SECRET_KEY;
  const sendNo = process.env.NHN_SMS_SEND_NO;
  const apiBase = (
    process.env.NHN_SMS_API_URL ?? "https://sms.api.nhncloudservice.com"
  ).replace(/\/+$/, "");
  if (!appKey || !secretKey || !sendNo) {
    return NextResponse.json(
      {
        error:
          "NHN Cloud SMS 환경변수가 설정되지 않았습니다 (NHN_SMS_APP_KEY / NHN_SMS_SECRET_KEY / NHN_SMS_SEND_NO).",
      },
      { status: 500 }
    );
  }

  // 3. 입력 파싱
  let payload: {
    phone?: string;
    body?: string;
    title?: string;
    message_type?: string;
    target_customer_id?: string | null;
    target_center_id?: string | null;
  };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON 형식 오류" }, { status: 400 });
  }

  const rawPhone = payload.phone?.trim();
  const body = payload.body?.trim();
  const title = (payload.title?.trim() || "[글로케어]").slice(0, 40);
  const messageType = payload.message_type?.trim();

  if (!rawPhone || !body || !messageType) {
    return NextResponse.json(
      { error: "phone / body / message_type 은 필수입니다." },
      { status: 400 }
    );
  }
  if (body.length > 2000) {
    return NextResponse.json(
      { error: "본문은 2000자를 초과할 수 없습니다." },
      { status: 400 }
    );
  }

  // 전화번호 정규화
  const recipientNo = rawPhone.replace(/[^0-9]/g, "");
  if (!/^01\d{7,9}$/.test(recipientNo)) {
    return NextResponse.json(
      { error: "유효한 휴대폰 번호가 아닙니다." },
      { status: 400 }
    );
  }

  // 4. NHN Cloud MMS 호출 (장문, 이미지 없이 텍스트만)
  const url = `${apiBase}/sms/v3.0/appKeys/${encodeURIComponent(appKey)}/sender/mms`;
  const nhnResponse = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Secret-Key": secretKey,
    },
    body: JSON.stringify({
      title,
      body,
      sendNo: sendNo.replace(/[^0-9]/g, ""),
      recipientList: [{ recipientNo, countryCode: "82" }],
    }),
  });

  const nhnJson = await nhnResponse.json().catch(() => null);
  if (!nhnResponse.ok || !nhnJson?.header?.isSuccessful) {
    return NextResponse.json(
      {
        error: "SMS 발송 실패",
        details: nhnJson?.header?.resultMessage ?? `HTTP ${nhnResponse.status}`,
      },
      { status: 502 }
    );
  }

  // 5. sms_messages 기록
  const { error: insertError } = await supabase.from("sms_messages").insert({
    message_type: messageType,
    target_customer_id: payload.target_customer_id ?? null,
    target_center_id: payload.target_center_id ?? null,
    content: body,
    sent_by: user.id,
  });

  if (insertError) {
    // 발송은 성공했지만 기록 실패 — 경고로 응답
    return NextResponse.json({
      ok: true,
      warning: `발송 완료되었으나 이력 저장 실패: ${insertError.message}`,
    });
  }

  return NextResponse.json({ ok: true });
}
