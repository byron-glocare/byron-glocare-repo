import Link from "next/link";
import { MessageSquarePlus, Plus } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import {
  CustomerListPanel,
  type CustomerListFilters,
} from "@/components/customer-list-panel";

export const dynamic = "force-dynamic";

type SearchParams = Promise<CustomerListFilters>;

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;

  return (
    <>
      <PageHeader
        title="고객관리"
        breadcrumbs={[{ label: "고객관리" }]}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/consultations/new"
              className={buttonVariants({ variant: "outline" })}
            >
              <MessageSquarePlus className="size-4" />
              상담 일지 작성
            </Link>
            <Link href="/customers/new" className={buttonVariants()}>
              <Plus className="size-4" />
              신규 고객 등록
            </Link>
          </div>
        }
      />
      <div className="p-6">
        <CustomerListPanel filters={sp} basePath="/customers" />
      </div>
    </>
  );
}
