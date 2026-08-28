"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import type { Locale } from "@/lib/i18n";
import { persistAccountLocale, syncLocaleCookie } from "@/lib/account-locale";

/**
 * 화면 언어 전환.
 *
 * 쿠키가 런타임 정본이다(공개 페이지엔 계정이 없으므로). 로그인 상태면 계정에도
 * 남겨서 기기를 바꿔도 따라오게 한다 — 계정 저장은 실패해도 화면 전환은 그대로 된다.
 */
export async function setLocale(next: Locale) {
  const c = await cookies();
  c.set("locale", next, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  await persistAccountLocale(next);
  revalidatePath("/");
}

/**
 * 로그인 직후 계정에 저장된 언어로 쿠키를 맞춘다.
 * 쿠키는 Server Action / Route Handler 에서만 쓸 수 있어 로그인 시점에 한 번 맞춘다.
 */
export async function applyAccountLocale() {
  await syncLocaleCookie();
}
