import { PageHeader } from "@/components/page-header";
import { CareHomeForm } from "@/components/care-home-form";

export default function NewCareHomePage() {
  return (
    <>
      <PageHeader
        title="요양원 등록"
        breadcrumbs={[
          { href: "/care-homes", label: "요양원" },
          { label: "등록" },
        ]}
      />
      <div className="p-6">
        <CareHomeForm mode="create" />
      </div>
    </>
  );
}
