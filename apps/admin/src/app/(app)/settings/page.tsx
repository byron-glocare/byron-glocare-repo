import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { SystemSettingsManager } from "@/components/settings/system-settings-manager";
import type { Json } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();

  const { data: settingsRows } = await supabase
    .from("system_settings")
    .select("key, value");

  const settings: Record<string, Json | undefined> = {};
  for (const row of settingsRows ?? []) {
    settings[row.key] = row.value;
  }

  return (
    <>
      <PageHeader
        title="설정"
        description="결제 기준값 · 계정 관리는 ‘계정 관리’ 메뉴에서"
        breadcrumbs={[{ label: "설정" }]}
      />
      <div className="p-6 space-y-6">
        <SystemSettingsManager settings={settings} />
      </div>
    </>
  );
}
