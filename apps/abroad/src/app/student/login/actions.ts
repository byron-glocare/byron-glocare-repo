"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { ensureStudentRow } from "@/lib/student/ensure-student";

/**
 * 이메일·비밀번호 로그인 / 가입.
 *
 * 구글 로그인만 있으면 소셜 계정이 없는 사람은 들어올 수 없다(카드사 심사용
 * 테스트 계정도 소셜 로그인은 불가). 그래서 이메일 축을 함께 둔다.
 *
 * 가입 직후 세션이 생기면 학생 행을 만들고 바로 들여보낸다. 프로젝트가 이메일
 * 확인을 요구하도록 설정돼 있으면 세션이 없으므로 안내만 하고 끝낸다.
 */

export type LoginState =
  | { ok: true; message: string }
  | { error: string }
  | undefined;

/** next 파라미터가 외부 사이트로 새지 않도록 내부 경로만 허용. */
function safeNext(v: string | null): string {
  if (!v || !v.startsWith("/") || v.startsWith("//")) return "/student";
  return v;
}

export async function emailLoginAction(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const mode = String(formData.get("mode") ?? "signin");
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(String(formData.get("next") ?? "/student"));

  if (!email || !password) {
    return { error: "이메일과 비밀번호를 입력하세요." };
  }
  if (mode === "signup" && password.length < 8) {
    return { error: "비밀번호는 8자 이상이어야 합니다." };
  }

  const supabase = await createClient();

  if (mode === "signup") {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: translateAuthError(error.message) };

    // 이메일 확인이 켜져 있으면 세션 없이 끝난다 — 확인 메일 안내.
    if (!data.session || !data.user) {
      return {
        ok: true,
        message: "가입 확인 메일을 보냈습니다. 메일에서 인증한 뒤 로그인하세요.",
      };
    }
    const ensured = await ensureStudentRow(data.user);
    if (!ensured.ok) return { error: ensured.error };
  } else {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return { error: translateAuthError(error.message) };
    if (!data.user) return { error: "로그인에 실패했습니다." };

    const ensured = await ensureStudentRow(data.user);
    if (!ensured.ok) return { error: ensured.error };
  }

  redirect(next);
}

/** Supabase 인증 오류 메시지를 사용자 문구로. */
function translateAuthError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials"))
    return "이메일 또는 비밀번호가 올바르지 않습니다.";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "이미 가입된 이메일입니다. 로그인해 주세요.";
  if (m.includes("email not confirmed"))
    return "이메일 인증이 완료되지 않았습니다. 받은 메일을 확인해 주세요.";
  if (m.includes("password should be"))
    return "비밀번호는 8자 이상이어야 합니다.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "요청이 많습니다. 잠시 후 다시 시도해 주세요.";
  return msg;
}
