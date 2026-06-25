"use server";

import { revalidatePath } from "next/cache";
import mammoth from "mammoth";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isGlocareAdmin } from "@/lib/admin-guard";
import { tokenizeAndFillDocx } from "@/lib/docx/fill";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** 표준데이터 key → 미리보기용 더미값 */
function sampleForKey(key: string): string {
  const k = key.toLowerCase();
  if (/name_en|full_name_en/.test(k)) return "TRAN THI HUONG";
  if (/name|이름|성명/.test(k)) return "쩐 티 흐엉";
  if (/dob|birth/.test(k)) return "2004-07-12";
  if (/email/.test(k)) return "huong@example.com";
  if (/phone|contact|연락/.test(k)) return "+84 90 1234 5678";
  if (/address|주소/.test(k)) return "Hà Nội, Việt Nam";
  if (/passport/.test(k)) return "C45678901";
  if (/nationality|국적/.test(k)) return "베트남";
  if (/registration|등록번호/.test(k)) return "040712-5XXXXXX";
  if (/bank|account|계좌/.test(k)) return "123-456-7890";
  if (/holder|예금주/.test(k)) return "쩐 티 흐엉";
  if (/major|dept|학과|전공/.test(k)) return "간호학과";
  if (/visa/.test(k)) return "D-2";
  if (/topik/.test(k)) return "4급";
  return key;
}

/**
 * docx 작성서류 양식의 라벨 매핑 저장.
 *   mapping: { 정규화라벨: std_key }  (값 "" = 채우지 않음)
 */
export async function saveDocxMappingAction(
  formFileId: string,
  mapping: Record<string, string>
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isGlocareAdmin(user))
    return { ok: false, error: "권한이 없습니다." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("study_admission_form_files")
    .update({ label_mapping: mapping })
    .eq("id", formFileId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admissions/forms/${formFileId}`);
  return { ok: true };
}

/**
 * 현재 매핑으로 더미값을 채운 docx 를 HTML 로 변환해 미리보기 반환.
 *   mapping: { 정규화라벨: std_key }
 */
export async function previewDocxAction(
  formFileId: string,
  mapping: Record<string, string>
): Promise<{ ok: true; html: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isGlocareAdmin(user))
    return { ok: false, error: "권한이 없습니다." };

  const admin = createAdminClient();
  const { data: form } = await admin
    .from("study_admission_form_files")
    .select("file_url")
    .eq("id", formFileId)
    .maybeSingle();
  if (!form) return { ok: false, error: "양식을 찾을 수 없습니다." };

  let buf: Buffer;
  try {
    const r = await fetch(form.file_url);
    if (!r.ok) throw new Error(`원본 다운로드 실패 (${r.status})`);
    buf = Buffer.from(await r.arrayBuffer());
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "다운로드 실패" };
  }

  try {
    const filled = tokenizeAndFillDocx(buf, (n) => {
      const key = mapping[n];
      if (!key) return null;
      return { dummy: sampleForKey(key) };
    }).filled;
    const { value: html } = await mammoth.convertToHtml({ buffer: filled });
    return { ok: true, html };
  } catch (e) {
    return {
      ok: false,
      error: `미리보기 생성 실패: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}
