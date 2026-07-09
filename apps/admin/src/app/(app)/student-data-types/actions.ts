"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import type {
  StudyStudentDataTypeInsert,
  StudyStudentDataTypeUpdate,
} from "@/types/database";

const CATEGORIES = [
  "identity",
  "education",
  "family",
  "financial",
  "language",
  "contact",
  "career",
  "essay",
  "document",
  "other",
] as const;

const INPUT_TYPES = [
  "text",
  "long_text",
  "date",
  "number",
  "select",
  "multi_select",
  "file",
  "boolean",
  "signature",
] as const;

const SCOPES = ["university_info", "document_fill"] as const;

const optionSchema = z.object({
  value: z.string().min(1),
  label_ko: z.string().min(1),
  label_vi: z.string().min(1),
});

const schema = z.object({
  key: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z][a-z0-9_]*$/, "snake_case 만 허용 (소문자/숫자/언더스코어)"),
  label_ko: z.string().min(1).max(200),
  label_vi: z.string().min(1).max(200),
  category: z.enum(CATEGORIES),
  input_type: z.enum(INPUT_TYPES),
  scope: z.enum(SCOPES),
  hint_ko: z.string().max(2000).nullable(),
  hint_vi: z.string().max(2000).nullable(),
  is_essay_basis: z.boolean(),
  is_default_required: z.boolean(),
  is_active: z.boolean(),
  sort_order: z.coerce.number().int().min(0).max(9999),
});

export type SaveDataTypeState =
  | {
      error?: string;
      fieldErrors?: Record<string, string>;
      /** 인라인 저장 성공 (화면 이동 없이) */
      ok?: boolean;
    }
  | undefined;

function emptyToNull(v: FormDataEntryValue | null): string | null {
  if (v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

export async function saveDataTypeAction(
  id: string | null,
  _prev: SaveDataTypeState,
  formData: FormData
): Promise<SaveDataTypeState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다" };

  const raw = {
    key: formData.get("key"),
    label_ko: formData.get("label_ko"),
    label_vi: formData.get("label_vi"),
    category: formData.get("category"),
    input_type: formData.get("input_type"),
    scope: formData.get("scope") || "document_fill",
    hint_ko: emptyToNull(formData.get("hint_ko")),
    hint_vi: emptyToNull(formData.get("hint_vi")),
    is_essay_basis: formData.get("is_essay_basis") === "on",
    is_default_required: formData.get("is_default_required") === "on",
    is_active: formData.get("is_active") === "on",
    sort_order: formData.get("sort_order") || "0",
  };

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0] ?? "");
      if (k && !fe[k]) fe[k] = issue.message;
    }
    return { fieldErrors: fe };
  }
  const data = parsed.data;

  // options 파싱
  let options: Array<{ value: string; label_ko: string; label_vi: string }> | null = null;
  if (data.input_type === "select" || data.input_type === "multi_select") {
    const optionsRaw = formData.get("options");
    if (typeof optionsRaw === "string" && optionsRaw.trim() !== "") {
      try {
        const parsedOpts = JSON.parse(optionsRaw);
        if (Array.isArray(parsedOpts) && parsedOpts.length > 0) {
          options = parsedOpts.map((o) => optionSchema.parse(o));
        }
      } catch (e) {
        return {
          fieldErrors: {
            options: `선택지 파싱 실패: ${
              e instanceof Error ? e.message : String(e)
            }`,
          },
        };
      }
    }
  }

  // aliases 파싱 (JSON 문자열 배열 — AI 매칭용 동의어)
  let aliases: string[] = [];
  const aliasesRaw = formData.get("aliases");
  if (typeof aliasesRaw === "string" && aliasesRaw.trim() !== "") {
    try {
      const a = JSON.parse(aliasesRaw);
      if (Array.isArray(a)) {
        aliases = a.map((x) => String(x).trim()).filter(Boolean);
      }
    } catch {
      // 파싱 실패 시 빈 배열
    }
  }

  // 연결성(참조/파생) 제거됨 — 모든 항목은 독립값. 기존 컬럼은 중립값으로 고정.
  const NEUTRAL_LINK = {
    link_type: "independent" as const,
    is_derived: false,
    derived_role: null,
    derived_from: null,
  };

  if (id) {
    // UPDATE (key 변경 허용 — 클라이언트에서 경고 후 제출)
    const patch: StudyStudentDataTypeUpdate = {
      key: data.key,
      label_ko: data.label_ko,
      label_vi: data.label_vi,
      category: data.category,
      input_type: data.input_type,
      options,
      hint_ko: data.hint_ko,
      hint_vi: data.hint_vi,
      is_essay_basis: data.is_essay_basis,
      is_default_required: data.is_default_required,
      is_active: data.is_active,
      sort_order: data.sort_order,
      scope: data.scope,
      aliases,
      ...NEUTRAL_LINK,
    };
    const { error } = await supabase
      .from("study_student_data_types")
      .update(patch)
      .eq("id", id);
    if (error) {
      if (error.code === "23505") {
        return { fieldErrors: { key: "이미 사용 중인 key 입니다" } };
      }
      return { error: `DB UPDATE 실패: ${error.message}` };
    }
  } else {
    // INSERT
    const ins: StudyStudentDataTypeInsert = {
      key: data.key,
      label_ko: data.label_ko,
      label_vi: data.label_vi,
      category: data.category,
      input_type: data.input_type,
      options,
      hint_ko: data.hint_ko,
      hint_vi: data.hint_vi,
      is_essay_basis: data.is_essay_basis,
      is_default_required: data.is_default_required,
      is_active: data.is_active,
      sort_order: data.sort_order,
      scope: data.scope,
      aliases,
      ...NEUTRAL_LINK,
    };
    const { error } = await supabase
      .from("study_student_data_types")
      .insert(ins);
    if (error) {
      if (error.code === "23505") {
        return { fieldErrors: { key: "이미 사용 중인 key 입니다" } };
      }
      return { error: `DB INSERT 실패: ${error.message}` };
    }
  }

  revalidatePath("/student-data-types");
  // 인라인 모드: 화면 이동 없이 성공만 반환
  if (formData.get("__inline") === "1") return { ok: true };
  redirect("/student-data-types");
}

