"use server";

import { verifyCenterSession } from "@/lib/center/dal";
import { createCenterClient } from "@/lib/supabase/center";
import {
  createServiceClient,
  STUDENT_FILES_BUCKET,
} from "@/lib/supabase/service";
import {
  resolveDataAccess,
  requireAnyAuth,
} from "@/lib/student/data-access";
import type { Json } from "@/types/database";

const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20MB

export type SaveDataValueResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * 학생의 표준 데이터 단일 항목 upsert.
 *   - RLS 가 본인 org 학생만 허용
 *   - value 가 null → 해당 row 삭제 (입력 취소)
 *   - value       = 최종 사용값(문서 채움 등 모든 소비처가 읽는 값)
 *   - valueInput  = 유학센터가 입력한 원문(번역 전). 넘기면 함께 저장, 없으면 건드리지 않음.
 */
export async function saveStudentDataValueAction(input: {
  studentId: string;
  dataTypeKey: string;
  value: Json | null;
  /** 입력 원문. undefined = 변경 안 함, null = 원문 지움(= value 와 동일 취급) */
  valueInput?: Json | null;
}): Promise<SaveDataValueResult> {
  const access = await resolveDataAccess(input.studentId);
  const supabase = access.supabase;

  if (input.value === null || input.value === undefined || input.value === "") {
    // 삭제
    const { error } = await supabase
      .from("study_student_data_values")
      .delete()
      .eq("student_id", input.studentId)
      .eq("data_type_key", input.dataTypeKey);
    if (error) return { ok: false, error: error.message };
  } else {
    // upsert
    const row: {
      student_id: string;
      data_type_key: string;
      value: Json;
      filled_by: string | null;
      value_input?: Json | null;
    } = {
      student_id: input.studentId,
      data_type_key: input.dataTypeKey,
      value: input.value,
      filled_by: access.authUserId,
    };
    if (input.valueInput !== undefined) row.value_input = input.valueInput;
    const { error } = await supabase
      .from("study_student_data_values")
      .upsert(row, { onConflict: "student_id,data_type_key" });
    if (error) return { ok: false, error: error.message };
  }

  access.revalidateData(input.studentId);
  return { ok: true };
}

export type TranslateResult =
  | { ok: true; text: string; translated: boolean }
  | { ok: false; error: string };

/**
 * 입력값(베트남어 등) → 최종 사용값 번역. 저장은 하지 않고 번역 결과만 반환.
 *   호출측이 결과를 최종값으로 확정(수정 가능)한 뒤 saveStudentDataValueAction 으로 저장.
 */
export async function translateStudentValueAction(input: {
  label: string;
  text: string;
  /** ko(기본)=한국어, en=영문 표기(학교·기관명 등) */
  target?: "ko" | "en";
}): Promise<TranslateResult> {
  await requireAnyAuth();
  const { translateStudentValue } = await import(
    "@/lib/center/translate-value"
  );
  return translateStudentValue({
    label: input.label,
    text: input.text,
    target: input.target ?? "ko",
  });
}

export type CreateFillLinkResult =
  | { ok: true; token: string; expiresAt: string }
  | { ok: false; error: string };

/**
 * 정보 입력 공개 링크 생성 (유효기간 토큰).
 *   - 본인 org 학생만 (RLS WITH CHECK)
 *   - days: 1~90, 기본 7일
 */
export async function createFillLinkAction(input: {
  studentId: string;
  days?: number;
}): Promise<CreateFillLinkResult> {
  const session = await verifyCenterSession();
  const supabase = await createCenterClient();

  const { data: student } = await supabase
    .from("study_managed_students")
    .select("id")
    .eq("id", input.studentId)
    .maybeSingle();
  if (!student) return { ok: false, error: "권한이 없습니다." };

  const days = Math.min(Math.max(Math.round(input.days ?? 7), 1), 90);
  const expiresAt = new Date(Date.now() + days * 86400000).toISOString();

  const { data, error } = await supabase
    .from("study_student_fill_links")
    .insert({
      student_id: input.studentId,
      expires_at: expiresAt,
      created_by: session.authUserId,
    })
    .select("token, expires_at")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, token: data.token, expiresAt: data.expires_at };
}

export type UploadFileResult =
  | { ok: true; value: { path: string; file_name: string } }
  | { ok: false; error: string };

