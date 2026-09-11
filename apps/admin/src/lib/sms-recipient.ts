/**
 * 교육원 문자 발송 수신 번호 결정.
 *
 * training_centers.sms_recipient 로 운영자가 명시적으로 선택한 번호를 우선 사용.
 * 선택이 없거나(null) 선택된 칸이 비어있으면 null 을 반환하고,
 * 호출부가 각 흐름의 기존 fallback 로직을 그대로 적용한다.
 *   - 신규 교육생 알림: phone(대표)
 *   - 정산 내역 발송: director_phone → phone
 */

export type SmsRecipientSource = "phone" | "director" | "contact";

export const SMS_RECIPIENT_LABEL: Record<SmsRecipientSource, string> = {
  phone: "대표 연락처",
  director: "대표자 연락처",
  contact: "담당자 연락처",
};

export function pickCenterSmsPhone(center: {
  phone?: string | null;
  director_phone?: string | null;
  contact_phone?: string | null;
  sms_recipient?: string | null;
}): { phone: string; source: SmsRecipientSource } | null {
  const choice = center.sms_recipient;
  if (choice !== "phone" && choice !== "director" && choice !== "contact") {
    return null;
  }
  const value =
    choice === "director"
      ? center.director_phone
      : choice === "contact"
        ? center.contact_phone
        : center.phone;
  const phone = value?.trim() ?? "";
  if (!phone) return null;
  return { phone, source: choice };
}
