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
    // 글로케어(본사) 계정: 학생을 선택한 유학센터(org)로 배정.
    //   role 을 서버에서 검증했으므로 service client 로 RLS 우회해 지정 org 에 삽입.
    const targetOrgId = data.target_org_id;
    if (!targetOrgId) {
      return {
        fieldErrors: {
          target_org_id: ["Vui lòng chọn trung tâm du học (소속 유학센터를 선택하세요)"],
        },
      };
    }
    const svc = createServiceClient();
    const { data: org } = await svc
      .from("study_center_orgs")
      .select("id, status")
      .eq("id", targetOrgId)
      .maybeSingle();
    if (!org || org.status !== "active" || org.id === session.org.id) {
      return {
        fieldErrors: {
          target_org_id: ["Trung tâm không hợp lệ (유효한 유학센터가 아닙니다)"],
        },
      };
    }
    const { error } = await svc
      .from("study_managed_students")
      .insert({ org_id: targetOrgId, ...payload });
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
