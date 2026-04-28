import { PageHeader } from "@/components/page-header";
import { StudyCaseForm } from "@/components/study-case-form";

export default function NewStudyCasePage() {
  return (
    <>
      <PageHeader
        title="사례 등록"
        breadcrumbs={[
          { href: "/study-cases", label: "사례" },
          { label: "등록" },
        ]}
      />
      <div className="p-6">
        <StudyCaseForm mode="create" />
      </div>
    </>
  );
}