/**
 * 학생 첨부파일 업로드.
 *   1. 세션 + 이 학생이 본인 org 소속인지 검증 (RLS 클라이언트가 막아줌)
 *   2. service-role 로 비공개 버킷에 업로드 (경로 = org/student/key/타임스탬프-파일명)
 *   3. { path, file_name } 반환 → 호출측이 saveStudentDataValueAction 으로 값 저장
 *      (값 저장은 기존 흐름 재사용. 여기선 파일만 다룬다.)
 */
export async function uploadStudentFileAction(
  formData: FormData
): Promise<UploadFileResult> {
  const studentId = String(formData.get("studentId") ?? "");
  const dataTypeKey = String(formData.get("dataTypeKey") ?? "");
  const file = formData.get("file");

  if (!studentId || !dataTypeKey) {
    return { ok: false, error: "Thiếu thông tin." };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Tệp không hợp lệ." };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, error: "Tệp quá lớn (tối đa 20MB)." };
  }

  // 권한: 학생 소유 확인 (RLS — 안 보이면 거부). 셀프/센터 자동 판별.
  let access;
  try {
    access = await resolveDataAccess(studentId);
  } catch {
    return { ok: false, error: "Không có quyền với sinh viên này." };
  }
  const { data: student } = await access.supabase
    .from("study_managed_students")
    .select("id")
    .eq("id", studentId)
    .maybeSingle();
  if (!student) {
    return { ok: false, error: "Không có quyền với sinh viên này." };
  }

  // 검증 끝 → service-role 로 업로드 (Storage RLS 정책 불필요)
  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-120);
  const path = `${access.storageDir(studentId)}/${dataTypeKey}/${Date.now()}-${safeName}`;

  const svc = createServiceClient();
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await svc.storage
    .from(STUDENT_FILES_BUCKET)
    .upload(path, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (upErr) {
    return { ok: false, error: upErr.message };
  }

  return { ok: true, value: { path, file_name: file.name } };
}

/**
 * 업로드된 첨부파일을 잠깐 열어볼 수 있는 서명 URL (10분).
 *   path 가 본인 org 로 시작하는지 확인해 타 org 파일 접근 차단.
 */
export async function getStudentFileSignedUrlAction(
  path: string
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  let access;
  try {
    access = await resolveDataAccess();
  } catch {
    return { ok: false, error: "Không có quyền." };
  }
  if (!path || !access.ownsPath(path)) {
    return { ok: false, error: "Không có quyền." };
  }
  const svc = createServiceClient();
  const { data, error } = await svc.storage
    .from(STUDENT_FILES_BUCKET)
    .createSignedUrl(path, 60 * 10);
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Không tạo được liên kết." };
  }
  return { ok: true, url: data.signedUrl };
}

/**
 * 첨부파일 제거 — 보관함의 실제 파일 삭제 + 데이터 값 비우기.
 */
export async function removeStudentFileAction(input: {
  studentId: string;
  dataTypeKey: string;
  path: string;
}): Promise<SaveDataValueResult> {
  // 권한: 학생 소유 확인 (RLS). 셀프/센터 자동 판별.
  //   (path 가 아니라 학생 소유로 판별 — org 이관·본사 배정으로 파일이 다른 경로에
  //    있어도 학생 소유만 확인되면 지울 수 있어야 한다.)
  let access;
  try {
    access = await resolveDataAccess(input.studentId);
  } catch {
    return { ok: false, error: "Không có quyền với sinh viên này." };
  }
  const rls = access.supabase;
  const { data: student } = await rls
    .from("study_managed_students")
    .select("id")
    .eq("id", input.studentId)
    .maybeSingle();
  if (!student) {
    return { ok: false, error: "Không có quyền với sinh viên này." };
  }

  // 보관함 파일 삭제 (best-effort — 학생 소유 확인됐으므로 경로 무관)
  if (input.path) {
    const svc = createServiceClient();
    await svc.storage.from(STUDENT_FILES_BUCKET).remove([input.path]);
  }

  // 데이터 값 삭제 (RLS)
  const { error } = await rls
    .from("study_student_data_values")
    .delete()
    .eq("student_id", input.studentId)
    .eq("data_type_key", input.dataTypeKey);
  if (error) return { ok: false, error: error.message };

  access.revalidateData(input.studentId);
  return { ok: true };
}
