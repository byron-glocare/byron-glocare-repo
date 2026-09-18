import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import { CLASS_INQUIRY_MESSAGES } from "./sms-templates";

/** system_settings 에 강의 정보 문의 랜덤 문구를 저장하는 key */
export const CLASS_INQUIRY_MESSAGES_KEY = "class_inquiry_messages";

/**
 * 운영자가 편집한 강의 정보 문의 문구 목록을 읽는다.
 * system_settings 에 값이 없거나 유효한 문자열이 하나도 없으면
 * 기본 5종(CLASS_INQUIRY_MESSAGES)을 반환한다 — 그래서 미설정 상태에서도
 * 발송이 끊기지 않는다.
 */
export async function loadClassInquiryMessages(
  supabase: SupabaseClient<Database>
): Promise<string[]> {
  const { data } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", CLASS_INQUIRY_MESSAGES_KEY)
    .maybeSingle();

  const v = data?.value;
  if (Array.isArray(v)) {
    const arr = v.filter(
      (x): x is string => typeof x === "string" && x.trim() !== ""
    );
    if (arr.length > 0) return arr;
  }
  return CLASS_INQUIRY_MESSAGES;
}
