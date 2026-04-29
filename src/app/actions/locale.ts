"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import type { Locale } from "@/lib/i18n";

export async function setLocale(next: Locale) {
  const c = await cookies();
  c.set("locale", next, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/");
}
