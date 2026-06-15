import { Suspense } from "react";

import { PayClient } from "@/components/pay-client";

export const dynamic = "force-dynamic";

export default function PayPage() {
  return (
    <Suspense fallback={<div className="page-wrap">…</div>}>
      <PayClient />
    </Suspense>
  );
}
