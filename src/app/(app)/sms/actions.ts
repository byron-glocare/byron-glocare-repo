"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  buildNewStudentMessage,
  buildCommissionSettlementMessage,
} from "@/lib/sms-templates";

export type SmsActionResult =
  | { ok: true; warning?: string }
  | { ok: false; error: string };

// =============================================================================
// NHN Cloud LMS 호출 래퍼 — 환경변수 체크 + 실제 전송
// =============================================================================

async function sendNhnLms(params: {
  phone: string;
  title: string;
  body: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const appKey = process.env.NHN_SMS_APP_KEY;
  const secretKey = process.env.NHN_SMS_SECRET_KEY;
  const sendNo = process.env.NHN_SMS_SEND_NO;

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

  const url = `https://api-sms.cloud.toast.com/sms/v3.0/appKeys/${encodeURIComponent(appKey)}/sender/lms`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Secret-Key": secretKey,
    },
    body: JSON.stringify({
      title: params.title.slice(0, 40),
      body: params.body.slice(0, 2000),
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
// 신규 교육생 알림
// =============================================================================

export async function sendNewStudentSms(input: {
  centerId: string;
  customerIds: string[];
  extraNote?: string;
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
    .select("id, name, phone")
    .eq("id", input.centerId)
    .single();
  if (centerError || !center) {
    return { ok: false, error: "교육원을 찾을 수 없습니다." };
  }
  if (!center.phone) {
    return {
      ok: false,
      error: "교육원에 전화번호가 등록되지 않았습니다. 교육원 상세에서 입력하세요.",
    };
  }

  // 교육생 로드
  const { data: students } = await supabase
    .from("customers")
    .select(
      "id, code, name_kr, name_vi, phone, visa_type, birth_year, class_start_date, training_class_id"
    )
    .in("id", input.customerIds);

  if (!students || students.length === 0) {
    return { ok: false, error: "교육생 정보를 불러오지 못했습니다." };
  }

  // 대표 class 정보 (가장 많이 등장하는 class_id)
  const classIdCounts = new Map<string, number>();
  for (const s of students) {
    if (s.training_class_id) {
      classIdCounts.set(
        s.training_class_id,
        (classIdCounts.get(s.training_class_id) ?? 0) + 1
      );
    }
  }
  let topClassId: string | null = null;
  let topCount = 0;
  for (const [id, c] of classIdCounts) {
    if (c > topCount) {
      topClassId = id;
      topCount = c;
    }
  }

  let classStartDate: string | null = students[0]?.class_start_date ?? null;
  let classType: "weekday" | "night" | null = null;
  if (topClassId) {
    const { data: cls } = await supabase
      .from("training_classes")
      .select("start_date, class_type")
      .eq("id", topClassId)
      .maybeSingle();
    if (cls) {
      classStartDate = cls.start_date;
      classType = cls.class_type;
    }
  }

  // 메시지 구성
  const body = buildNewStudentMessage({
    centerName: center.name,
    classStartDate,
    classType,
    students: students.map((s) => ({
      name_kr: s.name_kr,
      name_vi: s.name_vi,
      phone: s.phone,
      visa_type: s.visa_type,
      birth_year: s.birth_year,
    })),
    extraNote: input.extraNote,
  });

  // NHN 호출 (1회)
  const send = await sendNhnLms({
    phone: center.phone,
    title: "[글로케어 신규교육생]",
    body,
  });
  if (!send.ok) return { ok: false, error: `발송 실패: ${send.error}` };

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
// 수수료 정산 알림
// =============================================================================

export async function sendCommissionSettlementSms(input: {
  centerId: string;
  year: number;
  month: number;
  commissionPaymentIds: string[]; // 이번 발송 대상 소개비 id 들
  extraNote?: string;
}): Promise<SmsActionResult> {
  if (input.commissionPaymentIds.length === 0) {
    return { ok: false, error: "정산 대상이 없습니다." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  // 교육원 + 은행
  const { data: center } = await supabase
    .from("training_centers")
    .select("id, name, phone, bank_name, bank_account")
    .eq("id", input.centerId)
    .single();

  if (!center) return { ok: false, error: "교육원을 찾을 수 없습니다." };
  if (!center.phone) {
    return { ok: false, error: "교육원 전화번호가 등록되지 않았습니다." };
  }

  // 정산 대상 소개비
  const { data: commissions } = await supabase
    .from("commission_payments")
    .select("id, customer_id, total_amount, deduction_amount, received_amount")
    .in("id", input.commissionPaymentIds);
  if (!commissions || commissions.length === 0) {
    return { ok: false, error: "소개비 레코드가 없습니다." };
  }

  // 고객 이름
  const customerIds = commissions.map((c) => c.customer_id);
  const { data: customers } = await supabase
    .from("customers")
    .select("id, name_kr, name_vi")
    .in("id", customerIds);
  const nameMap = new Map(
    (customers ?? []).map((c) => [
      c.id,
      c.name_kr || c.name_vi || "(이름 없음)",
    ])
  );

  const items = commissions.map((c) => ({
    customerName: nameMap.get(c.customer_id) ?? "—",
    totalAmount: c.total_amount,
    deductionAmount: c.deduction_amount,
    receivedAmount: c.received_amount ?? c.total_amount - c.deduction_amount,
  }));

  const body = buildCommissionSettlementMessage({
    centerName: center.name,
    bankName: center.bank_name,
    bankAccount: center.bank_account,
    year: input.year,
    month: input.month,
    items,
    extraNote: input.extraNote,
  });

  const send = await sendNhnLms({
    phone: center.phone,
    title: "[글로케어 수수료정산]",
    body,
  });
  if (!send.ok) return { ok: false, error: `발송 실패: ${send.error}` };

  // 이력 기록 + 소개비 status 를 'notified' 로 (이미 completed 면 유지)
  const { error: insertError } = await supabase.from("sms_messages").insert({
    message_type: "commission_settlement",
    target_center_id: center.id,
    target_customer_id: null,
    content: body,
    sent_by: user.id,
  });

  if (insertError) {
    return {
      ok: true,
      warning: `SMS 발송 완료. 이력 저장 오류: ${insertError.message}`,
    };
  }

  // 각 소개비 레코드의 sms_sent_at + status 를 한 번에 갱신 (completed 는 건드리지 않음)
  await supabase
    .from("commission_payments")
    .update({
      sms_sent_at: new Date().toISOString(),
      status: "notified",
    })
    .in(
      "id",
      commissions.map((c) => c.id)
    )
    .neq("status", "completed");

  revalidatePath("/sms");
  revalidatePath("/sms/commission");
  revalidatePath("/settlements");
  return { ok: true };
}
