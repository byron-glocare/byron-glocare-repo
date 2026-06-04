"use client";

/**
 * Flow B: 대학 생성 시 모집요강 PDF 를 첨부 → AI 추출 → 폼 기본 정보 자동 채움
 * + (선택) 모집요강 자체도 함께 등록(학과 자동 생성).
 *
 * 부모(UniversityForm, create 모드)에서만 사용.
 *  - onPrefill: 추출된 값으로 폼 필드 채움 (부모가 react-hook-form setValue)
 *  - onSpecStateChange: 함께 등록할 spec 페이로드 + 학기/과정/등록여부 전달
 */

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

import { Card } from "@/components/ui/card";
import type { CallExtractResult } from "@/lib/admission/call-extract";

const TERM_OPTIONS = [
  "2026-Spring",
  "2026-Summer",
  "2026-Fall",
  "2026-Winter",
  "2026-Year",
  "2027-Spring",
  "2027-Fall",
];

const PROGRAM_TYPE_OPTIONS = [
  { value: "language_program", label: "어학연수 (D-4)" },
  { value: "associate_2yr", label: "전문학사 2년" },
  { value: "bachelor_3yr_extension", label: "전공심화 (2+2)" },
  { value: "bachelor_4yr", label: "학사 4년" },
] as const;

export type UniversityPrefillFields = Partial<
  Record<"name_ko" | "name_vi" | "region_ko" | "website_url", string>
>;

export type UniversitySpecState = {
  register: boolean;
  term: string;
  programType: string;
  admissionCategory: string | null;
  sourceFileName: string | null;
  spec: Record<string, unknown>;
  aiLog: unknown;
};

