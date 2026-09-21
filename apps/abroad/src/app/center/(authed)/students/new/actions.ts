"use server";

import { getLocale, trAsync } from "@/lib/i18n";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { verifyCenterSession } from "@/lib/center/dal";
import { createCenterClient } from "@/lib/supabase/center";
import { createServiceClient } from "@/lib/supabase/service";
import { createStudentSchema } from "@/lib/center/students/schema";
import { normalizeRegistration } from "@/lib/center/students/registration";
import { writeRegistrationValues } from "@/lib/center/students/save-registration";

export type CreateStudentState =
  | {
      error?: string;
      fieldErrors?: Record<string, string[] | undefined>;
    }
  | undefined;

export async function createStudentAction(
  _prevState: CreateStudentState,
  formData: FormData
): Promise<CreateStudentState> {
  // 1. 인증·org 검증
  const session = await verifyCenterSession();

  const locale = await getLocale();

  // 2. 폼 → 지원자 명단 칸 정규화·필수 검사 (정본: student-roster-columns.ts)
  const raw: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (typeof v === "string") raw[k] = v;
  }
  const reg = normalizeRegistration(raw, locale);
  const fieldErrors: Record<string, string[]> = {};
  for (const [k, msg] of Object.entries(reg.errors)) fieldErrors[k] = [msg];

  // 3. study_managed_students 칸 검사 (여권·전화·이메일 형식 등 — 기존 스키마 재사용)
  const parsed = createStudentSchema.safeParse({
    name: reg.student.name,
    dob: reg.student.dob ?? "",
    passport_no: reg.student.passport_no ?? "",
    phone: reg.student.phone ?? "",
    email: reg.student.email ?? "",
    topik_level: reg.student.topik_level ?? "",
    current_visa: raw.current_visa ?? "",
    location: raw.location ?? "",
    notes: raw.notes ?? "",
    target_study_center_id: raw.target_study_center_id ?? "",
  });
  if (!parsed.success) {
    // 스키마 칸 이름 → 폼 칸 이름
    const toFormField: Record<string, string> = {
      dob: "birth_date",
      phone: "student_phone",
      email: "student_email",
    };
    for (const [k, v] of Object.entries(parsed.error.flatten().fieldErrors)) {
      const msgs = v as string[] | undefined;
      if (!msgs?.[0]) continue;
      const f = toFormField[k] ?? k;
      if (!fieldErrors[f]) fieldErrors[f] = [msgs[0]];
    }
  }
  if (Object.keys(fieldErrors).length > 0 || !parsed.success) {
    return {
      error: await trAsync(
        "입력 내용을 확인하세요. 빨간 글씨 항목을 고쳐 주세요.",
        "Vui lòng kiểm tra lại các mục báo đỏ."
      ),
      fieldErrors,
    };
  }

  // 4. DB insert
  const data = parsed.data;

  // 공통 payload (org_id 는 아래에서 계정 종류별로 결정)
  const payload = {
    name: data.name,
    dob: data.dob ?? null,
    // 후속(B+): pgcrypto 로 컬럼 단위 암호화. 지금은 평문 저장.
    passport_no_encrypted: data.passport_no ?? null,
    phone: data.phone ?? null,
    email: data.email ?? null,
    topik_level: data.topik_level ?? null,
    current_visa: data.current_visa ?? null,
    location: data.location ?? null,
    notes: data.notes ?? null,
  };

  let insertError: { message: string } | null = null;
  let newStudentId: string | null = null;

  if (session.isGlocare) {
    // 글로케어(본사) 계정: 학생을 선택한 유학센터로 배정.
    //   role 을 서버에서 검증했으므로 service client 로 RLS 우회.
    //   선택 센터의 org 를 찾거나(없으면) 생성 후 그 org 에 삽입.
    const scId = data.target_study_center_id;
    if (!scId) {
      return {
        fieldErrors: {
          target_study_center_id: [
            await trAsync("소속 유학센터를 선택하세요", "Vui lòng chọn trung tâm du học"),
          ],
        },
      };
    }
    const svc = createServiceClient();
    const resolved = await resolveOrgForStudyCenter(svc, scId);
    if (!resolved.ok) {
      return { error: resolved.error };
    }
    const { data: row, error } = await svc
      .from("study_managed_students")
      .insert({ org_id: resolved.orgId, ...payload })
      .select("id")
      .single();
    insertError = error;
    newStudentId = row?.id ?? null;
  } else {
    // 일반 유학센터 계정: 자기 org 로 강제 (클라이언트 위변조 방지)
    const supabase = await createCenterClient();
    const { data: row, error } = await supabase
      .from("study_managed_students")
      .insert({ org_id: session.org.id, ...payload })
      .select("id")
      .single();
    insertError = error;
    newStudentId = row?.id ?? null;
  }

  if (insertError || !newStudentId) {
    return {
      error: `${await trAsync("등록 오류", "Lỗi đăng ký")}: ${insertError?.message ?? "no id"}`,
    };
  }

  // 5. 등록 값 → 데이터 항목(작성서류가 쓰는 값). 방금 이 계정이 넣은 학생이므로 service client 사용.
  //    실패하면 학생 행을 되돌린다 (반쪽 등록 방지 — 다시 제출해도 중복이 생기지 않게).
  const svc = createServiceClient();
  const saved = await writeRegistrationValues(svc, {
    studentId: newStudentId,
    values: reg.values,
    filledBy: session.authUserId,
  });
  if (!saved.ok) {
    await svc.from("study_managed_students").delete().eq("id", newStudentId);
    return {
      error: `${await trAsync("학생 정보 저장 오류", "Lỗi lưu thông tin sinh viên")}: ${saved.error}`,
    };
  }

  // 6. 캐시 갱신 + 목록 페이지로
  revalidatePath("/center/students");
  redirect("/center/students");
}

/**
 * study_center_id(마스터 유학센터) → org 를 찾고, 없으면 study_center 정보로 새 org 생성.
 *   admin `/accounts` 의 resolveOrgForStudyCenter 와 동일 로직(글로케어 학생 배정용).
 *   이렇게 만든 org 는 이후 그 센터 계정 생성 시 자동 재사용된다.
 */
async function resolveOrgForStudyCenter(
  svc: ReturnType<typeof createServiceClient>,
  studyCenterId: number
): Promise<{ ok: true; orgId: string } | { ok: false; error: string }> {
  const { data: existing } = await svc
    .from("study_center_orgs")
    .select("id")
    .eq("study_center_id", studyCenterId)
    .limit(1)
    .maybeSingle();
  if (existing?.id) return { ok: true, orgId: existing.id };

  const { data: center } = await svc
    .from("study_centers")
    .select("name_vi, name_ko")
    .eq("id", studyCenterId)
    .maybeSingle();
  if (!center) {
    return {
      ok: false,
      error: await trAsync("유학센터를 찾을 수 없습니다", "Không tìm thấy trung tâm"),
    };
  }

  const { data: org, error } = await svc
    .from("study_center_orgs")
    .insert({
      name_vi: center.name_vi,
      name_ko: center.name_ko,
      country: "VN",
      status: "active",
      settlement_currency: "KRW",
      study_center_id: studyCenterId,
      activated_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !org) {
    return { ok: false, error: `Tạo trung tâm thất bại: ${error?.message}` };
  }
  return { ok: true, orgId: org.id };
}
