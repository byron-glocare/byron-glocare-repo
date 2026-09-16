"use server";

import { getLocale, tr } from "@/lib/i18n";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { verifyCenterSession } from "@/lib/center/dal";
import { createCenterClient } from "@/lib/supabase/center";

const emptyToUndef = <T extends z.ZodTypeAny>(s: T) =>
  z.preprocess((v) => (v === "" || v === null ? undefined : v), s);

type T = (ko: string, vi: string) => string;
const updateSchema = (t: T) =>
  z.object({
  // 0067 — 모집(대학·학과·학기) 변경. 비면 그대로 둔다.
  offering_id: emptyToUndef(z.string().uuid().optional()),
  target_department_label: z
    .string()
    .min(1, t("학과를 입력하세요", "Vui lòng nhập ngành học"))
    .max(200),
  next_action: emptyToUndef(z.string().max(200).optional()),
  next_deadline: emptyToUndef(
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
  ),
});

export type UpdateApplicationState =
  | {
      error?: string;
      fieldErrors?: Record<string, string[] | undefined>;
    }
  | undefined;

export async function updateApplicationAction(
  applicationId: string,
  studentId: string,
  _prev: UpdateApplicationState,
  formData: FormData
): Promise<UpdateApplicationState> {
  await verifyCenterSession();

  const raw = Object.fromEntries(formData.entries());
  const locale = await getLocale();
  const t: T = (ko, vi) => tr(locale, ko, vi);
  const parsed = updateSchema(t).safeParse(raw);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const d = parsed.data;
  const supabase = await createCenterClient();

  const patch: {
    target_department_label: string;
    next_action: string | null;
    next_deadline: string | null;
    admission_spec_id?: string;
    offering_id?: string;
    target_department_id?: number;
    term?: string;
  } = {
    target_department_label: d.target_department_label,
    next_action: d.next_action ?? null,
    next_deadline: d.next_deadline ?? null,
  };

  if (d.offering_id) {
    const { data: current } = await supabase
      .from("study_applications")
      .select("offering_id")
      .eq("id", applicationId)
      .maybeSingle();
    if (current && current.offering_id !== d.offering_id) {
      // 모집 행을 서버에서 다시 읽어 요강·학과·학기를 채운다 (폼 값은 믿지 않는다)
      const { data: offering } = await supabase
        .from("study_offerings")
        .select("id, department_id, term, source_spec_id, status")
        .eq("id", d.offering_id)
        .maybeSingle();
      if (!offering || offering.status !== "published" || !offering.source_spec_id) {
        return { fieldErrors: { offering_id: [t("모집 중인 학과가 아닙니다", "Ngành này không còn tuyển")] } };
      }
      const { data: dept } = await supabase
        .from("departments")
        .select("name_ko")
        .eq("id", offering.department_id)
        .maybeSingle();
      patch.admission_spec_id = offering.source_spec_id;
      patch.offering_id = offering.id;
      patch.target_department_id = offering.department_id;
      patch.term = offering.term;
      // 학과명(한국어)은 옛 코드의 양식 매칭 기준 — 모집을 바꾸면 그 학과명으로 덮어쓴다
      if (dept?.name_ko) patch.target_department_label = dept.name_ko;
    }
  }

  const { error } = await supabase
    .from("study_applications")
    .update(patch)
    .eq("id", applicationId);

  if (error) {
    return { error: `${t("수정 실패", "Lỗi cập nhật")}: ${error.message}` };
  }

  revalidatePath(`/center/students/${studentId}`);
  redirect(`/center/students/${studentId}`);
}
