/**
 * 업로드 서류 → 정보입력 값 추출의 내부 로직 (서버 전용, 세션 확인은 호출측 책임).
 *   - extractStudentDataAction(수동 'AI로 채우기')
 *   - syncDocExtractionsAction(정보 입력 화면 자동 읽기)
 *   - 정보 입력 page.tsx(서류와 다른 항목 계산)
 *   가 함께 쓴다.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

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
import type { Database, Json } from "@/types/database";

import { CONF_RANK } from "./extract-compare";

type Client = SupabaseClient<Database>;

export type ExtractTypeMeta = {
  key: string;
  label_ko: string;
  label_vi: string;
  category: string;
  input_type: string;
  options: Array<{ value: string; label_ko: string; label_vi: string }> | null;
  is_derived: boolean | null;
};

export type ExtractContext = {
  allTypes: ExtractTypeMeta[];
  /** 추출 대상 항목 (파일/서명/파생/작문 제외) */
  targetTypes: ExtractTypeMeta[];
  typeByKey: Map<string, ExtractTypeMeta>;
  catalog: ExtractFieldSpec[];
  currentByKey: Map<string, Json>;
};

/** 업로드 서류 1개 */
export type StudentFileRef = {
  label: string;
  path: string;
  file_name: string;
  /** 제출서류 doc_key, 또는 첨부 file 항목의 데이터 키 */
  doc_key: string | null;
};

const EXTRACTABLE_INPUT = new Set([
  "text",
  "long_text",
  "date",
  "number",
  "select",
  "multi_select",
]);

/** 추출 카탈로그 + 현재값 (RLS 클라이언트로 읽는다) */
export async function loadExtractContext(
  supabase: Client,
  studentId: string
): Promise<ExtractContext> {
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

  const allTypes = (dataTypes ?? []) as ExtractTypeMeta[];
  // 추출 가능 항목: 파일/서명/파생 제외 + essay 카테고리 제외(작문 기초자료라 문서추출 부적합)
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
  return { allTypes, targetTypes, typeByKey, catalog, currentByKey };
}

/**
 * 학생이 올린 서류 파일 목록 (제출서류 + 첨부 file 항목).
 *   경로의 학생 id 가 이 학생인 것만, 경로 중복 제거.
 */
export async function gatherStudentFileRefs(
  supabase: Client,
  studentId: string,
  ctx: Pick<ExtractContext, "allTypes" | "currentByKey">
): Promise<StudentFileRef[]> {
  const fileRefs: StudentFileRef[] = [];

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
    if (!f.file_path) continue;
    fileRefs.push({
      label:
        (f.submission_id ? subNameById.get(f.submission_id) : null) ??
        labelFromDocKey(f.doc_key) ??
        "제출서류",
      path: f.file_path,
      file_name: f.file_name,
      doc_key: f.doc_key ?? null,
    });
  }

  // (b) 첨부 file 항목 (document_* 등 file 타입 값)
  const fileTypeKeys = new Set(
    ctx.allTypes.filter((d) => d.input_type === "file").map((d) => d.key)
  );
  const fileLabelByKey = new Map(
    ctx.allTypes.map((d) => [d.key, d.label_ko] as const)
  );
  for (const [key, val] of ctx.currentByKey) {
    if (!fileTypeKeys.has(key)) continue;
    if (val && typeof val === "object" && !Array.isArray(val)) {
      const o = val as { path?: string; file_name?: string };
      if (o.path) {
        fileRefs.push({
          label: fileLabelByKey.get(key) ?? "첨부서류",
          path: o.path,
          file_name: o.file_name ?? "file",
          doc_key: key,
        });
      }
    }
  }

  // 경로 검증(org/학생/...) + 중복 제거
  const seen = new Set<string>();
  return fileRefs.filter((r) => {
    if (r.path.split("/")[1] !== studentId) return false;
    if (seen.has(r.path)) return false;
    seen.add(r.path);
    return true;
  });
}

export type ExtractFromRefsResult =
  | {
      ok: true;
      fields: ExtractedField[];
      scannedDocs: number;
      skippedDocs: number;
      raw: string;
    }
  | { ok: false; error: string };

/** 배치당 base64 예산 (Anthropic 32MB 한계 하회) */
const BATCH_B64 = 20 * 1024 * 1024;
const b64size = (n: number) => Math.ceil(n / 3) * 4;

/**
 * 서류들을 비공개 버킷에서 받아(service-role) AI 로 읽는다.
 *   오류 코드: "FILES_TOO_LARGE"(전부 한도 초과) / 그 외 메시지.
 */
export async function extractFromRefs(
  refs: StudentFileRef[],
  catalog: ExtractFieldSpec[]
): Promise<ExtractFromRefsResult> {
  const svc = createServiceClient();
  const downloaded: ExtractDocInput[] = [];
  let skippedDocs = 0;
  for (const ref of refs) {
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

  // 크기 예산으로 배치 분할 → 배치별 AI 추출 → 결과 병합
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
      if (!prev || CONF_RANK[f.confidence] < CONF_RANK[prev.confidence]) {
        merged.set(f.key, f);
      }
    }
  }
  if (!anyOk) return { ok: false, error: firstErr ?? "AI 추출 실패" };

  return {
    ok: true,
    fields: [...merged.values()],
    scannedDocs: downloaded.length,
    skippedDocs,
    raw: rawAll,
  };
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
