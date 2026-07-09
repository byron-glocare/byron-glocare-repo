"use server";

import { verifyCenterSession } from "@/lib/center/dal";
import { createCenterClient } from "@/lib/supabase/center";
import {
  createServiceClient,
  STUDENT_FILES_BUCKET,
} from "@/lib/supabase/service";
import {
  extractStudentData,
  type ExtractDocInput,
  type ExtractFieldSpec,
} from "@/lib/admission/extract-student-data";
import type { Json } from "@/types/database";

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
  studentId: string
): Promise<ExtractDataResult> {
  const session = await verifyCenterSession();
  const supabase = await createCenterClient();

  // 권한: 이 학생이 내 org 인지 (RLS)
  const { data: student } = await supabase
    .from("study_managed_students")
    .select("id")
    .eq("id", studentId)
    .maybeSingle();
  if (!student) return { ok: false, error: "Không có quyền với sinh viên này." };

  // 1) 추출 대상 카탈로그 + 현재값 로드
  const [{ data: dataTypes }, { data: values }] = await Promise.all([
    supabase
      .from("study_student_data_types")
      .select("key, label_ko, label_vi, category, input_type, options, is_derived")
      .eq("is_active", true)
      .order("category")
      .order("sort_order"),
    supabase
      .from("study_student_data_values")
      .select("data_type_key, value")
      .eq("student_id", studentId),
  ]);

  type DT = {
    key: string;
    label_ko: string;
    label_vi: string;
    category: string;
    input_type: string;
    options: Array<{ value: string; label_ko: string; label_vi: string }> | null;
    is_derived: boolean | null;
  };
  const allTypes = (dataTypes ?? []) as DT[];

  // 추출 가능 항목: 파일/서명/파생 제외 + essay 카테고리 제외(작문 기초자료라 문서추출 부적합)
  const EXTRACTABLE_INPUT = new Set([
    "text",
    "long_text",
    "date",
    "number",
    "select",
    "multi_select",
  ]);
  const targetTypes = allTypes.filter(
    (d) =>
      !d.is_derived &&
      d.category !== "essay" &&
      EXTRACTABLE_INPUT.has(d.input_type)
  );
  const typeByKey = new Map(targetTypes.map((d) => [d.key, d]));

  const catalog: ExtractFieldSpec[] = targetTypes.map((d) => ({
    key: d.key,
    label_ko: d.label_ko,
    input_type: d.input_type,
    options: d.options?.map((o) => ({ value: o.value, label_ko: o.label_ko })) ?? null,
  }));

  const currentByKey = new Map<string, Json>(
    (values ?? []).map((v) => [v.data_type_key, v.value as Json])
  );

  // 2) 업로드된 서류 파일 수집 (제출서류 + 첨부 file 항목)
  type FileRef = { label: string; path: string; file_name: string };
  const fileRefs: FileRef[] = [];

  // (a) 제출서류 업로드 (모집요강 doc_key 기반 + 레거시 submission_id 기반 모두)
  const { data: subFiles } = await supabase
    .from("study_student_submission_files")
    .select("submission_id, doc_key, file_path, file_name")
    .eq("student_id", studentId);
  const subIds = Array.from(
    new Set((subFiles ?? []).map((f) => f.submission_id).filter(Boolean))
  ) as string[];
  const subNameById = new Map<string, string>();
  if (subIds.length > 0) {
    const { data: subs } = await supabase
      .from("study_required_submissions")
      .select("id, name_ko")
      .in("id", subIds);
    for (const s of subs ?? []) subNameById.set(s.id, s.name_ko);
  }
  // doc_key = "key::이름" → 라벨은 이름 부분
  const labelFromDocKey = (dk: string | null): string | null => {
    if (!dk) return null;
    const idx = dk.indexOf("::");
    return idx >= 0 ? dk.slice(idx + 2) : dk;
  };
  for (const f of subFiles ?? []) {
    fileRefs.push({
      label:
        (f.submission_id ? subNameById.get(f.submission_id) : null) ??
        labelFromDocKey(f.doc_key) ??
        "제출서류",
      path: f.file_path,
      file_name: f.file_name,
    });
  }

  // (b) 첨부 file 항목 (document_* 등 file 타입 값)
  const fileTypeKeys = new Set(
    allTypes.filter((d) => d.input_type === "file").map((d) => d.key)
  );
  const fileLabelByKey = new Map(
    allTypes.map((d) => [d.key, d.label_ko] as const)
  );
  for (const [key, val] of currentByKey) {
    if (!fileTypeKeys.has(key)) continue;
    if (val && typeof val === "object" && !Array.isArray(val)) {
      const o = val as { path?: string; file_name?: string };
      if (o.path) {
        fileRefs.push({
          label: fileLabelByKey.get(key) ?? "첨부서류",
          path: o.path,
          file_name: o.file_name ?? "file",
        });
      }
    }
  }

  if (fileRefs.length === 0) {
    return { ok: false, error: "NO_FILES" };
  }

  // org 경로 검증 + 캡
  const safeRefs = fileRefs
    .filter((r) => r.path.startsWith(`${session.org.id}/`))
    .slice(0, MAX_DOCS);

  // 3) 비공개 버킷에서 다운로드 (service-role) + 요청 크기 예산 관리.
  //    Anthropic 한 요청 크기 한계(32MB) 초과 시 413(request_too_large) → 여기서 예방.
  //    문서를 base64 로 실어 보내므로 누적 base64 가 예산을 넘으면 그 서류는 제외한다.
  const MAX_TOTAL_B64 = 22 * 1024 * 1024; // 안전 예산 (32MB 한계 하회)
  const MAX_PER_DOC_B64 = 18 * 1024 * 1024; // 단일 문서 상한
  const svc = createServiceClient();
  const docs: ExtractDocInput[] = [];
  let totalB64 = 0;
  let skippedDocs = 0;
  for (const ref of safeRefs) {
    const { data: blob, error } = await svc.storage
      .from(STUDENT_FILES_BUCKET)
      .download(ref.path);
    if (error || !blob) continue;
    const buffer = Buffer.from(await blob.arrayBuffer());
    const b64 = Math.ceil(buffer.length / 3) * 4; // base64 크기 추정
    if (b64 > MAX_PER_DOC_B64 || totalB64 + b64 > MAX_TOTAL_B64) {
      skippedDocs += 1;
      continue;
    }
    totalB64 += b64;
    docs.push({
      label: ref.label,
      mime: blob.type || guessMime(ref.file_name),
      data: buffer,
    });
  }

  if (docs.length === 0) {
    return {
      ok: false,
      error: skippedDocs > 0 ? "FILES_TOO_LARGE" : "다운로드 가능한 서류가 없습니다.",
    };
  }

  // 4) AI 추출
  const res = await extractStudentData({ docs, catalog });
  if (!res.ok) return { ok: false, error: res.error };

  // 5) 제안으로 변환 (현재값 비교, 표시 라벨)
  const proposals: ExtractProposal[] = [];
  for (const f of res.fields) {
    const dt = typeByKey.get(f.key);
    if (!dt) continue;
    const proposedValue = f.value as Json;
    const current = currentByKey.get(f.key) ?? null;
    const isCurrentEmpty =
      current === null ||
      current === undefined ||
      current === "" ||
      (Array.isArray(current) && current.length === 0);

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
  const confRank = { high: 0, medium: 1, low: 2 } as const;
  proposals.sort((a, b) => {
    if (a.isCurrentEmpty !== b.isCurrentEmpty) return a.isCurrentEmpty ? -1 : 1;
    return confRank[a.confidence] - confRank[b.confidence];
  });

  return {
    ok: true,
    proposals,
    scannedDocs: docs.length,
    skippedDocs,
    raw: res.raw,
  };
}

function displayValue(
  v: Json,
  options: Array<{ value: string; label_ko: string }> | null
): string {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) {
    return v
      .map((x) => labelFor(String(x), options))
      .join(", ");
  }
  return labelFor(String(v), options);
}

function labelFor(
  value: string,
  options: Array<{ value: string; label_ko: string }> | null
): string {
  const opt = options?.find((o) => o.value === value);
  return opt ? `${opt.label_ko}` : value;
}

function guessMime(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "pdf":
      return "application/pdf";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    default:
      return "application/octet-stream";
  }
}
