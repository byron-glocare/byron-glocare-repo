"use server";

/**
 * 정보 입력 화면의 "업로드 서류 자동 읽기" (운영 결정 2026-09-22).
 *
 *   업로드할 때마다 "교체할까요?" 를 묻지 않는다. 대신 유학센터가 학생의 '정보 입력'을
 *   열면 아직 안 읽은 서류를 읽어(study_student_doc_extractions 에 기록) 빈 칸을 채우고,
 *   현재 값과 다른 항목은 항목별로 표시해 운영자가 바꾸거나 무시한다.
 *
 *   study_student_doc_extractions 는 RLS 정책이 없다 → resolveDataAccess 로 센터 권한과
 *   학생 가시성(RLS)을 확인한 뒤 service-role 로만 접근한다. 셀프 학생 세션은 대상 아님.
 */

import { trAsync } from "@/lib/i18n";
import { resolveDataAccess, type DataAccess } from "@/lib/student/data-access";
import { createServiceClient } from "@/lib/supabase/service";
import { isFixedKey } from "@/lib/fixed-values";
import type { Json } from "@/types/database";

import {
  extractFromRefs,
  gatherStudentFileRefs,
  loadExtractContext,
} from "./doc-extract-core";
import {
  CONF_RANK,
  displayValue,
  isEmptyValue,
  parseStoredProposals,
  type StoredDocProposal,
} from "./extract-compare";

/** 한 번 호출에 읽는 최대 서류 수 (호출측이 remaining > 0 인 동안 반복 호출) */
const FILES_PER_CALL = 2;

export type FilledField = {
  key: string;
  label_ko: string;
  label_vi: string;
  display: string;
  value: Json;
};

export type SyncDocExtractionsResult =
  | { ok: true; processed: number; remaining: number; filled: FilledField[] }
  | { ok: false; error: string };

export type DocSuggestionActionResult = { ok: true } | { ok: false; error: string };

/** 센터 세션 + 이 학생이 내게 보이는지. 셀프 학생이면 null. */
async function centerAccess(
  studentId: string
): Promise<{ access: DataAccess } | { error: string } | null> {
  let access: DataAccess;
  try {
    access = await resolveDataAccess(studentId);
  } catch {
    return { error: await trAsync("이 학생에 대한 권한이 없습니다.", "Không có quyền với sinh viên này.") };
  }
  if (access.kind !== "center") return null;
  const { data: student } = await access.supabase
    .from("study_managed_students")
    .select("id")
    .eq("id", studentId)
    .maybeSingle();
  if (!student) {
    return { error: await trAsync("이 학생에 대한 권한이 없습니다.", "Không có quyền với sinh viên này.") };
  }
  return { access };
}

/**
 * 아직 안 읽은 업로드 서류를 최대 2개 읽고, 빈 항목을 자동으로 채운다.
 *   remaining > 0 이면 호출측이 다시 부른다.
 */
