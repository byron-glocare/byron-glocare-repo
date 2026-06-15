import { redirect } from "next/navigation";

import { ResumeForm } from "@/components/resume-form";
import { getAuthState, hasFeatureAccess } from "@/lib/auth";
import { getDict } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function NewResumePage() {
  const auth = await getAuthState();
  if (auth.kind === "guest") redirect("/login?next=/resume/new");
  if (auth.kind === "unmapped") redirect("/verify");
  if (!hasFeatureAccess(auth.customer, "resume")) {
    redirect("/resume");
  }

  const t = await getDict();

  return (
    <div className="page-wrap fade-up" style={{ maxWidth: 720 }}>
      <div className="eyebrow">{t["resume.eyebrow"]}</div>
      <h1 className="page-title">{t["resume.title"]}</h1>
      <p className="page-desc">{t["resume.intro"]}</p>

      <ResumeForm
        defaultEmail={auth.customer.email}
        defaultPhone={auth.customer.phone}
        defaultNameKo={auth.customer.name_kr}
        defaultNameVi={auth.customer.name_vi}
        strings={{
          agree: t["resume.form.agree"],
          sectionBasic: t["resume.form.section.basic"],
          sectionProfile: t["resume.form.section.profile"],
          sectionEducation: t["resume.form.section.education"],
          sectionExperience: t["resume.form.section.experience"],
          sectionCerts: t["resume.form.section.certs"],
          sectionSkills: t["resume.form.section.skills"],
          sectionActivities: t["resume.form.section.activities"],
          sectionIntro: t["resume.form.section.intro"],
          nameVi: t["resume.form.name_vi"],
          nameViPh: t["resume.form.name_vi_ph"],
          nameKo: t["resume.form.name_ko"],
          nameKoPh: t["resume.form.name_ko_ph"],
          birth: t["resume.form.birth"],
          phone: t["resume.form.phone"],
          phonePh: t["resume.form.phone_ph"],
          email: t["resume.form.email"],
          emailPh: t["resume.form.email_ph"],
          address: t["resume.form.address"],
          addressPh: t["resume.form.address_ph"],
          photo: t["resume.form.photo"],
          photoHint: t["resume.form.photo_hint"],
          motto: t["resume.form.motto"],
          mottoPh: t["resume.form.motto_ph"],
          educationPh: t["resume.form.education_ph"],
          experiencePh: t["resume.form.experience_ph"],
          certsPh: t["resume.form.certs_ph"],
          skillsPh: t["resume.form.skills_ph"],
          activitiesPh: t["resume.form.activities_ph"],
          episode: t["resume.form.episode"],
          episodePh: t["resume.form.episode_ph"],
          submit: t["resume.form.submit"],
          submitting: t["resume.form.submitting"],
        }}
      />
    </div>
  );
}
