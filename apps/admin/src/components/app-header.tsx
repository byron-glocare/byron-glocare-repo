"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, User as UserIcon, X } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AppSidebar } from "@/components/app-sidebar";

type Props = {
  email: string | null;
};

export function AppHeader({ email }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  // 서랍을 연 페이지를 기억한다 — 페이지가 바뀌면(메뉴 클릭·뒤로가기) 저절로 닫힌 것으로 본다.
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const navOpen = openedAt === pathname;
  const setNavOpen = (open: boolean) => setOpenedAt(open ? pathname : null);

  // 서랍이 열려 있으면 Esc 로 닫기
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenedAt(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navOpen]);

  async function handleSignOut() {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("로그아웃 실패", { description: error.message });
      return;
    }
    toast.success("로그아웃 되었습니다.");
    router.replace("/login");
    router.refresh();
  }

  return (
    <header
      data-app-header
      className="h-16 shrink-0 border-b border-border bg-card flex items-center justify-end px-4 md:px-6 gap-3"
    >
      {/* 좁은 화면(768px 미만) 전용 — 고정 사이드바가 숨겨질 때 메뉴를 여는 버튼 */}
      <button
        type="button"
        onClick={() => setNavOpen(true)}
        className="mr-auto inline-flex h-9 items-center gap-2 rounded-md px-2.5 text-sm font-medium hover:bg-accent md:hidden"
        aria-label="메뉴 열기"
        aria-expanded={navOpen}
      >
        <Menu className="size-5" />
        메뉴
      </button>
      {navOpen ? (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="메뉴">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="메뉴 닫기"
            onClick={() => setNavOpen(false)}
          />
          <div className="relative h-full w-64 shadow-xl">
            <AppSidebar drawer onNavigate={() => setNavOpen(false)} />
            <button
              type="button"
              onClick={() => setNavOpen(false)}
              className="absolute right-2 top-2 inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="메뉴 닫기"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <UserIcon className="size-4" />
          <span>{email ?? "사용자"}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <div className="px-2 py-1.5">
            <div className="text-xs text-muted-foreground">로그인 계정</div>
            <div className="text-sm mt-0.5 truncate">{email ?? "—"}</div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
            <LogOut className="size-4" />
            로그아웃
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