export type DataTypeUsage = {
  ok: boolean;
  key: string;
  /** 학생이 입력한 값 행 수 (모든 org) */
  valueCount: number;
  /** required_data_type_keys 에 이 키를 포함하는 양식 수 */
  formCount: number;
  /** required_data_type_keys 에 이 키를 포함하는 직접제출 서류 수 */
  submissionCount: number;
  /** 이 키를 selector/원본으로 참조하는 파생 항목 라벨들 */
  derivedRefs: string[];
  total: number;
  error?: string;
};

/**
 * 표준데이터 삭제 전 사용처 집계 — 연결된 값·양식·직접제출·파생참조.
 *   service-role 로 전체(모든 org) 카운트.
 */
export async function getDataTypeUsageAction(
  id: string
): Promise<DataTypeUsage> {
  const empty: DataTypeUsage = {
    ok: false,
    key: "",
    valueCount: 0,
    formCount: 0,
    submissionCount: 0,
    derivedRefs: [],
    total: 0,
  };

  const supabaseUser = await createClient();
  const {
    data: { user },
  } = await supabaseUser.auth.getUser();
  if (!user) return { ...empty, error: "로그인이 필요합니다" };

  const admin = createAdminClient();

  const { data: row } = await admin
    .from("study_student_data_types")
    .select("key")
    .eq("id", id)
    .maybeSingle();
  if (!row) return { ...empty, error: "항목을 찾을 수 없습니다" };
  const key = row.key;

  const [valuesRes, formsRes] = await Promise.all([
    admin
      .from("study_student_data_values")
      .select("id", { count: "exact", head: true })
      .eq("data_type_key", key),
    admin
      .from("study_admission_form_files")
      .select("id", { count: "exact", head: true })
      .contains("required_data_type_keys", [key]),
  ]);

  // 참조(파생) 기능 제거됨 → 파생 참조 없음.
  const derivedRefs: string[] = [];

  const valueCount = valuesRes.count ?? 0;
  const formCount = formsRes.count ?? 0;
  // 발급서류 마스터 통합 삭제됨 → submission 참조 없음
  const submissionCount = 0;
  const total = valueCount + formCount + derivedRefs.length;

  return {
    ok: true,
    key,
    valueCount,
    formCount,
    submissionCount,
    derivedRefs,
    total,
  };
}

export type DataTypeMutationResult =
  | { ok: true }
  | { ok: false; error: string };

/** 재활성화 — is_active=true. 비활성 항목을 목록·입력에 다시 노출. */
export async function reactivateDataTypeAction(id: string): Promise<void> {
  const supabaseUser = await createClient();
  const {
    data: { user },
  } = await supabaseUser.auth.getUser();
  if (!user) return;

  const admin = createAdminClient();
  await admin
    .from("study_student_data_types")
    .update({ is_active: true })
    .eq("id", id);

  revalidatePath("/student-data-types");
}

/** 비활성화 (소프트 삭제) — is_active=false. 데이터 보존. */
export async function deactivateDataTypeAction(
  id: string
): Promise<DataTypeMutationResult> {
  const supabaseUser = await createClient();
  const {
    data: { user },
  } = await supabaseUser.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("study_student_data_types")
    .update({ is_active: false })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/student-data-types");
  return { ok: true };
}

/**
 * 표준데이터 삭제. 기본은 사용처가 있으면 거부(가드).
 *   force=true 일 때만 사용처가 있어도 강제 삭제.
 */
export async function deleteDataTypeAction(
  id: string,
  force = false
): Promise<DataTypeMutationResult> {
  const supabaseUser = await createClient();
  const {
    data: { user },
  } = await supabaseUser.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다" };

  if (!force) {
    const usage = await getDataTypeUsageAction(id);
    if (usage.ok && usage.total > 0) {
      return {
        ok: false,
        error:
          "연결된 데이터가 있어 삭제가 차단되었습니다. 비활성화하거나 강제 삭제를 선택하세요.",
      };
    }
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("study_student_data_types")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/student-data-types");
  return { ok: true };
}
