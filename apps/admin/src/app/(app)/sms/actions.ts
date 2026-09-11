"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  buildNewStudentMessage,
  pickClassInquiryMessage,
} from "@/lib/sms-templates";
import { pickCenterSmsPhone } from "@/lib/sms-recipient";

export type SmsActionResult =
  | { ok: true; warning?: string }
  | { ok: false; error: string };

// =============================================================================
// NHN Cloud MMS 호출 래퍼 — 환경변수 체크 + 실제 전송
// 이 계정은 /sender/lms 가 비활성이고 /sender/mms 가 장문(2000byte) 역할을 대신함.
// 상세: memory/nhn_sms_debug.md 참고
// =============================================================================

async function sendNhnLms(params: {
  phone: string;
  title: string;
  body: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const appKey = process.env.NHN_SMS_APP_KEY;
  const secretKey = process.env.NHN_SMS_SECRET_KEY;
  const sendNo = process.env.NHN_SMS_SEND_NO;
  const baseUrl = (
    process.env.NHN_SMS_API_URL ?? "https://sms.api.nhncloudservice.com"
  ).replace(/\/+$/, "");

  if (!appKey || !secretKey || !sendNo) {
    return {
      ok: false,
      error:
        "NHN Cloud SMS 환경변수가 설정되지 않았습니다 (NHN_SMS_APP_KEY / NHN_SMS_SECRET_KEY / NHN_SMS_SEND_NO).",
    };
  }

  const recipientNo = params.phone.replace(/[^0-9]/g, "");
  if (!/^01\d{7,9}$/.test(recipientNo) && !/^0\d{7,9}$/.test(recipientNo)) {
    return { ok: false, error: "유효한 전화번호 형식이 아닙니다." };
  }

  // MMS 는 본문 2000 byte 제한 (한글 UTF-8 기준 약 666자).
  const bodyBytes = new TextEncoder().encode(params.body).length;
  if (bodyBytes > 2000) {
    return {
      ok: false,
      error: `메시지 본문이 ${bodyBytes} byte 로 MMS 최대 2000 byte 를 초과합니다. (${params.body.length}자)`,
    };
  }

  const url = `${baseUrl}/sms/v3.0/appKeys/${encodeURIComponent(appKey)}/sender/mms`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Secret-Key": secretKey,
    },
    body: JSON.stringify({
      title: params.title.slice(0, 40),
      body: params.body,
      sendNo: sendNo.replace(/[^0-9]/g, ""),
      recipientList: [{ recipientNo, countryCode: "82" }],
    }),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.header?.isSuccessful) {
    return {
      ok: false,
      error: json?.header?.resultMessage ?? `HTTP ${res.status}`,
    };
  }
  return { ok: true };
}

// =============================================================================
// 발송 셀프 알림 — 운영자 본인 번호로 "언제/누구에게/무슨 문자" 짧은 노티
// =============================================================================

/**
 * 시스템 문자 발송 성공 직후 운영자에게 보내는 확인 노티.
 * 수신 번호: NHN_SMS_NOTIFY_NO (없으면 발신번호 NHN_SMS_SEND_NO = 본인 번호).
 * 짧은 본문이라 SMS(단문) 엔드포인트를 쓰고, 실패해도 원 발송 결과에는
 * 영향을 주지 않는다 (best-effort).
 */
async function sendSelfNotifySms(params: {
  targetName: string;
  recipientPhone: string;
  kindLabel: string;
}): Promise<void> {
  await sendSelfNotifyRaw([
    params.targetName,
    params.recipientPhone,
    params.kindLabel,
  ]);
}

