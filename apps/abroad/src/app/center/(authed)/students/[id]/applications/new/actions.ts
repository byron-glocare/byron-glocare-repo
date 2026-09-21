"use server";

import { getLocale, tr } from "@/lib/i18n";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { verifyCenterSession } from "@/lib/center/dal";
import { createCenterClient } from "@/lib/supabase/center";

import { MAX_PRIORITY } from "../priority";
import { renumberTermPriorities } from "../priority-actions";

const emptyToUndef = <T extends z.ZodTypeAny>(s: T) =>
  z.preprocess((v) => (v === "" || v === null ? undefined : v), s);

const languageEnum = z.enum(["korean", "english", "other"]);

type T = (ko: string, vi: string) => string;
const createApplicationSchema = (t: T) =>
  z.object({
  admission_spec_id: z.string().uuid(t("모집요강을 선택하세요", "Chọn hồ sơ tuyển sinh hợp lệ")),
  // 모집(offering) 경로 — 희망 = 대학/학과/학기. 모집요강 직접 선택 시엔 없음.
  offering_id: emptyToUndef(z.string().uuid().optional()),
  // 실제 학과 FK (offering 경로면 채워짐)
  target_department_id: emptyToUndef(z.coerce.number().int().positive().optional()),
  // C2 — 선택 언어 (offering 경로). 거주지는 학생 속성(location)을 그대로 사용.
  selected_language: emptyToUndef(languageEnum.optional()),
  target_department_label: z
    .string()
    .min(1, t("학과를 선택하세요", "Chọn ngành học"))
    .max(200),
  // 0067 — 지원 학기 (offering.term / 요강 학기)
  term: emptyToUndef(z.string().trim().max(40).optional()),
  next_action: emptyToUndef(z.string().max(200).optional()),
  next_deadline: emptyToUndef(
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
  ),
});

/** 0069 — 모집(offering) 경로: 한 학기에서 최대 3개 지망을 순서대로 */
const choicesSchema = z
  .array(
    z.object({
      offering_id: z.string().uuid(),
      selected_language: languageEnum,
      /** 폴백용 한국어 학과명 (DB 학과명을 우선) */
      target_department_label: z.string().max(200).optional(),
    })
  )
  .min(1)
  .max(MAX_PRIORITY);

export type CreateApplicationState =
  | {
      error?: string;
      fieldErrors?: Record<string, string[] | undefined>;
      /** 일부만 등록된 경우(중복 건너뜀) — 폼에 결과를 보여주고 이동은 사용자가 */
      notice?: string;
    }
  | undefined;

type ActiveApp = {
  id: string;
  offering_id: string | null;
  priority: number | null;
  status: string;
};

export async function createApplicationAction(
  studentId: string,
  _prev: CreateApplicationState,
  formData: FormData
): Promise<CreateApplicationState> {
  await verifyCenterSession();

  const locale = await getLocale();
  const t: T = (ko, vi) => tr(locale, ko, vi);

  const choicesRaw = formData.get("choices");
  if (typeof choicesRaw === "string" && choicesRaw.length > 0) {
    return createOfferingChoices(studentId, choicesRaw, t);
  }

  // --- 모집요강 직접 선택 (단건) ---
  const raw = Object.fromEntries(formData.entries());
  const parsed = createApplicationSchema(t).safeParse(raw);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;
  const supabase = await createCenterClient();

  // 0069: 지망 순위 = 그 학기의 다음 빈 번호 (이미 3개면 null — 직접 선택 경로는 막지 않는다)
  const term = data.term ?? null;
  let priority: number | null = null;
  {
    await renumberTermPriorities(studentId, term);
    const active = await loadActiveTermApps(supabase, studentId, term);
    if (active.length < MAX_PRIORITY) priority = active.length + 1;
  }

  // RLS 가 본인 org 학생 만 INSERT 허용 (study_applications.student_id → study_managed_students.org_id)
  const { error } = await supabase.from("study_applications").insert({
    student_id: studentId,
    admission_spec_id: data.admission_spec_id,
    offering_id: data.offering_id ?? null,
    selected_language: data.selected_language ?? null,
    target_department_id: data.target_department_id ?? null,
    target_department_label: data.target_department_label,
    term,
    priority,
    status: "payment_pending",
    next_action: data.next_action ?? null,
    next_deadline: data.next_deadline ?? null,
  });

  if (error) {
    return { error: `${t("지원 등록 실패", "Lỗi đăng ký nguyện vọng")}: ${error.message}` };
  }

  revalidatePath(`/center/students/${studentId}`);
  redirect(`/center/students/${studentId}`);
}

async function loadActiveTermApps(
  supabase: Awaited<ReturnType<typeof createCenterClient>>,
  studentId: string,
  term: string | null
): Promise<ActiveApp[]> {
  const base = supabase
    .from("study_applications")
    .select("id, offering_id, priority, status")
    .eq("student_id", studentId);
  const { data } = await (term ? base.eq("term", term) : base.is("term", null));
  return ((data ?? []) as ActiveApp[]).filter((a) => a.status !== "cancelled");
}

/**
 * 모집(offering) 경로 — 선택한 순서 = 지망 순위.
 *   · 모집 행은 서버에서 다시 읽는다(폼 값은 믿지 않는다): published + 모집요강 연결 + 같은 학기
 *   · 이미 (취소 안 된) 지원이 있는 모집은 건너뛰고 알린다
 *   · 그 학기에 이미 지원이 있으면 새 지원은 다음 순위부터, 합계 3개 초과면 막는다
 *   · 결제는 지원별 그대로 — 각 행 payment_pending
 */
