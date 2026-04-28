import { PageHeader } from "@/components/page-header";
import { StudyCenterForm } from "@/components/study-center-form";

export default function NewStudyCenterPage() {
  return (
    <>
      <PageHeader
        title="센터 등록"
        breadcrumbs={[
          { href: "/study-centers", label: "유학센터" },
          { label: "등록" },
        ]}
      />
      <div className="p-6">
        <StudyCenterForm mode="create" />
      </div>
    </>
  );
}
