"use client";

import { useRouter } from "next/navigation";
import { LogOut, User as UserIcon } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Props = {
  email: string | null;
};

export function AppHeader({ email }: Props) {
  const router = useRouter();

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
    <header className="h-16 shrink-0 border-b border-border bg-card flex items-center justify-end px-6 gap-3">
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <UserIcon className="size-4" />
          <span>{email ?? "사용자"}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            로그인 계정
          </DropdownMenuLabel>
          <DropdownMenuLabel className="font-normal text-sm pt-0">
            {email ?? "—"}
          </DropdownMenuLabel>
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