async function sendSelfNotifyRaw(lines: string[]): Promise<void> {
  const appKey = process.env.NHN_SMS_APP_KEY;
  const secretKey = process.env.NHN_SMS_SECRET_KEY;
  const sendNo = process.env.NHN_SMS_SEND_NO;
  const notifyNo = (process.env.NHN_SMS_NOTIFY_NO ?? sendNo ?? "").replace(
    /[^0-9]/g,
    ""
  );
  if (!appKey || !secretKey || !sendNo || !notifyNo) return;

  // KST 기준 "YYYY-MM-DD HH:mm"
  const sentAt = new Date()
    .toLocaleString("sv-SE", { timeZone: "Asia/Seoul" })
    .slice(0, 16);

  const body = ["[알림]", sentAt, ...lines].join("\n");

  const baseUrl = (
    process.env.NHN_SMS_API_URL ?? "https://sms.api.nhncloudservice.com"
  ).replace(/\/+$/, "");

  try {
    // 단문(SMS) 시도 — 90 byte(EUC-KR) 초과 등으로 실패하면 MMS 로 재시도
    const res = await fetch(
      `${baseUrl}/sms/v3.0/appKeys/${encodeURIComponent(appKey)}/sender/sms`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Secret-Key": secretKey,
        },
        body: JSON.stringify({
          body,
          sendNo: sendNo.replace(/[^0-9]/g, ""),
          recipientList: [{ recipientNo: notifyNo, countryCode: "82" }],
        }),
      }
    );
    const json = await res.json().catch(() => null);
    if (res.ok && json?.header?.isSuccessful) return;

    await sendNhnLms({ phone: notifyNo, title: "[알림]", body });
  } catch {
    // 노티 실패는 무시 — 원 발송이 성공했으면 그걸로 충분
  }
}

// =============================================================================
// 신규 교육생 알림
// =============================================================================