/** 중첩 경로 안전 읽기 */
function pick(obj: unknown, path: string[]): unknown {
  let cur: unknown = obj;
  for (const k of path) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
}
function asStr(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result as string;
      const comma = r.indexOf(",");
      resolve(comma >= 0 ? r.slice(comma + 1) : r);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function UniversityAdmissionPrefill({
  onPrefill,
  onSpecStateChange,
}: {
  onPrefill: (fields: UniversityPrefillFields) => void;
  onSpecStateChange: (state: UniversitySpecState | null) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [fileName, setFileName] = useState("");

  // 추출 후 컨트롤 상태
  const [spec, setSpec] = useState<Record<string, unknown> | null>(null);
  const [aiLog, setAiLog] = useState<unknown>(null);
  const [register, setRegister] = useState(true);
  const [term, setTerm] = useState("");
  const [programType, setProgramType] = useState("");
  const [admissionCategory, setAdmissionCategory] = useState("");
  const [deptCount, setDeptCount] = useState(0);

  function emit(next: Partial<UniversitySpecState>) {
    if (!spec) return;
    onSpecStateChange({
      register,
      term,
      programType,
      admissionCategory: admissionCategory || null,
      sourceFileName: fileName || null,
      spec,
      aiLog,
      ...next,
    });
  }

  async function handleFile(file: File) {
    setLoading(true);
    setError(null);
    setDone(false);
    try {
      const lower = file.name.toLowerCase();
      const isPdf = lower.endsWith(".pdf");
      const isHwp = lower.endsWith(".hwp") || lower.endsWith(".hwpx");
      if (!isPdf && !isHwp) {
        setError("지원 형식: .pdf / .hwp / .hwpx");
        return;
      }
      const file_base64 = await fileToBase64(file);
      const res = await fetch("/api/admissions/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_base64,
          file_name: file.name,
          file_size: file.size,
          university_name_ko: "",
          term: "",
          admission_category: "",
        }),
      });
      const json = (await res.json()) as CallExtractResult;
      if (!json.ok) {
        setError(json.error || "추출 실패");
        return;
      }

      const s = json.spec;
      setSpec(s);
      setAiLog({
        raw: json.raw,
        confidence: json.confidence,
        usage: json.usage,
      });

      // 폼 프리필 (있는 값만)
      const fields: UniversityPrefillFields = {};
      const nameKo =
        asStr(pick(s, ["identity", "university_name_ko"])) ??
        asStr(pick(s, ["identity", "university"]));
      const nameVi = asStr(pick(s, ["identity", "university_name_vi"]));
      const website = asStr(pick(s, ["metadata", "contacts", "website"]));
      const addressKo = asStr(pick(s, ["metadata", "contacts", "address_ko"]));
      if (nameKo) fields.name_ko = nameKo;
      if (nameVi) fields.name_vi = nameVi;
      if (website) fields.website_url = website;
      if (addressKo) {
        // 주소 앞 2토큰을 지역으로 추정 (예: "경기도 수원시 ...")
        const region = addressKo.split(/\s+/).slice(0, 2).join(" ");
        if (region) fields.region_ko = region;
      }
      onPrefill(fields);

      // 과정/카테고리/학과수 프리필
      const pt = asStr(pick(s, ["identity", "program_type"])) ?? "";
      const ac = asStr(pick(s, ["identity", "admission_category"])) ?? "";
      const depts = pick(s, ["departments"]);
      const dc = Array.isArray(depts) ? depts.length : 0;
      setProgramType(pt);
      setAdmissionCategory(ac);
      setDeptCount(dc);
      setDone(true);

      onSpecStateChange({
        register: true,
        term: "",
        programType: pt,
        admissionCategory: ac || null,
        sourceFileName: file.name,
        spec: s,
        aiLog: {
          raw: json.raw,
          confidence: json.confidence,
          usage: json.usage,
        },
      });
    } catch (e) {
      setError(`오류: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-amber-300 bg-amber-50/50 p-4">
      <div className="flex items-start gap-2">
        <Sparkles className="mt-0.5 size-4 text-amber-600" />
        <div className="flex-1 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-amber-900">
              모집요강 PDF 로 시작하기 (선택)
            </h3>
            <p className="mt-0.5 text-xs text-amber-800">
              모집요강을 올리면 대학 기본 정보를 자동으로 채우고, 원하면 모집요강과
              학과도 함께 등록합니다 (학과는 비노출 상태로 생성).
            </p>
          </div>

          <input
            type="file"
            accept=".pdf,.hwp,.hwpx,application/pdf"
            disabled={loading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                setFileName(f.name);
                handleFile(f);
              }
            }}
            className="text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-secondary/80"
          />

          {loading ? (
            <div className="flex items-center gap-2 text-xs text-amber-800">
              <Loader2 className="size-4 animate-spin" />
              Claude 가 모집요강 분석 중... (30-60초)
            </div>
          ) : null}

          {error ? (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          ) : null}

          {done && spec ? (
            <div className="space-y-3 rounded-md border border-amber-300 bg-white p-3">
              <div className="text-xs font-medium text-emerald-700">
                ✓ 추출 완료 — 기본 정보를 채웠습니다. 검토 후 수정하세요.
                {deptCount > 0 ? ` (학과 ${deptCount}개 감지)` : ""}
              </div>

              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={register}
                  onChange={(e) => {
                    setRegister(e.target.checked);
                    emit({ register: e.target.checked });
                  }}
                  className="mt-0.5 size-4"
                />
                <span>
                  <span className="font-medium">이 모집요강도 함께 등록</span>
                  <span className="block text-xs text-muted-foreground">
                    체크 시 대학 저장과 함께 모집요강(초안) + 학과(비노출)가
                    생성됩니다.
                  </span>
                </span>
              </label>

              {register ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="font-medium">
                      학기 <span className="text-destructive">*</span>
                    </span>
                    <select
                      value={term}
                      onChange={(e) => {
                        setTerm(e.target.value);
                        emit({ term: e.target.value });
                      }}
                      className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    >
                      <option value="">— 선택 —</option>
                      {TERM_OPTIONS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="font-medium">
                      과정 <span className="text-destructive">*</span>
                    </span>
                    <select
                      value={programType}
                      onChange={(e) => {
                        setProgramType(e.target.value);
                        emit({ programType: e.target.value });
                      }}
                      className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    >
                      <option value="">— 선택 —</option>
                      {PROGRAM_TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
