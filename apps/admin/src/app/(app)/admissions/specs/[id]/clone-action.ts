"use server";

import { revalidatePath } from "next/cache";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type SpecInsert = Database["public"]["Tables"]["study_admission_specs"]["Insert"];

const TERM_RE = /^\d{4}-(Spring|Fall|Summer|Winter|Year)$/;

/**
 * U4: 모집요강을 새 학기로 복제.
 *   서류(required_documents)·자격(eligibility)·학비(tuition)·장학(scholarships)·학과·메타는 그대로 가져오고,
 *   학기마다 바뀌는 '일정(schedule)' 날짜는 비운다(유통기한이 다름 — 운영자가 새로 입력).
 *   status='draft' 로 생성(학생 비노출) → 편집 화면으로 이동.
 */
export async function cloneSpecToTermAction(
  specId: string,
  newTerm: string
): Promise<{ ok: boolean; error?: string; id?: string }> {
  const supabaseUser = await createClient();
  const {
    data: { user },
  } = await supabaseUser.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다" };

  if (!TERM_RE.test(newTerm)) {
    return { ok: false, error: "학기 형식이 올바르지 않습니다 (예: 2027-Spring)" };
  }

  const supabase = createAdminClient();

  const { data: src } = await supabase
    .from("study_admission_specs")
    .select("*")
    .eq("id", specId)
    .maybeSingle();
  if (!src) return { ok: false, error: "원본 모집요강을 찾을 수 없습니다" };

  if (src.term === newTerm) {
    return { ok: false, error: "원본과 같은 학기입니다. 다른 학기를 선택하세요." };
  }

  // 같은 대학·학기·과정 초안/검수본이 이미 있으면 중복 생성 방지
  const { data: dup } = await supabase
    .from("study_admission_specs")
    .select("id")
    .eq("university_id", src.university_id)
    .eq("term", newTerm)
    .eq("program_type", src.program_type)
    .in("status", ["draft", "reviewing"])
    .maybeSingle();
  if (dup) {
    return {
      ok: true,
      id: dup.id,
      error: "이미 같은 학기·과정의 작업본이 있어 그 화면으로 이동합니다.",
    };
  }

  // 일정(schedule) 날짜 비우기 — 차수 이름만 유지
  const srcSchedule = (src.schedule ?? {}) as {
    rounds?: Array<{ name?: string }>;
    semester_start?: string | null;
  };
  const blankedSchedule = {
    rounds: Array.isArray(srcSchedule.rounds)
      ? srcSchedule.rounds.map((r) => ({
          name: r?.name ?? "",
          application_open: null,
          application_close: null,
          document_submission_close: null,
          interview_period: null,
          result_announcement: null,
          payment_period: null,
        }))
      : [],
    semester_start: null,
  };

  const ins: SpecInsert = {
    university_id: src.university_id,
    term: newTerm,
    admission_category: src.admission_category,
    program_type: src.program_type,
    departments: src.departments,
    required_documents: src.required_documents,
    eligibility: src.eligibility,
    schedule: blankedSchedule,
    tuition: src.tuition,
    scholarships: src.scholarships,
    metadata: src.metadata,
    is_online_submission: src.is_online_submission,
    online_form_url: src.online_form_url,
    status: "draft",
    source_file_url: src.source_file_url,
  };

  const { data: created, error } = await supabase
    .from("study_admission_specs")
    .insert(ins)
    .select("id")
    .single();
  if (error) return { ok: false, error: `복제 실패: ${error.message}` };

  revalidatePath("/admissions");
  revalidatePath(`/admissions/${src.university_id}`);
  revalidatePath(`/universities/${src.university_id}`);
  return { ok: true, id: created.id };
}
