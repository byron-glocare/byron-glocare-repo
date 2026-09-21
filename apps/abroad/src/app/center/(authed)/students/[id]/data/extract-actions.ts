"use server";

import { trAsync } from "@/lib/i18n";

import { revalidatePath } from "next/cache";

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
  type ExtractedField,
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
  studentId: string,
  /** filePath 를 주면 그 파일 하나만 읽는다 (업로드 직후 자동 추출용) */
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

  // 한 파일만 (업로드 직후 자동 추출)
  const onlyPath = options?.filePath;
  const pickedRefs = onlyPath
    ? fileRefs.filter((r) => r.path === onlyPath).slice(0, 1)
    : fileRefs;

  if (pickedRefs.length === 0) {
    return { ok: false, error: "NO_FILES" };
  }

  // org 경로 검증 + 캡
  const safeRefs = pickedRefs
    .filter((r) => r.path.split("/")[1] === studentId)
    .slice(0, MAX_DOCS);

  // 3) 비공개 버킷에서 다운로드 (service-role).
  //    단일 문서가 한 배치(≈20MB)도 못 넘길 만큼 크면 제외(그 문서만).
  const BATCH_B64 = 20 * 1024 * 1024; // 배치당 base64 예산 (Anthropic 32MB 한계 하회)
  const b64size = (n: number) => Math.ceil(n / 3) * 4;
  const svc = createServiceClient();
  const downloaded: ExtractDocInput[] = [];
  let skippedDocs = 0;
  for (const ref of safeRefs) {
    const { data: blob, error } = await svc.storage
      .from(STUDENT_FILES_BUCKET)
      .download(ref.path);
    if (error || !blob) continue;
    const buffer = Buffer.from(await blob.arrayBuffer());
    if (b64size(buffer.length) > BATCH_B64) {
      skippedDocs += 1; // 문서 하나가 배치 한도를 초과 (사진 해상도↓ 후 재업로드 필요)
      continue;
    }
    downloaded.push({
      label: ref.label,
      mime: blob.type || guessMime(ref.file_name),
      data: buffer,
    });
  }

  if (downloaded.length === 0) {
    return {
      ok: false,
      error: skippedDocs > 0 ? "FILES_TOO_LARGE" : "다운로드 가능한 서류가 없습니다.",
    };
  }

  // 4) 크기 예산으로 배치 분할 → 배치별 AI 추출 → 결과 병합 (자동, 여러 번 나눠 호출).
  const batches: ExtractDocInput[][] = [];
  {
    let cur: ExtractDocInput[] = [];
    let curB64 = 0;
    for (const d of downloaded) {
      const b64 = b64size(d.data.length);
      if (cur.length > 0 && curB64 + b64 > BATCH_B64) {
        batches.push(cur);
        cur = [];
        curB64 = 0;
      }
      cur.push(d);
      curB64 += b64;
    }
    if (cur.length > 0) batches.push(cur);
  }

  const confRank = { high: 0, medium: 1, low: 2 } as const;
  const merged = new Map<string, ExtractedField>();
  let anyOk = false;
  let firstErr: string | null = null;
  let rawAll = "";
  for (const batch of batches) {
    const res = await extractStudentData({ docs: batch, catalog });
    if (!res.ok) {
      firstErr = res.error;
      continue;
    }
    anyOk = true;
    rawAll += (rawAll ? "\n" : "") + res.raw;
    for (const f of res.fields) {
      const prev = merged.get(f.key);
      // 같은 항목이 여러 배치에서 나오면 신뢰도 높은 값 우선
      if (!prev || confRank[f.confidence] < confRank[prev.confidence]) {
        merged.set(f.key, f);
      }
    }
  }
  if (!anyOk) return { ok: false, error: firstErr ?? "AI 추출 실패" };
  const extractedFields = [...merged.values()];

  // 5) 제안으로 변환 (현재값 비교, 표시 라벨)
  const proposals: ExtractProposal[] = [];
  for (const f of extractedFields) {
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

  // 비어있는 항목 먼저, 그 다음 신뢰도 순 (confRank 는 위에서 선언)
  proposals.sort((a, b) => {
    if (a.isCurrentEmpty !== b.isCurrentEmpty) return a.isCurrentEmpty ? -1 : 1;
    return confRank[a.confidence] - confRank[b.confidence];
  });

  return {
    ok: true,
    proposals,
    scannedDocs: downloaded.length,
    skippedDocs,
    raw: rawAll,
  };
}

