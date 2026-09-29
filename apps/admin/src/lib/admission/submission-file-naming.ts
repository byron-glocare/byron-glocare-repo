/**
 * 학생이 올린 제출서류의 **서류 종류 이름**과 **다운로드 파일명**.
 *
 *   업로드 파일은 센터 직원이 준 이름 그대로 저장된다(`Lan - Hộ chiếu.pdf` 등).
 *   어드민이 대학에 보낼 때는 규칙 파일명이어야 하고, 화면에서는 이 파일이 무슨 서류인지
 *   보여야 한다. doc_key 만으로는 사람이 못 읽으니(`std::doc_lhf25z::translation_notarization::mother`)
 *   여기서 서류 카탈로그 이름 + 대상자로 풀어준다.
 *
 *   doc_key 형식 두 가지 (abroad 의 docShareKey/docUploadKey 와 짝):
 *     새: `std::<표준서류키>::<인증>[::<대상자>]`   — 대상자는 self/미지정이면 빠진다
 *     옛: `<항목키>::<서류이름>`                   — 이름이 키 안에 들어 있다
 *
 *   파일명 규칙은 기존 가이드와 같다(C_CORE_WORKFLOW_REDESIGN §C6):
 *     `서류명_이름(영문 대문자)_대학_학과_학기.확장자`
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import { TARGET_LABEL_KO } from "./spec-doc-items";

type Client = SupabaseClient<Database>;

/** doc_key 하나를 사람이 읽을 수 있게 푼 결과 */
export type DocKindInfo = {
  /** 서류 이름 (모집요강·서류 카탈로그에 등록된 이름) */
  name: string;
  /** 대상자 라벨 — 본인이면 null */
  targetLabel: string | null;
  /** 화면·파일명에 쓰는 이름. 대상자가 있으면 `여권 사본(어머니)` */
  label: string;
};

/** doc_key 를 표준서류키·대상자로 쪼갠다 */
function parseDocKey(docKey: string): {
  stdKey: string | null;
  target: string | null;
  legacyName: string | null;
} {
  if (docKey.startsWith("std::")) {
    const parts = docKey.split("::");
    return { stdKey: parts[1] || null, target: parts[3] || null, legacyName: null };
  }
  const idx = docKey.indexOf("::");
  return {
    stdKey: null,
    target: null,
    legacyName: idx >= 0 ? docKey.slice(idx + 2).trim() || null : docKey.trim() || null,
  };
}

/**
 * doc_key 목록 → 서류 종류 이름.
 *   표준 서류(`std::`)는 `study_doc_standards.name_ko`, 없으면 `study_doc_items.name_ko` 로 찾는다.
 *   둘 다 없으면(폐기된 키 등) 키를 그대로 보여준다 — 숨기면 어떤 서류인지 아예 알 수 없다.
 */
export async function resolveDocKinds(
  supabase: Client,
  docKeys: Array<string | null>
): Promise<Map<string, DocKindInfo>> {
  const keys = Array.from(new Set(docKeys.filter((k): k is string => !!k && k.trim() !== "")));
  const out = new Map<string, DocKindInfo>();
  if (keys.length === 0) return out;

  const stdKeys = Array.from(
    new Set(keys.map((k) => parseDocKey(k).stdKey).filter((k): k is string => !!k))
  );
  const nameByKey = new Map<string, string>();
  if (stdKeys.length > 0) {
    const [{ data: stds }, { data: items }] = await Promise.all([
      supabase.from("study_doc_standards").select("key, name_ko").in("key", stdKeys),
      supabase.from("study_doc_items").select("key, name_ko").in("key", stdKeys),
    ]);
    // 항목을 먼저 넣고 표준으로 덮는다 — 같은 키면 표준 이름이 정본이다.
    for (const r of items ?? []) nameByKey.set(r.key, r.name_ko);
    for (const r of stds ?? []) nameByKey.set(r.key, r.name_ko);
  }

  for (const key of keys) {
    const { stdKey, target, legacyName } = parseDocKey(key);
    const name = (stdKey ? nameByKey.get(stdKey) : null) ?? legacyName ?? key;
    const targetLabel =
      target && target !== "self" ? TARGET_LABEL_KO[target] ?? target : null;
    out.set(key, {
      name,
      targetLabel,
      label: targetLabel ? `${name}(${targetLabel})` : name,
    });
  }
  return out;
}

/** 파일 시스템·zip 에 안전한 조각 */
function clean(s: string): string {
  return s.replace(/[/\\?%*:|"<>]/g, " ").replace(/\s+/g, " ").trim();
}

/** 확장자 (없으면 bin) */
export function extOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot > 0 ? fileName.slice(dot + 1).toLowerCase() : "bin";
}

/**
 * 다운로드 파일명 — `서류명_이름(영대)_대학_학과_학기.확장자`
 *   비어 있는 조각은 빠진다(지원 대학이 아직 없는 학생도 이름은 나와야 한다).
 */
export function submissionFileName(parts: {
  docLabel: string;
  studentName: string;
  universityNameKo?: string | null;
  departmentName?: string | null;
  term?: string | null;
  ext: string;
}): string {
  const segs = [
    clean(parts.docLabel),
    clean(parts.studentName).toUpperCase(),
    clean(parts.universityNameKo ?? ""),
    clean(parts.departmentName ?? ""),
    clean(parts.term ?? ""),
  ].filter(Boolean);
  return `${segs.join("_") || "서류"}.${parts.ext}`;
}
