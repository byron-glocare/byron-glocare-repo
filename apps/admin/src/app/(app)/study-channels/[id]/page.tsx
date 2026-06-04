import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { StudyChannelForm } from "@/components/study-channel-form";
import type { StudyChannelInput } from "@/lib/validators";

export const dynamic = "force-dynamic";

export default async function StudyChannelEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) notFound();

  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("study_channels")
    .select("*")
    .eq("id", numericId)
    .single();

  if (error || !row) notFound();

  const defaultValues: Partial<StudyChannelInput> = {
    active: row.active,
    type: row.type,
    icon: row.icon,
    name_ko: row.name_ko,
    name_vi: row.name_vi,
    desc_ko: row.desc_ko,
    desc_vi: row.desc_vi,
    handle: row.handle,
    url: row.url,
    sort_order: row.sort_order,
    memo: row.memo,
  };

  const titleLabel = row.name_ko ?? row.name_vi ?? `채널 #${numericId}`;

  return (
    <>
      <PageHeader
        title={`${row.icon ?? "🔗"} ${titleLabel}`}
        description={`채널 #${numericId}`}
        breadcrumbs={[
          { href: "/study-channels", label: "SNS 채널" },
          { label: titleLabel },
        ]}
      />
      <div className="p-6">
        <StudyChannelForm
          mode="edit"
          channelId={numericId}
          defaultValues={defaultValues}
        />
      </div>
    </>
  );
}
