"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isGlocareAdmin } from "@/lib/admin-guard";

export type DocStdType = {
  key: string;
  label_ko: string;
  label_vi: string | null;
  aliases: string[];
};

export type DocStdResult =
  | { ok: true; type: DocStdType }
  | { ok: false; error: string };

async function guard(): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };
  if (!isGlocareAdmin(user)) return { ok: false, error: "권한이 없습니다." };
  return { ok: true };
}

/** 정규화(별칭/중복 판별용) — 공백·괄호·구두점 제거 + 소문자 */
function norm(s: string | null | undefined): string {
  return (s || "")
    .replace(/[\s　]+/g, "")
    .replace(/[()[\]{}<>:：·・,.\/*\-_~"'’“”|]/g, "")
    .toLowerCase();
}

/** 안정적 key 생성 (한글 이름도 결정적으로) */
function hashKey(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return "doc_" + (h >>> 0).toString(36);
}

/**
 * 표준 발급서류(표준데이터 category=document)를 새로 추가.
 *   같은 이름(정규화)이 이미 있으면 그걸 반환(멱등).
 */
export async function addDocumentDataTypeAction(input: {
  name_ko: string;
  name_vi?: string | null;
}): Promise<DocStdResult> {
  const g = await guard();
  if (!g.ok) return g;
  const name_ko = (input.name_ko || "").trim();
  if (!name_ko) return { ok: false, error: "서류명을 입력하세요." };

  const admin = createAdminClient();

  // 이미 같은 이름/별칭이 있으면 재사용
  const { data: existing } = await admin
    .from("study_student_data_types")
    .select("key, label_ko, label_vi, aliases")
    .eq("category", "document")
    .eq("is_active", true);
  const n = norm(name_ko);
  for (const t of existing ?? []) {
    const names = [t.label_ko, ...((t.aliases as string[] | null) ?? [])];
    if (names.some((x) => norm(x) === n)) {
      return {
        ok: true,
        type: {
          key: t.key,
          label_ko: t.label_ko ?? "",
          label_vi: t.label_vi,
          aliases: (t.aliases as string[] | null) ?? [],
        },
      };
    }
  }

  const { data: maxRow } = await admin
    .from("study_student_data_types")
    .select("sort_order")
    .eq("category", "document")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sortOrder = (maxRow?.sort_order ?? 0) + 10;

  const key = hashKey(n);
  const { data: inserted, error } = await admin
    .from("study_student_data_types")
    .insert({
      key,
      label_ko: name_ko,
      label_vi: (input.name_vi || "").trim() || name_ko,
      category: "document",
      input_type: "file",
      is_default_required: false,
      is_active: true,
      sort_order: sortOrder,
    })
    .select("key, label_ko, label_vi, aliases")
    .single();
  if (error || !inserted) {
    // key 충돌(이미 존재) 시 그 행 반환
    if (error?.code === "23505") {
      const { data: row } = await admin
        .from("study_student_data_types")
        .select("key, label_ko, label_vi, aliases")
        .eq("key", key)
        .maybeSingle();
      if (row) {
        return {
          ok: true,
          type: {
            key: row.key,
            label_ko: row.label_ko ?? "",
            label_vi: row.label_vi,
            aliases: (row.aliases as string[] | null) ?? [],
          },
        };
      }
    }
    return { ok: false, error: error?.message ?? "추가 실패" };
  }

  return {
    ok: true,
    type: {
      key: inserted.key,
      label_ko: inserted.label_ko ?? "",
      label_vi: inserted.label_vi,
      aliases: (inserted.aliases as string[] | null) ?? [],
    },
  };
}

/**
 * 기존 표준 발급서류에 별칭 추가 (변형 이름을 같은 표준으로 통합).
 */
export async function addAliasToDataTypeAction(input: {
  key: string;
  alias: string;
}): Promise<DocStdResult> {
  const g = await guard();
  if (!g.ok) return g;
  const alias = (input.alias || "").trim();
  if (!input.key || !alias) return { ok: false, error: "입력이 올바르지 않습니다." };

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("study_student_data_types")
    .select("key, label_ko, label_vi, aliases")
    .eq("key", input.key)
    .maybeSingle();
  if (!row) return { ok: false, error: "표준 서류를 찾을 수 없습니다." };

  const cur = (row.aliases as string[] | null) ?? [];
  const has =
    norm(row.label_ko) === norm(alias) || cur.some((a) => norm(a) === norm(alias));
  const next = has ? cur : [...cur, alias];
  if (!has) {
    const { error } = await admin
      .from("study_student_data_types")
      .update({ aliases: next })
      .eq("key", input.key);
    if (error) return { ok: false, error: error.message };
  }

  return {
    ok: true,
    type: {
      key: row.key,
      label_ko: row.label_ko ?? "",
      label_vi: row.label_vi,
      aliases: next,
    },
  };
}
