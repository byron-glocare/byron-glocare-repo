import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

import { listAccounts } from "./actions";
import { AdminAccounts } from "@/components/accounts/admin-accounts";
import { CenterAccounts } from "@/components/accounts/center-accounts";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const supabase = await createClient();

  const [accountsResult, { data: centers }, {
    data: { user: currentUser },
  }] = await Promise.all([
    listAccounts(),
    supabase
      .from("study_centers")
      .select("id, name_vi, name_ko, active")
      .order("name_vi"),
    supabase.auth.getUser(),
  ]);

  return (
    <>
      <PageHeader
        title="계정 관리"
        description="글로케어 어드민 권한 · 유학센터 로그인 계정"
        breadcrumbs={[{ label: "계정 관리" }]}
      />
      <div className="space-y-6 p-6">
        {accountsResult.ok ? (
          <>
            <AdminAccounts
              accounts={accountsResult.data}
              currentUserId={currentUser?.id ?? ""}
              currentUserEmail={currentUser?.email ?? null}
            />
            <CenterAccounts
              accounts={accountsResult.data}
              centers={centers ?? []}
            />
          </>
        ) : (
          <Card>
            <CardContent className="flex items-start gap-3 p-6 text-sm">
              <AlertTriangle className="size-5 shrink-0 text-warning" />
              <div>
                <div className="font-medium">계정 목록을 불러올 수 없습니다</div>
                <div className="mt-1 text-muted-foreground">
                  {accountsResult.error}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  SUPABASE_SERVICE_ROLE_KEY 환경변수가 올바른지 확인하세요.
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
