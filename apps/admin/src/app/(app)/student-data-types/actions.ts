"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
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

  if (id) {
    // UPDATE
    const patch: StudyStudentDataTypeUpdate = {
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
    };
    const { error } = await supabase
      .from("study_student_data_types")
      .update(patch)
      .eq("id", id);
    if (error) return { error: `DB UPDATE 실패: ${error.message}` };
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
  redirect("/student-data-types");
}

export async function deleteDataTypeAction(id: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // 해당 key 가 사용되는 양식의 required_data_type_keys 에서 제거
  // (PostgreSQL array 함수로 클라이언트에서 일괄 처리는 어려움 — 시드 데이터 보호 차원에서 우선 단순 삭제)
  await supabase.from("study_student_data_types").delete().eq("id", id);

  revalidatePath("/student-data-types");
  redirect("/student-data-types");
}
