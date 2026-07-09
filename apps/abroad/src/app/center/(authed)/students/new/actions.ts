"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { verifyCenterSession } from "@/lib/center/dal";
import { createCenterClient } from "@/lib/supabase/center";
import { createServiceClient } from "@/lib/supabase/service";
import { createStudentSchema } from "@/lib/center/students/schema";

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

  // 2. 폼 → zod
  const raw = Object.fromEntries(formData.entries());
  const parsed = createStudentSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  // 3. DB insert
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

  if (session.isGlocare) {
    // 글로케어(본사) 계정: 학생을 선택한 유학센터로 배정.
    //   role 을 서버에서 검증했으므로 service client 로 RLS 우회.
    //   선택 센터의 org 를 찾거나(없으면) 생성 후 그 org 에 삽입.
    const scId = data.target_study_center_id;
    if (!scId) {
      return {
        fieldErrors: {
          target_study_center_id: [
            "Vui lòng chọn trung tâm du học (소속 유학센터를 선택하세요)",
          ],
        },
      };
    }
    const svc = createServiceClient();
    const resolved = await resolveOrgForStudyCenter(svc, scId);
    if (!resolved.ok) {
      return { error: resolved.error };
    }
    const { error } = await svc
      .from("study_managed_students")
      .insert({ org_id: resolved.orgId, ...payload });
    insertError = error;
  } else {
    // 일반 유학센터 계정: 자기 org 로 강제 (클라이언트 위변조 방지)
    const supabase = await createCenterClient();
    const { error } = await supabase
      .from("study_managed_students")
      .insert({ org_id: session.org.id, ...payload });
    insertError = error;
  }

  if (insertError) {
    return { error: `Lỗi đăng ký: ${insertError.message}` };
  }

  // 4. 캐시 갱신 + 목록 페이지로
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
      error: "Không tìm thấy trung tâm (유학센터를 찾을 수 없습니다)",
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
