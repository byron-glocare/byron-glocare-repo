import "server-only";

import { cookies } from "next/headers";

import type { Locale } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * 화면 언어를 계정에 붙여 둔다.
 *
 * 런타임 정본은 여전히 쿠키다 — 공개 페이지엔 계정이 없고, 매 렌더마다 DB 를
 * 때릴 이유도 없다. 계정 값은 "기기를 바꿔도 따라오게" 하는 용도이고,
 * 로그인할 때 한 번 쿠키로 옮겨 온다.
 *
 * 대상은 youstudyinkorea 두 계정뿐이다.
 *   study_center_users     유학센터 담당자 (auth_user_id 로 매칭)
 *   study_managed_students 학생 (auth_user_id 로 매칭)
 * 어드민은 한국어 전용이라 대상이 아니다.
 */

const TABLES = [
  { table: "study_center_users" as const },
  { table: "study_managed_students" as const },
];

/** 로그인한 auth 사용자. 없으면 null. */
async function currentUserId(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * 계정에 언어를 기록한다. 어느 테이블에 속한 계정인지 모르므로 둘 다 시도하고,
 * 해당 row 가 없는 쪽은 그냥 0건 업데이트로 끝난다.
 *
 * 언어 전환은 부가 기능이라 실패해도 조용히 넘어간다 — 화면은 이미 바뀌었다.
 */
export async function persistAccountLocale(locale: Locale): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;
  try {
    const admin = createServiceClient();
    await Promise.all(
      TABLES.map(({ table }) =>
        admin.from(table).update({ locale }).eq("auth_user_id", userId)
      )
    );
  } catch {
    /* 무시 */
  }
}

/** 계정에 저장된 언어. 없으면 null. */
export async function readAccountLocale(): Promise<Locale | null> {
  const userId = await currentUserId();
  if (!userId) return null;
  try {
    const admin = createServiceClient();
    for (const { table } of TABLES) {
      const { data } = await admin
        .from(table)
        .select("locale")
        .eq("auth_user_id", userId)
        .maybeSingle();
      const v = (data as { locale?: string | null } | null)?.locale;
      if (v === "ko" || v === "vi") return v;
    }
  } catch {
    /* 무시 */
  }
  return null;
}

/**
 * 계정 언어로 쿠키를 맞춘다. 로그인 직후에만 호출한다
 * (쿠키는 Server Action / Route Handler 에서만 쓸 수 있다).
 */
export async function syncLocaleCookie(): Promise<void> {
  const locale = await readAccountLocale();
  if (!locale) return;
  const c = await cookies();
  if (c.get("locale")?.value === locale) return;
  c.set("locale", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
