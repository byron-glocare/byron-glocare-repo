/**
 * 학생 등록 값 → study_student_data_values 저장 (센터 개별 등록 · 엑셀 일괄 등록 공용).
 *
 *   saveStudentDataValueAction 과 같은 행 모양 (student_id, data_type_key, value, filled_by).
 *   value_input 은 넣지 않는다 (없으면 최종값과 같은 것으로 취급).
 *   호출측이 학생 소유를 확인한 뒤(방금 자기 org 로 insert) service client 로 부른다.
 *   카탈로그에 없는 키(마이그레이션 미실행 등)는 건너뛴다 — FK/무의미 행 방지.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";

type Client = SupabaseClient<Database>;

/** 활성 데이터 항목 키 집합 (일괄 등록에서 한 번만 읽기용) */
export async function loadKnownDataKeys(
  svc: Client,
  keys: string[]
): Promise<Set<string>> {
  if (keys.length === 0) return new Set();
  const { data } = await svc
    .from("study_student_data_types")
    .select("key")
    .in("key", Array.from(new Set(keys)));
  return new Set((data ?? []).map((t) => t.key));
}

export async function writeRegistrationValues(
  svc: Client,
  input: {
    studentId: string;
    values: Record<string, Json>;
    filledBy: string | null;
    knownKeys?: Set<string>;
  }
): Promise<{ ok: true; saved: string[]; skipped: string[] } | { ok: false; error: string }> {
  const entries = Object.entries(input.values).filter(
    ([, v]) => v !== null && v !== undefined && v !== ""
  );
  if (entries.length === 0) return { ok: true, saved: [], skipped: [] };

  const known =
    input.knownKeys ??
    (await loadKnownDataKeys(
      svc,
      entries.map(([k]) => k)
    ));

  const rows = entries
    .filter(([k]) => known.has(k))
    .map(([k, v]) => ({
      student_id: input.studentId,
      data_type_key: k,
      value: v,
      filled_by: input.filledBy,
    }));
  const skipped = entries.filter(([k]) => !known.has(k)).map(([k]) => k);
  if (rows.length === 0) return { ok: true, saved: [], skipped };

  const { error } = await svc
    .from("study_student_data_values")
    .upsert(rows, { onConflict: "student_id,data_type_key" });
  if (error) return { ok: false, error: error.message };
  return { ok: true, saved: rows.map((r) => r.data_type_key), skipped };
}