/** 업로드 직후 자동 추출 결과 */
export type AutoExtractResult =
  | {
      ok: true;
      /** 비어 있어서 자동 저장한 항목 */
      applied: Array<{ key: string; label_ko: string; label_vi: string; display: string }>;
      /** 현재 값과 달라서 사용자 확인이 필요한 항목 */
      conflicts: ExtractProposal[];
    }
  | { ok: false; error: string };

/**
 * 제출서류 업로드 직후 (유학센터 전용) — **그 파일 하나만** 읽어서
 *   · 비어 있는 항목 → 바로 저장
 *   · 현재 값과 다른 항목 → conflicts 로 돌려줌 (화면에서 "교체 / 그대로 두기" 확인)
 *   · 같은 항목 → 아무것도 안 함
 */
export async function autoExtractUploadedFileAction(input: {
  studentId: string;
  docKey: string;
}): Promise<AutoExtractResult> {
  const session = await verifyCenterSession();
  const supabase = await createCenterClient();

  // 권한 + 방금 올린 파일 (RLS — 내 org 학생만 보인다)
  const { data: file } = await supabase
    .from("study_student_submission_files")
    .select("file_path")
    .eq("student_id", input.studentId)
    .eq("doc_key", input.docKey)
    .maybeSingle();
  if (!file?.file_path) {
    return { ok: false, error: await trAsync("업로드한 파일을 찾지 못했습니다.", "Không tìm thấy tệp vừa tải.") };
  }

  const res = await extractStudentDataAction(input.studentId, { filePath: file.file_path });
  if (!res.ok) return res;

  // 비교용 현재값 (제안의 currentDisplay 는 표시용 라벨이라 원값으로 다시 비교)
  const { data: values } = await supabase
    .from("study_student_data_values")
    .select("data_type_key, value")
    .eq("student_id", input.studentId);
  const currentByKey = new Map<string, Json>(
    (values ?? []).map((v) => [v.data_type_key, v.value as Json])
  );

  const applied: Array<{ key: string; label_ko: string; label_vi: string; display: string }> = [];
  const conflicts: ExtractProposal[] = [];
  const rows: Array<{ student_id: string; data_type_key: string; value: Json; filled_by: string }> = [];

  for (const p of res.proposals) {
    if (p.proposedValue === null || p.proposedValue === undefined || p.proposedValue === "") continue;
    // 빈 칸은 자동 저장하되, AI 신뢰도 "낮음"은 확인 창으로 돌린다(현재 값 "—" 로 보임).
    if (p.isCurrentEmpty && p.confidence === "low") {
      conflicts.push(p);
    } else if (p.isCurrentEmpty) {
      rows.push({
        student_id: input.studentId,
        data_type_key: p.key,
        value: p.proposedValue,
        filled_by: session.authUserId,
      });
      applied.push({ key: p.key, label_ko: p.label_ko, label_vi: p.label_vi, display: p.proposedDisplay });
    } else if (!sameValue(currentByKey.get(p.key) ?? null, p.proposedValue)) {
      conflicts.push(p);
    }
  }

  if (rows.length > 0) {
    const { error } = await supabase
      .from("study_student_data_values")
      .upsert(rows, { onConflict: "student_id,data_type_key" });
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/center/students/${input.studentId}/data`);
  }

  return { ok: true, applied, conflicts };
}

/** 두 값이 사실상 같은가 — 공백·대소문자·천 단위 쉼표·날짜 0 채움 차이는 무시 */
function sameValue(a: Json, b: Json): boolean {
  const canon = (v: Json): string => {
    if (v === null || v === undefined) return "";
    if (Array.isArray(v)) return v.map((x) => canon(x as Json)).sort().join("|");
    if (typeof v === "number") return String(v);
    const s = String(v).trim().toLowerCase().replace(/\s+/g, " ");
    const d = /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/.exec(s);
    if (d) return `${d[1]}-${d[2].padStart(2, "0")}-${d[3].padStart(2, "0")}`;
    if (/^-?[\d,]+(\.\d+)?$/.test(s)) {
      const n = Number(s.replace(/,/g, ""));
      if (Number.isFinite(n)) return String(n);
    }
    return s;
  };
  return canon(a) === canon(b);
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
