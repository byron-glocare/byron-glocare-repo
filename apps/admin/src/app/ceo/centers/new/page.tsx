import { requireCeo } from "@/lib/ceo/guard";
import { loadFindingCustomers } from "@/lib/ceo/findings";
import { CeoCenterForm } from "@/components/ceo/ceo-center-form";

export const dynamic = "force-dynamic";

export default async function CeoCenterNewPage() {
  const { admin } = await requireCeo();
  const findings = await loadFindingCustomers(admin, "training_center");
  return <CeoCenterForm findings={findings} />;
}
