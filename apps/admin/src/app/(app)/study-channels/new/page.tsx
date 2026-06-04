import { PageHeader } from "@/components/page-header";
import { StudyChannelForm } from "@/components/study-channel-form";

export default function NewStudyChannelPage() {
  return (
    <>
      <PageHeader
        title="채널 등록"
        breadcrumbs={[
          { href: "/study-channels", label: "SNS 채널" },
          { label: "등록" },
        ]}
      />
      <div className="p-6">
        <StudyChannelForm mode="create" />
      </div>
    </>
  );
}
