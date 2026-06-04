import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { SystemSettingsManager } from "@/components/settings/system-settings-manager";
import { AccountsManager } from "@/components/settings/accounts-manager";
import { listAuthUsers } from "@/app/(app)/settings/actions";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import type { Json } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();

  const [{ data: settingsRows }, authUsersResult, {
    data: { user: currentUser },
  }] = await Promise.all([
    supabase.from("system_settings").select("key, value"),
    listAuthUsers(),
    supabase.auth.getUser(),
  ]);

  const settings: Record<string, Json | undefined> = {};
  for (const row of settingsRows ?? []) {
    settings[row.key] = row.value;
  }

  return (
    <>
      <PageHeader
        title="설정"
        description="결제 기준값 · 계정 관리"
        breadcrumbs={[{ label: "설정" }]}
      />
      <div className="p-6 space-y-6">
        <SystemSettingsManager settings={settings} />
        {authUsersResult.ok ? (
          <AccountsManager
            users={authUsersResult.data}
            currentUserId={currentUser?.id ?? ""}
            currentUserEmail={currentUser?.email ?? null}
          />
        ) : (
          <Card>
            <CardContent className="p-6 flex items-start gap-3 text-sm">
              <AlertTriangle className="size-5 text-warning shrink-0" />
              <div>
                <div className="font-medium">계정 목록을 불러올 수 없습니다</div>
                <div className="text-muted-foreground mt-1">
                  {authUsersResult.error}
                </div>
                <div className="text-xs text-muted-foreground mt-2">
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
