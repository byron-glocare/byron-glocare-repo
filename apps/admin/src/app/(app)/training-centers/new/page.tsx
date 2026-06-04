import { PageHeader } from "@/components/page-header";
import { TrainingCenterForm } from "@/components/training-center-form";

export default function NewTrainingCenterPage() {
  return (
    <>
      <PageHeader
        title="교육원 등록"
        breadcrumbs={[
          { href: "/training-centers", label: "교육원" },
          { label: "등록" },
        ]}
      />
      <div className="p-6">
        <TrainingCenterForm mode="create" />
      </div>
    </>
  );
}
