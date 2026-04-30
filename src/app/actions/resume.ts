"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { structureResume } from "@/lib/anthropic";
import { generateResumePdf } from "@/lib/resume-pdf";

const resumeSchema = z.object({
  agree_terms: z.boolean(),
  name_vi: z.string().trim().min(1, "이름(베)을 입력해주세요."),
  name_ko: z.string().trim().min(1, "이름(한)을 입력해주세요."),
  birth_date: z.string().trim().optional().nullable(),
  phone: z.string().trim().min(1, "전화번호를 입력해주세요."),
  email: z.string().trim().email("이메일 형식이 올바르지 않습니다."),
  address_ko: z.string().trim().optional().nullable(),
  motto: z.string().trim().optional().nullable(),
  education_raw: z.string().trim().optional().nullable(),
  experience_raw: z.string().trim().optional().nullable(),
  certificates_raw: z.string().trim().optional().nullable(),
  skills_raw: z.string().trim().optional().nullable(),
  activities_raw: z.string().trim().optional().nullable(),
  episode: z.string().trim().optional().nullable(),
  photo_url: z.string().trim().optional().nullable(),
});

export type ResumeInput = z.input<typeof resumeSchema>;

export type SubmitResumeResult =
  | { ok: true; resumeId: number }
  | { ok: false; error: string };

/**
 * 이력서 제출 → AI 정리 → PDF 생성 → Storage 업로드 → resume row 업데이트.
 *
 * 흐름이 길어서 (10-30s 소요) 사용자 UI 는 useTransition + 로딩 표시.
 */
export async function submitResume(
  input: ResumeInput
): Promise<SubmitResumeResult> {
  const parsed = resumeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  if (!parsed.data.agree_terms) {
    return { ok: false, error: "개인정보 수집에 동의해주세요." };
  }
  const data = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };

  // 1. raw row 저장 (status='draft')
  const { data: row, error: insertError } = await supabase
    .from("resumes")
    .insert({
      user_id: user.id,
      agree_terms: data.agree_terms,
      name_vi: data.name_vi,
      name_ko: data.name_ko,
      birth_date: data.birth_date || null,
      phone: data.phone,
      email: data.email,
      address_ko: data.address_ko || null,
      motto: data.motto || null,
      education_raw: data.education_raw || null,
      experience_raw: data.experience_raw || null,
      certificates_raw: data.certificates_raw || null,
      skills_raw: data.skills_raw || null,
      activities_raw: data.activities_raw || null,
      episode: data.episode || null,
      photo_url: data.photo_url || null,
      status: "generating",
    })
    .select("id")
    .single();

  if (insertError || !row) {
    return { ok: false, error: insertError?.message ?? "저장 실패" };
  }
  const resumeId = row.id;

  // 2. AI 로 구조화
  const aiResult = await structureResume({
    motto: data.motto ?? undefined,
    education: data.education_raw ?? undefined,
    experience: data.experience_raw ?? undefined,
    certificates: data.certificates_raw ?? undefined,
    skills: data.skills_raw ?? undefined,
    activities: data.activities_raw ?? undefined,
    episode: data.episode ?? undefined,
  });

  if (!aiResult.ok) {
    await supabase
      .from("resumes")
      .update({ status: "failed" })
      .eq("id", resumeId);
    return { ok: false, error: `AI 처리 실패: ${aiResult.error}` };
  }

  const ai = aiResult.data;

  // 3. PDF 생성
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await generateResumePdf({
      nameKo: data.name_ko,
      nameVi: data.name_vi,
      birthDate: data.birth_date || "",
      phone: data.phone,
      email: data.email,
      addressKo: data.address_ko || "",
      motto: data.motto || "",
      photoUrl: data.photo_url || null,
      education: ai.ai_education ?? [],
      experience: ai.ai_experience ?? [],
      certificates: ai.ai_certificates ?? [],
      skills: ai.ai_skills ?? [],
      activities: ai.ai_activities ?? [],
      selfIntro: ai.ai_self_intro ?? "",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase
      .from("resumes")
      .update({
        status: "failed",
        ai_education: ai.ai_education,
        ai_experience: ai.ai_experience,
        ai_certificates: ai.ai_certificates,
        ai_skills: ai.ai_skills,
        ai_activities: ai.ai_activities,
        ai_self_intro: ai.ai_self_intro,
      })
      .eq("id", resumeId);
    return { ok: false, error: `PDF 생성 실패: ${msg}` };
  }

  // 4. Storage 업로드
  const pdfPath = `${user.id}/${resumeId}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from("resume-pdfs")
    .upload(pdfPath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadError) {
    await supabase
      .from("resumes")
      .update({ status: "failed" })
      .eq("id", resumeId);
    return { ok: false, error: `업로드 실패: ${uploadError.message}` };
  }

  // signed URL 생성 (private bucket)
  const { data: signed } = await supabase.storage
    .from("resume-pdfs")
    .createSignedUrl(pdfPath, 60 * 60 * 24 * 365);

  // 5. row 업데이트
  await supabase
    .from("resumes")
    .update({
      ai_education: ai.ai_education,
      ai_experience: ai.ai_experience,
      ai_certificates: ai.ai_certificates,
      ai_skills: ai.ai_skills,
      ai_activities: ai.ai_activities,
      ai_self_intro: ai.ai_self_intro,
      pdf_url: signed?.signedUrl ?? pdfPath,
      status: "ready",
      generated_at: new Date().toISOString(),
    })
    .eq("id", resumeId);

  revalidatePath("/resume");
  revalidatePath(`/resume/${resumeId}`);
  return { ok: true, resumeId };
}

/**
 * 이력서 사진 업로드 helper — 클라이언트에서 호출.
 */
export async function uploadResumePhoto(
  formData: FormData
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const file = formData.get("photo") as File | null;
  if (!file) return { ok: false, error: "파일이 없습니다." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };

  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${user.id}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from("resume-photos")
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) return { ok: false, error: error.message };

  const { data: signed } = await supabase.storage
    .from("resume-photos")
    .createSignedUrl(path, 60 * 60 * 24 * 30);

  return { ok: true, url: signed?.signedUrl ?? path };
}

/**
 * 다시 PDF download URL 발급 (signed URL 만료된 경우).
 */
export async function refreshResumePdfUrl(
  resumeId: number
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };

  const path = `${user.id}/${resumeId}.pdf`;
  const { data: signed, error } = await supabase.storage
    .from("resume-pdfs")
    .createSignedUrl(path, 60 * 60 * 24);

  if (error || !signed) {
    return { ok: false, error: error?.message ?? "URL 발급 실패" };
  }
  return { ok: true, url: signed.signedUrl };
}

export async function deleteResume(resumeId: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("resumes").delete().eq("id", resumeId).eq("user_id", user.id);
  await supabase.storage
    .from("resume-pdfs")
    .remove([`${user.id}/${resumeId}.pdf`])
    .catch(() => {});
  revalidatePath("/resume");
  redirect("/resume");
}