async function createOfferingChoices(
  studentId: string,
  choicesRaw: string,
  t: T
): Promise<CreateApplicationState> {
  let json: unknown;
  try {
    json = JSON.parse(choicesRaw);
  } catch {
    json = null;
  }
  const parsed = choicesSchema.safeParse(json);
  if (!parsed.success) {
    return {
      error: t(
        "지망을 1~3개 고르고 각 지망의 어학 능력을 선택하세요.",
        "Chọn 1~3 nguyện vọng và chọn năng lực ngoại ngữ cho từng nguyện vọng."
      ),
    };
  }
  // 같은 모집을 두 번 고른 경우 첫 번째만
  const seen = new Set<string>();
  const choices = parsed.data.filter((c) => {
    if (seen.has(c.offering_id)) return false;
    seen.add(c.offering_id);
    return true;
  });

  const supabase = await createCenterClient();

  const { data: offerings } = await supabase
    .from("study_offerings")
    .select("id, department_id, term, source_spec_id, status")
    .in(
      "id",
      choices.map((c) => c.offering_id)
    );
  const offeringById = new Map((offerings ?? []).map((o) => [o.id, o]));
  for (const c of choices) {
    const o = offeringById.get(c.offering_id);
    if (!o || o.status !== "published" || !o.source_spec_id) {
      return {
        error: t(
          "모집 중이 아닌 학과가 포함되어 있습니다. 새로고침 후 다시 선택하세요.",
          "Có ngành không còn tuyển. Vui lòng tải lại trang và chọn lại."
        ),
      };
    }
  }
  const terms = new Set(choices.map((c) => offeringById.get(c.offering_id)!.term));
  if (terms.size !== 1) {
    return {
      error: t(
        "지망은 같은 학기 안에서만 고를 수 있습니다.",
        "Các nguyện vọng phải cùng một học kỳ."
      ),
    };
  }
  const term = Array.from(terms)[0];

  // 학과명(한국어) — 저장값(target_department_label). 옛 코드가 한국어로 비교하므로 번역 금지
  const deptIds = Array.from(
    new Set(choices.map((c) => offeringById.get(c.offering_id)!.department_id))
  );
  const { data: depts } = await supabase
    .from("departments")
    .select("id, name_ko")
    .in("id", deptIds);
  const deptName = new Map((depts ?? []).map((d) => [d.id, d.name_ko]));

  // 기존 지원 — 순위 먼저 1..n 으로 정리한 뒤 다시 읽는다
  await renumberTermPriorities(studentId, term);
  const active = await loadActiveTermApps(supabase, studentId, term);
  const appliedOfferings = new Set(
    active.map((a) => a.offering_id).filter((x): x is string => !!x)
  );

  const skipped: string[] = [];
  const toCreate = choices.filter((c) => {
    if (appliedOfferings.has(c.offering_id)) {
      const o = offeringById.get(c.offering_id)!;
      skipped.push(deptName.get(o.department_id) ?? c.target_department_label ?? `#${o.department_id}`);
      return false;
    }
    return true;
  });

  if (toCreate.length === 0) {
    return {
      error: `${t("이미 지원한 학과라 새로 등록한 지원이 없습니다", "Các ngành đã chọn đều đã đăng ký, không có nguyện vọng mới")}: ${skipped.join(", ")}`,
    };
  }

  if (active.length + toCreate.length > MAX_PRIORITY) {
    const left = Math.max(0, MAX_PRIORITY - active.length);
    return {
      error: t(
        `한 학기에 지망은 최대 ${MAX_PRIORITY}개입니다. 이 학생은 ${term} 학기에 이미 ${active.length}개 지원했으므로 ${left}개만 더 고를 수 있습니다.`,
        `Mỗi học kỳ tối đa ${MAX_PRIORITY} nguyện vọng. Sinh viên đã có ${active.length} nguyện vọng ở học kỳ ${term}, chỉ có thể chọn thêm ${left}.`
      ),
    };
  }

  const rows = toCreate.map((c, i) => {
    const o = offeringById.get(c.offering_id)!;
    return {
      student_id: studentId,
      admission_spec_id: o.source_spec_id as string,
      offering_id: o.id,
      selected_language: c.selected_language,
      target_department_id: o.department_id,
      target_department_label:
        deptName.get(o.department_id) ?? c.target_department_label ?? `학과 #${o.department_id}`,
      term: o.term,
      priority: active.length + i + 1,
      status: "payment_pending" as const,
      next_action: null,
      next_deadline: null,
    };
  });

  // RLS 가 본인 org 학생 만 INSERT 허용
  const { error } = await supabase.from("study_applications").insert(rows);
  if (error) {
    return { error: `${t("지원 등록 실패", "Lỗi đăng ký nguyện vọng")}: ${error.message}` };
  }

  revalidatePath(`/center/students/${studentId}`);
  revalidatePath(`/center/students/${studentId}/applications/new`);

  if (skipped.length > 0) {
    return {
      notice: t(
        `${rows.length}건을 등록했습니다. 이미 지원한 학과는 건너뛰었습니다: ${skipped.join(", ")}`,
        `Đã đăng ký ${rows.length} nguyện vọng. Bỏ qua ngành đã đăng ký: ${skipped.join(", ")}`
      ),
    };
  }
  redirect(`/center/students/${studentId}`);
}
