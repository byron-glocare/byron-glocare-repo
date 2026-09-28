import { requireCeo } from "@/lib/ceo/guard";
import { loadFindingCustomers } from "@/lib/ceo/findings";
import { CeoHomeForm } from "@/components/ceo/ceo-home-form";

export const dynamic = "force-dynamic";

export default async function CeoHomeNewPage() {
  const { admin } = await requireCeo();
  const findings = await loadFindingCustomers(admin, "care_home");
  return <CeoHomeForm findings={findings} />;
}