export async function syncDocExtractionsAction(
  studentId: string
): Promise<SyncDocExtractionsResult> {
  const gate = await centerAccess(studentId);
  if (gate === null) return { ok: true, processed: 0, remaining: 0, filled: [] };
  if ("error" in gate) return { ok: false, error: gate.error };
  const { access } = gate;
  const supabase = access.supabase;
  const svc = createServiceClient();

  const ctx = await loadExtractContext(supabase, studentId);
  const refs = await gatherStudentFileRefs(supabase, studentId, ctx);
  const refPaths = new Set(refs.map((r) => r.path));

  const { data: existing, error: exErr } = await svc
    .from("study_student_doc_extractions")
    .select("id, file_path")
    .eq("student_id", studentId);
  if (exErr) return { ok: false, error: exErr.message };

  // 교체·삭제돼 더 이상 없는 파일의 기록은 정리 (그 서류의 "다름" 표시가 남지 않게)
  const staleIds = (existing ?? [])
    .filter((r) => !refPaths.has(r.file_path))
    .map((r) => r.id);
  if (staleIds.length > 0) {
    await svc.from("study_student_doc_extractions").delete().in("id", staleIds);
  }

  const known = new Set((existing ?? []).map((r) => r.file_path));
  const unread = refs.filter((r) => !known.has(r.path));
  const batch = unread.slice(0, FILES_PER_CALL);

  for (const ref of batch) {
    let row: {
      status: "done" | "failed";
      proposals: StoredDocProposal[];
      error: string | null;
    };
    try {
      const res = await extractFromRefs([ref], ctx.catalog);
      if (res.ok) {
        const proposals: StoredDocProposal[] = [];
        for (const f of res.fields) {
          const dt = ctx.typeByKey.get(f.key);
          if (!dt) continue;
          const value = f.value as Json;
          proposals.push({
            key: f.key,
            value,
            display: displayValue(value, dt.options),
            confidence: f.confidence,
            source: f.source,
          });
        }
        row = { status: "done", proposals, error: null };
      } else {
        row = {
          status: "failed",
          proposals: [],
          error:
            res.error === "FILES_TOO_LARGE"
              ? "파일이 너무 커서 읽지 않았습니다 (약 15MB 초과). 사진 해상도를 낮춰 다시 올려 주세요."
              : res.error,
        };
      }
    } catch (e) {
      row = {
        status: "failed",
        proposals: [],
        error: e instanceof Error ? e.message : String(e),
      };
    }

    const { error: upErr } = await svc.from("study_student_doc_extractions").upsert(
      {
        student_id: studentId,
        file_path: ref.path,
        doc_key: ref.doc_key,
        file_name: ref.file_name,
        status: row.status,
        proposals: row.proposals,
        dismissed_keys: [],
        error: row.error,
        extracted_at: new Date().toISOString(),
      },
      { onConflict: "student_id,file_path" }
    );
    if (upErr) return { ok: false, error: upErr.message };
  }

  const processed = batch.length;
  const remaining = unread.length - batch.length;

  // 새로 읽은 서류가 있을 때만 빈 칸 자동 채움 (운영자가 일부러 비운 칸을 매번 되살리지 않게)
  const filled: FilledField[] = [];
  if (processed > 0) {
    const { data: doneRows, error: doneErr } = await svc
      .from("study_student_doc_extractions")
      .select("id, file_path, proposals, dismissed_keys, extracted_at")
      .eq("student_id", studentId)
      .eq("status", "done");
    if (doneErr) return { ok: false, error: doneErr.message };

    // 빈 항목별 최선의 제안: 신뢰도 높은 것 → 최신 추출
    const best = new Map<string, { p: StoredDocProposal; at: string }>();
    for (const r of doneRows ?? []) {
      if (!refPaths.has(r.file_path)) continue;
      const dismissed = new Set(r.dismissed_keys ?? []);
      for (const p of parseStoredProposals(r.proposals)) {
        if (p.confidence === "low") continue;
        if (dismissed.has(p.key) || isFixedKey(p.key)) continue;
        if (!ctx.typeByKey.has(p.key)) continue;
        if (!isEmptyValue(ctx.currentByKey.get(p.key) ?? null)) continue;
        const prev = best.get(p.key);
        if (
          !prev ||
          CONF_RANK[p.confidence] < CONF_RANK[prev.p.confidence] ||
          (CONF_RANK[p.confidence] === CONF_RANK[prev.p.confidence] &&
            r.extracted_at > prev.at)
        ) {
          best.set(p.key, { p, at: r.extracted_at });
        }
      }
    }

    if (best.size > 0) {
      const rows = [...best.values()].map(({ p }) => ({
        student_id: studentId,
        data_type_key: p.key,
        value: p.value,
        value_input: null,
        filled_by: access.authUserId,
      }));
      const { error } = await supabase
        .from("study_student_data_values")
        .upsert(rows, { onConflict: "student_id,data_type_key" });
      if (error) return { ok: false, error: error.message };
      for (const { p } of best.values()) {
        const dt = ctx.typeByKey.get(p.key)!;
        filled.push({
          key: p.key,
          label_ko: dt.label_ko,
          label_vi: dt.label_vi,
          display: p.display,
          value: p.value,
        });
      }
      // revalidate 는 하지 않는다 — 호출측이 반복 호출을 마친 뒤 한 번 router.refresh().
    }
  }

  return { ok: true, processed, remaining, filled };
}

