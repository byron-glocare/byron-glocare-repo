import { PageHeader } from "@/components/page-header";
import { DataTypeForm } from "../type-form";

export default function NewDataTypePage() {
  return (
    <>
      <PageHeader
        title="데이터 타입 추가"
        description="새로운 표준 정보 항목 정의"
        breadcrumbs={[
          { label: "표준 데이터", href: "/student-data-types" },
          { label: "신규" },
        ]}
      />
      <div className="p-6">
        <DataTypeForm />
      </div>
    </>
  );
}