export async function sendNewStudentSms(input: {
  centerId: string;
  customerIds: string[];
  /**
   * 운영자가 미리보기 모달에서 직접 편집한 본문.
   * 비어있으면 서버에서 템플릿으로 재생성한다.
   */
  bodyOverride?: string;
  /**
   * 운영자가 미리보기 모달에서 직접 편집한 수신 전화번호.
   * 비어있으면 교육원 대표 연락처로 발송한다.
   */
  phoneOverride?: string;
}): Promise<SmsActionResult> {
  if (input.customerIds.length === 0) {
    return { ok: false, error: "교육생을 선택해주세요." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  // 교육원
  const { data: center, error: centerError } = await supabase
    .from("training_centers")
    .select("id, name, phone, director_phone, contact_phone, sms_recipient")
    .eq("id", input.centerId)
    .single();
  if (centerError || !center) {
    return { ok: false, error: "교육원을 찾을 수 없습니다." };
  }

  // 수신 전화번호 — phoneOverride 우선 → 교육원의 문자 발송 선택 번호
  // (sms_recipient) → 기존 로직(대표 연락처)
  const selected = pickCenterSmsPhone(center);
  const recipientPhone = (
    input.phoneOverride ??
    selected?.phone ??
    center.phone ??
    ""
  ).trim();
  if (!recipientPhone) {
    return {
      ok: false,
      error:
        "수신 전화번호가 비어있습니다. 미리보기 모달에서 직접 입력하거나 교육원 대표 연락처를 등록하세요.",
    };
  }

  // 교육생 로드 (이력 기록 + fallback 템플릿용)
  const { data: students } = await supabase
    .from("customers")
    .select(
      "id, code, name_kr, name_vi, phone, visa_type, birth_year, topik_level, class_start_date, training_class_id"
    )
    .in("id", input.customerIds);

  if (!students || students.length === 0) {
    return { ok: false, error: "교육생 정보를 불러오지 못했습니다." };
  }

  let body = input.bodyOverride?.trim();

  // 본문 override 가 없으면 서버에서 템플릿으로 재생성 (학생별 특이사항은 빈 값)
  if (!body) {
    // 학생별 class 정보 + 예약금 조회
    const classIds = Array.from(
      new Set(students.map((s) => s.training_class_id).filter((v): v is string => !!v))
    );
    const classMap = new Map<
      string,
      { start_date: string | null; class_type: "weekday" | "night" }
    >();
    if (classIds.length > 0) {
      const { data: classes } = await supabase
        .from("training_classes")
        .select("id, start_date, class_type")
        .in("id", classIds);
      for (const c of classes ?? []) {
        classMap.set(c.id, { start_date: c.start_date, class_type: c.class_type });
      }
    }
    const { data: reservations } = await supabase
      .from("reservation_payments")
      .select("customer_id, amount")
      .in("customer_id", input.customerIds);
    const reservationSum = new Map<string, number>();
    for (const r of reservations ?? []) {
      reservationSum.set(
        r.customer_id,
        (reservationSum.get(r.customer_id) ?? 0) + (Number(r.amount) || 0)
      );
    }

    // 제목 월 — 가장 빠른 class 시작일
    const startDates = students
      .map((s) => {
        const cls = s.training_class_id ? classMap.get(s.training_class_id) : null;
        return cls?.start_date ?? s.class_start_date ?? null;
      })
      .filter((d): d is string => !!d);
    const earliest = startDates.slice().sort()[0];
    let monthLabel: number | null = null;
    if (earliest) {
      const m = /^\d{4}-(\d{2})-\d{2}$/.exec(earliest);
      if (m) monthLabel = Number(m[1]);
    }

    body = buildNewStudentMessage({
      centerName: center.name,
      monthLabel,
      students: students.map((s) => {
        const cls = s.training_class_id ? classMap.get(s.training_class_id) : null;
        return {
          name_kr: s.name_kr,
          name_vi: s.name_vi,
          phone: s.phone,
          visa_type: s.visa_type,
          birth_year: s.birth_year,
          topik_level: s.topik_level,
          reservationAmount: reservationSum.get(s.id) ?? null,
          classStartDate: cls?.start_date ?? s.class_start_date ?? null,
          classType: cls?.class_type ?? null,
        };
      }),
    });
  }

  if (!body) {
    return { ok: false, error: "본문이 비어있습니다." };
  }

  // 제목 — 가장 빠른 class 시작 월 기준
  const titleMonth = (() => {
    const m = /\[(\d+)월/.exec(body);
    return m ? Number(m[1]) : null;
  })();
  const smsTitle = titleMonth
    ? `[글로케어] ${titleMonth}월 신규교육생`
    : "[글로케어 신규교육생]";

  // NHN 호출 (1회)
  const send = await sendNhnLms({
    phone: recipientPhone,
    title: smsTitle,
    body,
  });
  if (!send.ok) return { ok: false, error: `발송 실패: ${send.error}` };

  await sendSelfNotifySms({
    targetName: center.name,
    recipientPhone,
    kindLabel: "신규 교육생 안내 문자",
  });

  // 이력 기록 — 각 학생별로 1 row + center 전체 1 row
  const rows = [
    {
      message_type: "new_student",
      target_center_id: center.id,
      target_customer_id: null,
      content: body,
      sent_by: user.id,
    },
    ...students.map((s) => ({
      message_type: "new_student",
      target_center_id: center.id,
      target_customer_id: s.id,
      content: body,
      sent_by: user.id,
    })),
  ];

  const { error: insertError } = await supabase.from("sms_messages").insert(rows);
  if (insertError) {
    return {
      ok: true,
      warning: `SMS 발송 완료. 이력 저장 중 오류: ${insertError.message}`,
    };
  }

  revalidatePath("/sms");
  revalidatePath("/sms/new-student");
  return { ok: true };
}

// =============================================================================
// 강의 정보 문의 (교육원에 이번 달/다음 달 개강 일정 확인 요청)
// =============================================================================

export async function sendClassInquirySms(input: {
  centerId: string;
  /** 미리보기에서 편집한 본문. 없으면 서버에서 랜덤 템플릿 선택. */
  bodyOverride?: string;
  /** 미리보기에서 편집한 수신 번호. 없으면 교육원 선택 번호 → 대표 연락처. */
  phoneOverride?: string;
  /** false 면 건별 셀프 알림 생략 — 일괄 발송에서 요약 1건으로 대체. */
  selfNotify?: boolean;
}): Promise<SmsActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const { data: center, error: centerError } = await supabase
    .from("training_centers")
    .select("id, name, phone, director_phone, contact_phone, sms_recipient")
    .eq("id", input.centerId)
    .single();
  if (centerError || !center) {
    return { ok: false, error: "교육원을 찾을 수 없습니다." };
  }

  const selected = pickCenterSmsPhone(center);
  const recipientPhone = (
    input.phoneOverride ??
    selected?.phone ??
    center.phone ??
    ""
  ).trim();
  if (!recipientPhone) {
    return {
      ok: false,
      error:
        "수신 전화번호가 비어있습니다. 교육원 정보에서 문자 발송 번호를 선택하거나 직접 입력하세요.",
    };
  }

  const body = input.bodyOverride?.trim() || pickClassInquiryMessage();

  const send = await sendNhnLms({
    phone: recipientPhone,
    title: "[글로케어] 강의 일정 문의",
    body,
  });
  if (!send.ok) return { ok: false, error: `발송 실패: ${send.error}` };

  if (input.selfNotify !== false) {
    await sendSelfNotifySms({
      targetName: center.name,
      recipientPhone,
      kindLabel: "강의 정보 문의 문자",
    });
  }

  const { error: insertError } = await supabase.from("sms_messages").insert({
    message_type: "class_inquiry",
    target_center_id: center.id,
    target_customer_id: null,
    content: body,
    sent_by: user.id,
  });
  if (insertError) {
    return {
      ok: true,
      warning: `SMS 발송 완료. 이력 저장 중 오류: ${insertError.message}`,
    };
  }

  revalidatePath("/sms");
  revalidatePath("/sms/new-student");
  return { ok: true };
}

/** 강의 문의 일괄 발송 완료 후 — 요약 셀프 알림 1건 */
export async function notifyClassInquiryBulkDone(input: {
  total: number;
  failed: number;
}): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await sendSelfNotifyRaw([
    "강의 정보 문의 일괄 발송",
    `성공 ${input.total - input.failed}건 / 실패 ${input.failed}건`,
  ]);
}

// =============================================================================
// 정산 내역 발송
// =============================================================================

export async function sendCommissionSms(input: {
  centerId: string;
  recipientPhone: string;
  body: string;
  /** sms_messages 이력 매칭용 (각 customer 에 대해서도 row 생성). */
  customerIds?: string[];
}): Promise<SmsActionResult> {
  const phone = input.recipientPhone.trim();
  if (!phone) {
    return {
      ok: false,
      error: "수신자 전화번호가 비어있습니다. 교육원 정보에 대표자 연락처를 등록하거나 발송 모달에서 직접 입력하세요.",
    };
  }
  if (!input.body?.trim()) {
    return { ok: false, error: "본문이 비어있습니다." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const send = await sendNhnLms({
    phone,
    title: "[글로케어 정산 안내]",
    body: input.body,
  });
  if (!send.ok) return { ok: false, error: `발송 실패: ${send.error}` };

  {
    const { data: notifyCenter } = await supabase
      .from("training_centers")
      .select("name")
      .eq("id", input.centerId)
      .maybeSingle();
    await sendSelfNotifySms({
      targetName: notifyCenter?.name ?? "교육원",
      recipientPhone: phone,
      kindLabel: "정산 내역 문자",
    });
  }

  // 이력 — center 단위 1 row 만. (실제 NHN 발송도 1회 — 각 customer 별로
  // row 만들면 이력 화면이 부풀려져 보이고, target_center_id 가 있으면 화면에
  // '교육원: …' 으로만 표시되어 customer 정보 안 보임 — 의미 낮음.)
  const { error: insertError } = await supabase.from("sms_messages").insert({
    message_type: "commission_settlement",
    target_center_id: input.centerId,
    target_customer_id: null,
    content: input.body,
    sent_by: user.id,
  });
  if (insertError) {
    return {
      ok: true,
      warning: `SMS 발송 완료. 이력 저장 중 오류: ${insertError.message}`,
    };
  }

  revalidatePath("/sms");
  revalidatePath("/sms/commission");
  return { ok: true };
}

