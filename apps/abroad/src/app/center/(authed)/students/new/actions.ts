"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { verifyCenterSession } from "@/lib/center/dal";
import { createCenterClient } from "@/lib/supabase/center";
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

  // 3. DB insert — org_id 는 서버에서 강제 (클라이언트 위변조 방지)
  const data = parsed.data;
  const supabase = await createCenterClient();

  const { error } = await supabase.from("study_managed_students").insert({
    org_id: session.org.id,
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
  });

  if (error) {
    return { error: `Lỗi đăng ký: ${error.message}` };
  }

  // 4. 캐시 갱신 + 목록 페이지로
  revalidatePath("/center/students");
  redirect("/center/students");
}
