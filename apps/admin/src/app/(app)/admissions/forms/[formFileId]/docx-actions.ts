"use server";

import { revalidatePath } from "next/cache";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isGlocareAdmin } from "@/lib/admin-guard";
import {
  tokenizeAndFillDocx,
  injectSlotMarkers,
  normLabel,
  type SlotResolve,
  type SlotInfo,
} from "@/lib/docx/fill";

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

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isGlocareAdmin(user)) return null;
  return user;
}

/** 양식의 라벨→표준데이터 자동매칭 맵(정규화라벨 → key) 로드 */
async function loadCatalogMap(
  admin: ReturnType<typeof createAdminClient>
): Promise<Map<string, string>> {
  const { data: types } = await admin
    .from("study_student_data_types")
    .select("key, label_ko, label_vi, aliases")
    .eq("is_active", true);
  const cat = new Map<string, string>();
  for (const t of types ?? []) {
    const add = (s: string | null | undefined) => {
      if (s && s.trim() && !cat.has(normLabel(s))) cat.set(normLabel(s), t.key);
    };
    add(t.label_ko);
    add(t.label_vi);
    const aliases = Array.isArray(t.aliases) ? (t.aliases as string[]) : [];
    for (const a of aliases) add(a);
  }
  return cat;
}

async function fetchFormBuffer(
  admin: ReturnType<typeof createAdminClient>,
  formFileId: string
): Promise<{ buf: Buffer } | { error: string }> {
  const { data: form } = await admin
    .from("study_admission_form_files")
    .select("file_url")
    .eq("id", formFileId)
    .maybeSingle();
  if (!form) return { error: "양식을 찾을 수 없습니다." };
  try {
    const r = await fetch(form.file_url);
    if (!r.ok) throw new Error(`원본 다운로드 실패 (${r.status})`);
    return { buf: Buffer.from(await r.arrayBuffer()) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "다운로드 실패" };
  }
}

/**
 * 라벨→표준데이터 매핑 저장 (라벨 표 UI 용, 폴백).
 *   mapping: { 정규화라벨: std_key } (값 "" = 채우지 않음)
 */
export async function saveDocxMappingAction(
  formFileId: string,
  mapping: Record<string, string>
): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: "권한이 없습니다." };
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
 * 빈칸(슬롯)→표준데이터 배치 매핑 저장 (미리보기 클릭 배치 UI 용).
 *   mapping: { "빈칸인덱스": std_key } (값 "" = 채우지 않음)
 */
export async function saveSlotMappingAction(
  formFileId: string,
  mapping: Record<string, string>
): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: "권한이 없습니다." };
  const admin = createAdminClient();
  const { error } = await admin
    .from("study_admission_form_files")
    .update({ slot_mapping: mapping })
    .eq("id", formFileId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admissions/forms/${formFileId}`);
  return { ok: true };
}

/**
 * 배치 편집기용 — 모든 빈칸에 슬롯 마커(⟦S0⟧…)를 박은 docx 를 base64 로 반환.
 *   클라이언트가 docx-preview 로 렌더 → 마커를 클릭 가능한 칩으로 치환.
 */
export async function placementDocxAction(
  formFileId: string
): Promise<
  { ok: true; base64: string; slots: SlotInfo[] } | { ok: false; error: string }
> {
  if (!(await requireAdmin())) return { ok: false, error: "권한이 없습니다." };
  const admin = createAdminClient();
  const r = await fetchFormBuffer(admin, formFileId);
  if ("error" in r) return { ok: false, error: r.error };
  try {
    const { buf, slots } = injectSlotMarkers(r.buf);
    return { ok: true, base64: buf.toString("base64"), slots };
  } catch (e) {
    return {
      ok: false,
      error: `배치 편집 준비 실패: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

/**
 * 현재 매핑(슬롯 + 라벨 폴백 + 카탈로그)으로 더미값을 채운 docx 를 base64 로 반환.
 *   slotMapping: 편집 중인(미저장) 슬롯 매핑.
 *   labelOverride: 라벨 표에서 편집 중인(미저장) 라벨 매핑(있으면 DB 값 대신 사용).
 */
export async function previewDocxAction(
  formFileId: string,
  opts: {
    slotMapping?: Record<string, string>;
    labelOverride?: Record<string, string>;
  } = {}
): Promise<{ ok: true; base64: string } | { ok: false; error: string }> {
  if (!(await requireAdmin())) return { ok: false, error: "권한이 없습니다." };
  const admin = createAdminClient();
  const slotMapping = opts.slotMapping ?? {};

  const [{ data: form }, catMap] = await Promise.all([
    admin
      .from("study_admission_form_files")
      .select("file_url, label_mapping")
      .eq("id", formFileId)
      .maybeSingle(),
    loadCatalogMap(admin),
  ]);
  if (!form) return { ok: false, error: "양식을 찾을 수 없습니다." };

  const labelMap =
    opts.labelOverride ??
    (form.label_mapping && typeof form.label_mapping === "object"
      ? (form.label_mapping as Record<string, string>)
      : {});

  let buf: Buffer;
  try {
    const r = await fetch(form.file_url);
    if (!r.ok) throw new Error(`원본 다운로드 실패 (${r.status})`);
    buf = Buffer.from(await r.arrayBuffer());
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "다운로드 실패" };
  }

  const now = new Date();
  const todayStr = `${now.getFullYear()}. ${now.getMonth() + 1}. ${now.getDate()}.`;
  // 미리보기는 텍스트 전용 — 이미지(사진·서명)는 자리 표시만, 날짜는 오늘.
  const sampleFor = (k: string): string => {
    if (k === "__today__") return todayStr;
    if (/photo|사진/i.test(k)) return "[사진]";
    if (/signature|서명|sign/i.test(k)) return "[서명]";
    return sampleForKey(k);
  };
  const resolve: SlotResolve = ({ allIndex, emptyIndex, labelNorm }) => {
    const ak = `a${allIndex}`;
    if (ak in slotMapping) {
      const k = slotMapping[ak];
      if (!k) return null;
      return { value: sampleFor(k), viaLabel: false, overwrite: true };
    }
    if (emptyIndex !== null && String(emptyIndex) in slotMapping) {
      const k = slotMapping[String(emptyIndex)];
      if (!k) return null;
      return { value: sampleFor(k), viaLabel: false, overwrite: false };
    }
    if (labelNorm) {
      let k: string | undefined;
      if (labelNorm in labelMap) {
        k = labelMap[labelNorm];
        if (!k) return null;
      } else {
        k = catMap.get(labelNorm);
      }
      if (k) return { value: sampleFor(k), viaLabel: true, overwrite: false };
    }
    return null;
  };

  try {
    const filled = tokenizeAndFillDocx(buf, resolve).filled;
    return { ok: true, base64: filled.toString("base64") };
  } catch (e) {
    return {
      ok: false,
      error: `미리보기 생성 실패: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}
