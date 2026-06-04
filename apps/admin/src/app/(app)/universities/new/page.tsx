import { PageHeader } from "@/components/page-header";
import { UniversityForm } from "@/components/university-form";

export default function NewUniversityPage() {
  return (
    <>
      <PageHeader
        title="대학 등록"
        breadcrumbs={[
          { href: "/universities", label: "대학교" },
          { label: "등록" },
        ]}
      />
      <div className="p-6">
        <UniversityForm mode="create" />
      </div>
    </>
  );
}
