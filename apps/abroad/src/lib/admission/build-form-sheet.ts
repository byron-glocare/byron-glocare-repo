/**
 * 학생 × 양식 작성 시트 → Markdown → HWPX 빌더 (B4-8).
 *
 * 양식 작성 시트의 모든 데이터 (필요 데이터 값 + AI 작문 결과) 를
 * Markdown 으로 조립 → @ssabrojs/hwpxjs 의 markdownToHwpx 로 HWPX 파일 생성.
 *
 * 결과 HWPX 는 한컴오피스/네이버 한컴독스 등에서 열어 편집·인쇄 가능.
 */

import "server-only";

import { markdownToHwpx } from "@ssabrojs/hwpxjs";
import type { Json } from "@/types/database";
import type { EssayQuestion } from "@/types/study";

const CATEGORY_LABEL_KO: Record<string, string> = {
  identity: "신원 정보",
  education: "학력",
  family: "가족",
  financial: "재정",
  language: "어학 능력",
  contact: "연락처",
  career: "경력·자격",
  essay: "서술형 기초 데이터",
  document: "첨부 파일",
  other: "기타",
};

const CATEGORY_ORDER = [
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
];

export type SheetDataType = {
  key: string;
  label_ko: string;
  category: string;
  input_type: string;
  value?: Json;
};

export type SheetDraft = {
  question_index: number;
  generated_text: string | null;
  edited_text: string | null;
};

export type BuildSheetInput = {
  studentName: string;
  formName: string;
  universityNameKo: string;
  departmentName: string | null;
  /** 양식이 요구하는 데이터 + 학생 값 (이미 join 된 상태) */
  fields: SheetDataType[];
  /** 양식의 essay 질문들 */
  essayQuestions: EssayQuestion[];
  /** 학생의 작문 결과 (question_index 매칭) */
  drafts: SheetDraft[];
};

export function buildSheetMarkdown(input: BuildSheetInput): string {
  const lines: string[] = [];

  // 제목
  lines.push(`# ${input.formName}`);
  lines.push("");
  lines.push(
    `**대학교**: ${input.universityNameKo}${
      input.departmentName ? ` (${input.departmentName})` : ""
    }`
  );
  lines.push(`**학생**: ${input.studentName}`);
  lines.push(`**작성일**: ${new Date().toISOString().slice(0, 10)}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  // 카테고리별 데이터
  const byCategory = new Map<string, SheetDataType[]>();
  for (const f of input.fields) {
    if (!byCategory.has(f.category)) byCategory.set(f.category, []);
    byCategory.get(f.category)!.push(f);
  }

  for (const cat of CATEGORY_ORDER) {
    const items = byCategory.get(cat);
    if (!items || items.length === 0) continue;
    lines.push(`## ${CATEGORY_LABEL_KO[cat] ?? cat}`);
    lines.push("");
    lines.push("| 항목 | 값 |");
    lines.push("|---|---|");
    for (const f of items) {
      const v = formatValue(f.value, f.input_type);
      lines.push(`| ${f.label_ko} | ${v} |`);
    }
    lines.push("");
  }

  // 서술형 답변
  if (input.essayQuestions.length > 0) {
    const draftMap = new Map(input.drafts.map((d) => [d.question_index, d]));
    lines.push("---");
    lines.push("");
    lines.push("## 서술형 답변");
    lines.push("");
    for (let i = 0; i < input.essayQuestions.length; i++) {
      const q = input.essayQuestions[i];
      const d = draftMap.get(i);
      const text = d?.edited_text ?? d?.generated_text ?? "";
      lines.push(`### ${i + 1}. ${q.question_ko}`);
      if (q.max_chars) {
        lines.push(`_(최대 ${q.max_chars}자)_`);
      }
      lines.push("");
      if (text) {
        // markdown 표 안에 들어가지 않도록 별도 단락
        // 줄바꿈 보존
        for (const para of text.split(/\n+/)) {
          if (para.trim()) {
            lines.push(para.trim());
            lines.push("");
          }
        }
      } else {
        lines.push("_(작성되지 않음 — AI 생성 필요)_");
        lines.push("");
      }
    }
  }

  // 푸터
  lines.push("---");
  lines.push("");
  lines.push(
    `_본 문서는 GLOCARE 시스템에서 자동 생성되었습니다. 실제 학교 양식에 옮겨 입력하시기 바랍니다._`
  );

  return lines.join("\n");
}

function formatValue(v: Json | undefined, input_type: string): string {
  if (v === null || v === undefined || v === "") return "—";
  if (input_type === "boolean") return v === true ? "예" : "아니오";
  if (input_type === "multi_select" && Array.isArray(v))
    return v.map(String).join(", ");
  if (input_type === "file" && typeof v === "object" && v !== null) {
    const o = v as { url?: string; file_name?: string };
    return o.file_name ?? o.url ?? "(첨부 파일)";
  }
  if (typeof v === "object") return JSON.stringify(v);
  // markdown 표 안의 파이프 문자 escape
  return String(v).replace(/\|/g, "\\|").replace(/\n/g, "<br>");
}

/**
 * Markdown → HWPX (bytes).
 */
export async function buildSheetHwpx(
  input: BuildSheetInput
): Promise<Uint8Array> {
  const md = buildSheetMarkdown(input);
  return await markdownToHwpx(md, {
    title: `${input.studentName} - ${input.formName}`,
    creator: "GLOCARE",
  });
}
