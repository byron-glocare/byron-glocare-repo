import { redirect } from "next/navigation";
import Image from "next/image";

import { createClient } from "@/lib/supabase/server";
import { isGlocareCeo } from "@/lib/admin-guard";
import { MobileLogoutButton } from "@/components/mobile/mobile-logout-button";

/**
 * 대표님 전용 모바일 페이지 (/ceo).
 *   - glocare_ceo 역할만 접근. 그 외(미로그인/admin/영업)는 차단.
 *   - 모바일 우선: 좁은 폭 중앙 정렬, PC 에서도 사용 가능.
 */
export default async function CeoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/ceo");
  if (!isGlocareCeo(user)) redirect("/forbidden");

  return (
    <div className="min-h-svh bg-muted/30">
      <div className="mx-auto flex min-h-svh max-w-md flex-col bg-background shadow-sm">
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <Image
            src="/glocare_logo.png"
            alt="Glocare"
            width={96}
            height={48}
            priority
            className="h-7 w-auto"
          />
          <div className="flex items-center gap-3">
            <span className="max-w-[9rem] truncate text-xs text-muted-foreground">
              {user.email}
            </span>
            <MobileLogoutButton />
          </div>
        </header>
        <main className="flex-1 px-4 py-4">{children}</main>
      </div>
    </div>
  );
}