/** 서류에서 읽은 값으로 교체 — 값은 클라이언트가 아니라 DB 의 추출 기록에서 다시 읽는다. */
export async function applyDocSuggestionAction(input: {
  studentId: string;
  key: string;
  extractionId: string;
}): Promise<DocSuggestionActionResult> {
  const gate = await centerAccess(input.studentId);
  if (gate === null) return { ok: false, error: await trAsync("권한이 없습니다.", "Không có quyền.") };
  if ("error" in gate) return { ok: false, error: gate.error };
  const { access } = gate;

  if (isFixedKey(input.key)) {
    return { ok: false, error: await trAsync("고정값 항목은 바꿀 수 없습니다.", "Không thể đổi mục cố định.") };
  }

  const svc = createServiceClient();
  const { data: row } = await svc
    .from("study_student_doc_extractions")
    .select("id, proposals")
    .eq("id", input.extractionId)
    .eq("student_id", input.studentId)
    .eq("status", "done")
    .maybeSingle();
  const proposal = row
    ? parseStoredProposals(row.proposals).find((p) => p.key === input.key)
    : undefined;
  if (!proposal) {
    return { ok: false, error: await trAsync("서류에서 읽은 값을 찾지 못했습니다. 새로고침해 주세요.", "Không tìm thấy giá trị từ giấy tờ. Vui lòng tải lại trang.") };
  }

  // 원문(value_input)은 비운다 — 이전 번역 원문이 남으면 "번역 전" 표시가 틀린다.
  const { error } = await access.supabase.from("study_student_data_values").upsert(
    {
      student_id: input.studentId,
      data_type_key: input.key,
      value: proposal.value,
      value_input: null,
      filled_by: access.authUserId,
    },
    { onConflict: "student_id,data_type_key" }
  );
  if (error) return { ok: false, error: error.message };

  access.revalidateData(input.studentId);
  return { ok: true };
}

/** "무시" — 그 서류의 그 항목은 다시 표시하지 않는다. */
export async function dismissDocSuggestionAction(input: {
  studentId: string;
  key: string;
  extractionId: string;
}): Promise<DocSuggestionActionResult> {
  const gate = await centerAccess(input.studentId);
  if (gate === null) return { ok: false, error: await trAsync("권한이 없습니다.", "Không có quyền.") };
  if ("error" in gate) return { ok: false, error: gate.error };
  const { access } = gate;

  const svc = createServiceClient();
  const { data: row } = await svc
    .from("study_student_doc_extractions")
    .select("id, dismissed_keys")
    .eq("id", input.extractionId)
    .eq("student_id", input.studentId)
    .maybeSingle();
  if (!row) {
    return { ok: false, error: await trAsync("기록을 찾지 못했습니다. 새로고침해 주세요.", "Không tìm thấy bản ghi. Vui lòng tải lại trang.") };
  }
  const keys = row.dismissed_keys ?? [];
  if (!keys.includes(input.key)) {
    const { error } = await svc
      .from("study_student_doc_extractions")
      .update({ dismissed_keys: [...keys, input.key] })
      .eq("id", row.id);
    if (error) return { ok: false, error: error.message };
  }

  access.revalidateData(input.studentId);
  return { ok: true };
}

/** 서류 전부 다시 읽기 — 기록을 지우면 다음 동기화가 모든 서류를 새로 읽는다. */
export async function rereadAllDocsAction(
  studentId: string
): Promise<DocSuggestionActionResult> {
  const gate = await centerAccess(studentId);
  if (gate === null) return { ok: false, error: await trAsync("권한이 없습니다.", "Không có quyền.") };
  if ("error" in gate) return { ok: false, error: gate.error };

  const svc = createServiceClient();
  const { error } = await svc
    .from("study_student_doc_extractions")
    .delete()
    .eq("student_id", studentId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
