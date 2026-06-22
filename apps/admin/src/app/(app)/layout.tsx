import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isGlocareAdmin } from "@/lib/admin-guard";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // 미들웨어가 일반적으로 차단하지만, 안전망.
    redirect("/login");
  }

  // 권한 게이트: 로그인했더라도 글로케어 어드민이 아니면 차단.
  // (유학센터·요양보호 계정이 공유 auth.users 로 admin 에 들어오는 것을 막음)
  if (!isGlocareAdmin(user)) {
    redirect("/forbidden");
  }

  return (
    <div className="flex min-h-svh">
      <AppSidebar />
      <div className="flex flex-1 flex-col min-w-0">
        <AppHeader email={user.email ?? null} />
        <div className="flex-1 overflow-y-auto bg-background">{children}</div>
      </div>
    </div>
  );
}
