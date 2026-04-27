import { ContactForm } from "@/components/contact-form";
import { getDict } from "@/lib/i18n";

export default async function ApplyPage() {
  const t = await getDict();
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">{t["apply.title"]}</h1>
      <p className="text-muted-foreground mb-8">{t["apply.description"]}</p>
      <ContactForm />
    </div>
  );
}
