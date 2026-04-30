"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { submitResume, uploadResumePhoto } from "@/app/actions/resume";

type Strings = {
  agree: string;
  sectionBasic: string;
  sectionProfile: string;
  sectionEducation: string;
  sectionExperience: string;
  sectionCerts: string;
  sectionSkills: string;
  sectionActivities: string;
  sectionIntro: string;
  nameVi: string;
  nameViPh: string;
  nameKo: string;
  nameKoPh: string;
  birth: string;
  phone: string;
  phonePh: string;
  email: string;
  emailPh: string;
  address: string;
  addressPh: string;
  photo: string;
  photoHint: string;
  motto: string;
  mottoPh: string;
  educationPh: string;
  experiencePh: string;
  certsPh: string;
  skillsPh: string;
  activitiesPh: string;
  episode: string;
  episodePh: string;
  submit: string;
  submitting: string;
};

export function ResumeForm({
  defaultEmail,
  defaultPhone,
  defaultNameKo,
  defaultNameVi,
  strings,
}: {
  defaultEmail?: string | null;
  defaultPhone?: string | null;
  defaultNameKo?: string | null;
  defaultNameVi?: string | null;
  strings: Strings;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [photoUrl, setPhotoUrl] = useState<string>("");
  const [uploading, setUploading] = useState(false);

  async function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("photo", file);
    const r = await uploadResumePhoto(fd);
    setUploading(false);
    if (r.ok) {
      setPhotoUrl(r.url);
      toast.success("사진 업로드 완료");
    } else {
      toast.error("사진 업로드 실패", { description: r.error });
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input = {
      agree_terms: fd.get("agree_terms") === "on",
      name_vi: String(fd.get("name_vi") ?? ""),
      name_ko: String(fd.get("name_ko") ?? ""),
      birth_date: String(fd.get("birth_date") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      email: String(fd.get("email") ?? ""),
      address_ko: String(fd.get("address_ko") ?? ""),
      motto: String(fd.get("motto") ?? ""),
      education_raw: String(fd.get("education") ?? ""),
      experience_raw: String(fd.get("experience") ?? ""),
      certificates_raw: String(fd.get("certificates") ?? ""),
      skills_raw: String(fd.get("skills") ?? ""),
      activities_raw: String(fd.get("activities") ?? ""),
      episode: String(fd.get("episode") ?? ""),
      photo_url: photoUrl || null,
    };

    startTransition(async () => {
      const r = await submitResume(input);
      if (!r.ok) {
        toast.error("이력서 생성 실패", { description: r.error });
        return;
      }
      toast.success("이력서가 생성되었습니다.");
      router.push(`/resume/${r.resumeId}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "1.5rem" }}>
      {/* 동의 */}
      <label
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "0.6rem",
          fontSize: "0.88rem",
          color: "var(--ink-mid)",
          padding: "0.8rem 1rem",
          background: "var(--peach)",
          borderRadius: 8,
          border: "1px solid var(--coral-soft)",
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          name="agree_terms"
          required
          style={{ marginTop: 3, accentColor: "var(--coral)" }}
        />
        <span>{strings.agree}</span>
      </label>

      {/* 기본 정보 */}
      <Section title={strings.sectionBasic}>
        <Grid cols={2}>
          <Field label={strings.nameVi} required>
            <input
              name="name_vi"
              className="field-input"
              required
              defaultValue={defaultNameVi ?? ""}
              placeholder={strings.nameViPh}
            />
          </Field>
          <Field label={strings.nameKo} required>
            <input
              name="name_ko"
              className="field-input"
              required
              defaultValue={defaultNameKo ?? ""}
              placeholder={strings.nameKoPh}
            />
          </Field>
        </Grid>
        <Grid cols={2}>
          <Field label={strings.birth}>
            <input name="birth_date" className="field-input" type="date" />
          </Field>
          <Field label={strings.phone} required>
            <input
              name="phone"
              className="field-input"
              type="tel"
              required
              defaultValue={defaultPhone ?? ""}
              placeholder={strings.phonePh}
            />
          </Field>
        </Grid>
        <Field label={strings.email} required>
          <input
            name="email"
            className="field-input"
            type="email"
            required
            defaultValue={defaultEmail ?? ""}
            placeholder={strings.emailPh}
          />
        </Field>
        <Field label={strings.address}>
          <input
            name="address_ko"
            className="field-input"
            placeholder={strings.addressPh}
          />
        </Field>
      </Section>

      {/* 사진 + 한 줄 포부 */}
      <Section title={strings.sectionProfile}>
        <Field label={strings.photo} hint={strings.photoHint}>
          <input
            type="file"
            accept="image/*"
            onChange={onPhotoChange}
            disabled={uploading}
            style={{ fontSize: "0.85rem" }}
          />
          {uploading && (
            <div
              style={{
                fontSize: "0.78rem",
                color: "var(--ink-light)",
                marginTop: 4,
              }}
            >
              업로드 중...
            </div>
          )}
          {photoUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={photoUrl}
              alt=""
              style={{
                width: 90,
                height: 110,
                objectFit: "cover",
                borderRadius: 6,
                marginTop: 8,
                border: "1px solid var(--border)",
              }}
            />
          )}
        </Field>
        <Field label={strings.motto}>
          <input
            name="motto"
            className="field-input"
            placeholder={strings.mottoPh}
          />
        </Field>
      </Section>

      {/* 학력 */}
      <Section title={strings.sectionEducation}>
        <textarea
          name="education"
          className="field-textarea"
          placeholder={strings.educationPh}
          rows={3}
        />
      </Section>

      {/* 경력 */}
      <Section title={strings.sectionExperience}>
        <textarea
          name="experience"
          className="field-textarea"
          placeholder={strings.experiencePh}
          rows={4}
        />
      </Section>

      {/* 자격증 */}
      <Section title={strings.sectionCerts}>
        <textarea
          name="certificates"
          className="field-textarea"
          placeholder={strings.certsPh}
          rows={3}
        />
      </Section>

      {/* 기술 / 어학 */}
      <Section title={strings.sectionSkills}>
        <textarea
          name="skills"
          className="field-textarea"
          placeholder={strings.skillsPh}
          rows={3}
        />
      </Section>

      {/* 기타 활동 */}
      <Section title={strings.sectionActivities}>
        <textarea
          name="activities"
          className="field-textarea"
          placeholder={strings.activitiesPh}
          rows={3}
        />
      </Section>

      {/* 자기소개 (에피소드) */}
      <Section title={strings.sectionIntro}>
        <Field label={strings.episode}>
          <textarea
            name="episode"
            className="field-textarea"
            placeholder={strings.episodePh}
            rows={6}
          />
        </Field>
      </Section>

      <button
        type="submit"
        className="btn-coral"
        disabled={pending}
        style={{ padding: "1rem", fontSize: "1rem" }}
      >
        {pending ? `${strings.submitting} ⏳` : strings.submit}
      </button>
    </form>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card" style={{ padding: "1.4rem" }}>
      <h3
        style={{
          fontFamily: "var(--font-noto-serif-kr), serif",
          fontSize: "1rem",
          fontWeight: 800,
          color: "var(--ink)",
          marginBottom: "1rem",
          paddingBottom: "0.6rem",
          borderBottom: "2px solid var(--coral)",
          display: "inline-block",
        }}
      >
        {title}
      </h3>
      <div style={{ display: "grid", gap: "0.9rem" }}>{children}</div>
    </div>
  );
}

function Grid({
  cols,
  children,
}: {
  cols: number;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: "0.7rem",
      }}
    >
      {children}
    </div>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "grid", gap: "0.4rem" }}>
      <label className="field-label">
        {label}
        {required && <span style={{ color: "var(--coral)" }}> *</span>}
      </label>
      {children}
      {hint && <div className="field-hint">{hint}</div>}
    </div>
  );
}
