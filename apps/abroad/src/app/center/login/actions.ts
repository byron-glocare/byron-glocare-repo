"use server";

/**
 * /center/login 의 Server Action.
 *   Supabase Auth signInWithPassword + study_center_users 매핑 검증 + redirect.
 */

import { redirect } from "next/navigation";
import { z } from "zod";

import { createCenterClient } from "@/lib/supabase/center";

const signInSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  password: z.string().min(1, "Vui lòng nhập mật khẩu"),
  from: z.string().optional(),
});

export type SignInState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
} | undefined;

export async function signInCenter(
  _prevState: SignInState,
  formData: FormData
): Promise<SignInState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    from: formData.get("from") ?? undefined,
  });

  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { email, password, from } = parsed.data;
  const supabase = await createCenterClient();

  // 1. Supabase Auth 로그인
  const { data: authData, error: signInError } =
    await supabase.auth.signInWithPassword({ email, password });

  if (signInError || !authData.user) {
    return {
      error: "Email hoặc mật khẩu không đúng",
    };
  }

  // 2. study_center_users 매핑 확인 — RLS 로 본인 row 만 보임
  const { data: member, error: memberErr } = await supabase
    .from("study_center_users")
    .select("id, status, org_id")
    .eq("auth_user_id", authData.user.id)
    .eq("status", "active")
    .maybeSingle();

  if (memberErr || !member) {
    // 인증은 됐지만 유학센터 등록이 없거나 비활성 — 로그아웃 후 거부
    await supabase.auth.signOut();
    return {
      error:
        "Tài khoản chưa được kích hoạt cho trung tâm du học. Vui lòng liên hệ GLOCARE.",
    };
  }

  // 3. 성공 — 원래 가려던 경로 또는 /center 로
  const target =
    from && from.startsWith("/center") && from !== "/center/login"
      ? from
      : "/center";
  redirect(target);
}

export async function signOutCenter() {
  const supabase = await createCenterClient();
  await supabase.auth.signOut();
  redirect("/center/login");
}
