import { InsuranceForm } from "@/components/insurance-form";
import { getDict } from "@/lib/i18n";

export default async function InsurancePage() {
  const t = await getDict();
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">{t["insurance.title"]}</h1>
      <p className="text-muted-foreground mb-8">
        {t["insurance.description"]}
      </p>
      <InsuranceForm />
    </div>
  );
}
