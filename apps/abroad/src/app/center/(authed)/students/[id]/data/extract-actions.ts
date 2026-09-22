"use server";

import { trAsync } from "@/lib/i18n";

import { verifyCenterSession } from "@/lib/center/dal";
import { createCenterClient } from "@/lib/supabase/center";
import type { Json } from "@/types/database";

import {
  extractFromRefs,
  gatherStudentFileRefs,
  loadExtractContext,
} from "./doc-extract-core";
import { CONF_RANK, displayValue, isEmptyValue } from "./extract-compare";

const MAX_DOCS = 12;

/** 운영자에게 보여줄 추출 제안 1건 */
export type ExtractProposal = {
  key: string;
  label_ko: string;
  label_vi: string;
  input_type: string;
  options: Array<{ value: string; label_ko: string; label_vi: string }> | null;
  /** 추출된 원본 값 (저장용) */
  proposedValue: Json;
  /** 화면 표시용 (select 면 라벨로 변환) */
  proposedDisplay: string;
  /** 현재 입력값 표시용 (없으면 null) */
  currentDisplay: string | null;
  /** 현재 비어있는지 — 기본 체크 여부 결정 */
  isCurrentEmpty: boolean;
  source: string | null;
  confidence: "high" | "medium" | "low";
};

export type ExtractDataResult =
  | {
      ok: true;
      proposals: ExtractProposal[];
      scannedDocs: number;
      /** 용량 예산 초과로 이번 분석에서 제외된 서류 수 */
      skippedDocs: number;
      raw: string;
    }
  | { ok: false; error: string };

/**
 * 학생이 업로드한 서류(제출서류 + 첨부 file 항목)에서 정보입력 값을 추출해
 *   **제안 목록**으로 반환한다 (저장은 안 함 — 운영자가 확인 후 적용).
 */
export async function extractStudentDataAction(
  studentId: string,
  /** filePath 를 주면 그 파일 하나만 읽는다 */
  options?: { filePath?: string }
): Promise<ExtractDataResult> {
  await verifyCenterSession();
  const supabase = await createCenterClient();

  // 권한: 이 학생이 내 org 인지 (RLS)
  const { data: student } = await supabase
    .from("study_managed_students")
    .select("id")
    .eq("id", studentId)
    .maybeSingle();
  if (!student) return { ok: false, error: await trAsync("이 학생에 대한 권한이 없습니다.", "Không có quyền với sinh viên này.") };

  // 1) 추출 대상 카탈로그 + 현재값
  const ctx = await loadExtractContext(supabase, studentId);

  // 2) 업로드된 서류 파일 (제출서류 + 첨부 file 항목)
  const fileRefs = await gatherStudentFileRefs(supabase, studentId, ctx);
  const onlyPath = options?.filePath;
  const pickedRefs = onlyPath
    ? fileRefs.filter((r) => r.path === onlyPath).slice(0, 1)
    : fileRefs.slice(0, MAX_DOCS);
  if (pickedRefs.length === 0) {
    return { ok: false, error: "NO_FILES" };
  }

  // 3) 다운로드 + AI 추출 (배치 분할·병합)
  const res = await extractFromRefs(pickedRefs, ctx.catalog);
  if (!res.ok) return res;

  // 4) 제안으로 변환 (현재값 비교, 표시 라벨)
  const proposals: ExtractProposal[] = [];
  for (const f of res.fields) {
    const dt = ctx.typeByKey.get(f.key);
    if (!dt) continue;
    const proposedValue = f.value as Json;
    const current = ctx.currentByKey.get(f.key) ?? null;
    const isCurrentEmpty = isEmptyValue(current);

    proposals.push({
      key: f.key,
      label_ko: dt.label_ko,
      label_vi: dt.label_vi,
      input_type: dt.input_type,
      options: dt.options,
      proposedValue,
      proposedDisplay: displayValue(proposedValue, dt.options),
      currentDisplay: isCurrentEmpty ? null : displayValue(current, dt.options),
      isCurrentEmpty,
      source: f.source,
      confidence: f.confidence,
    });
  }

  // 비어있는 항목 먼저, 그 다음 신뢰도 순
  proposals.sort((a, b) => {
    if (a.isCurrentEmpty !== b.isCurrentEmpty) return a.isCurrentEmpty ? -1 : 1;
    return CONF_RANK[a.confidence] - CONF_RANK[b.confidence];
  });

  return {
    ok: true,
    proposals,
    scannedDocs: res.scannedDocs,
    skippedDocs: res.skippedDocs,
    raw: res.raw,
  };
}
