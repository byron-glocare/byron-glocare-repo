"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// =============================================================================
// system_settings 업데이트
// =============================================================================

export async function updateSystemSetting(
  key: string,
  value: Json
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("system_settings").upsert(
    {
      key,
      value,
      updated_by: user?.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );

  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings");
  return { ok: true, data: null };
}

// =============================================================================
// 계정 관리 (Admin API — service_role 필요)
// =============================================================================

export async function listAuthUsers(): Promise<
  ActionResult<
    {
      id: string;
      email: string | undefined;
      created_at: string;
      last_sign_in_at: string | null;
      banned_until: string | null;
    }[]
  >
> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.listUsers({
      perPage: 100,
    });
    if (error) return { ok: false, error: error.message };
    return {
      ok: true,
      data: data.users.map((u) => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        banned_until: (u as { banned_until?: string | null }).banned_until ?? null,
      })),
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Admin API 호출 실패",
    };
  }
}

export async function createAuthUser(input: {
  email: string;
  password: string;
}): Promise<ActionResult> {
  if (!input.email.trim()) return { ok: false, error: "이메일은 필수입니다." };
  if (input.password.length < 6) {
    return { ok: false, error: "비밀번호는 6자 이상이어야 합니다." };
  }

  // 로그인 사용자 확인 (인증된 사용자만 다른 사용자 생성 가능)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  try {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.createUser({
      email: input.email.trim(),
      password: input.password,
      email_confirm: true, // 이메일 인증 스킵
    });
    if (error) return { ok: false, error: error.message };

    revalidatePath("/settings");
    return { ok: true, data: null };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "계정 생성 실패",
    };
  }
}

export async function toggleAuthUserBan(
  userId: string,
  banned: boolean
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized" };
  if (user.id === userId) {
    return { ok: false, error: "본인 계정은 비활성화할 수 없습니다." };
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: banned ? "8760h" : "none", // 1년 vs 해제
    });
    if (error) return { ok: false, error: error.message };

    revalidatePath("/settings");
    return { ok: true, data: null };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "비활성화 실패",
    };
  }
}

/** 본인 비밀번호 변경 */
export async function updateOwnPassword(
  newPassword: string
): Promise<ActionResult> {
  if (newPassword.length < 6) {
    return { ok: false, error: "비밀번호는 6자 이상이어야 합니다." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}
