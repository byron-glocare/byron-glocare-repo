"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ShieldX, LogOut, Loader2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export default function ForbiddenPage() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onLogout() {
    setPending(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-destructive/10">
          <ShieldX className="size-6 text-destructive" />
        </div>
        <h1 className="text-lg font-semibold text-foreground">
          접근 권한이 없습니다
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          이 계정은 글로케어 관리자 권한이 없습니다. 관리자 계정으로 로그인하거나,
          담당자에게 권한 부여를 요청하세요.
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-6"
          onClick={onLogout}
          disabled={pending}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <LogOut className="size-4" />
          )}
          로그아웃 후 다시 로그인
        </Button>
      </div>
    </div>
  );
}
