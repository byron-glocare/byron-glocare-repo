import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
