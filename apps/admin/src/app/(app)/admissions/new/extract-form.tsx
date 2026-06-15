"use client";

import Link from "next/link";
import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { ReviewForm } from "./review-form";
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

export type UniversityOption = {
  id: number;
  name_ko: string;
  name_vi: string | null;
};

export function ExtractForm({
  universities,
  defaultUniversityNameKo = "",
  docTypes = [],
}: {
  universities: UniversityOption[];
  defaultUniversityNameKo?: string;
  docTypes?: Array<{ key: string; label_ko: string }>;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CallExtractResult | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [meta, setMeta] = useState<{
    universityNameKo: string;
    term: string;
    admissionCategory: string;
  }>({ universityNameKo: defaultUniversityNameKo, term: "", admissionCategory: "" });
  const [newUniMode, setNewUniMode] = useState(false);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    setResult(null);

    const fd = new FormData(e.currentTarget);
    // file size 사전 체크 (UX)
    const file = fd.get("file");
    if (!(file instanceof File)) {
      setLoading(false);
      setError("파일을 선택해주세요");
      return;
    }

    const lower = file.name.toLowerCase();
    const isPdf = lower.endsWith(".pdf");
    const isHwp = lower.endsWith(".hwp") || lower.endsWith(".hwpx");
    if (!isPdf && !isHwp) {
      setLoading(false);
      setError("지원 형식: .pdf / .hwp / .hwpx");
      return;
    }

    const maxBytes = isPdf ? 40 * 1024 * 1024 : 30 * 1024 * 1024;
    if (file.size > maxBytes) {
      setLoading(false);
      setError(
        `파일이 너무 큽니다 (${(file.size / 1024 / 1024).toFixed(1)}MB > ${maxBytes / 1024 / 1024}MB)`
      );
      return;
    }

    try {
      const file_base64 = await fileToBase64(file);

      const res = await fetch("/api/admissions/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_base64,
          file_name: file.name,
          file_size: file.size,
          university_name_ko: fd.get("university_name_ko"),
          term: fd.get("term"),
          admission_category: fd.get("admission_category") ?? "",
        }),
      });
      const json = (await res.json()) as CallExtractResult;
      setResult(json);
    } catch (err) {
      setError(
        `네트워크 오류: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setLoading(false);
    }
  };

  /** File → base64 string (data: prefix 제거) */
  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // "data:application/pdf;base64,XXXXX" 에서 XXXXX 부분만
        const comma = result.indexOf(",");
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">
                대학 <span className="text-destructive">*</span>
              </span>
              <select
                name={newUniMode ? undefined : "university_name_ko"}
                required={!newUniMode}
                value={newUniMode ? "__new__" : meta.universityNameKo}
                onChange={(e) => {
                  if (e.target.value === "__new__") {
                    setNewUniMode(true);
                    setMeta((m) => ({ ...m, universityNameKo: "" }));
                  } else {
                    setNewUniMode(false);
                    setMeta((m) => ({ ...m, universityNameKo: e.target.value }));
                  }
                }}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">— 대학 선택 —</option>
                {universities.map((u) => (
                  <option key={u.id} value={u.name_ko}>
                    {u.name_ko}
                    {u.name_vi ? ` · ${u.name_vi}` : ""}
                  </option>
                ))}
                <option value="__new__">+ 신규 대학 직접 입력</option>
              </select>
              {newUniMode ? (
                <input
                  type="text"
                  name="university_name_ko"
                  required
                  maxLength={200}
                  value={meta.universityNameKo}
                  onChange={(e) =>
                    setMeta((m) => ({ ...m, universityNameKo: e.target.value }))
                  }
                  placeholder="신규 대학명 (한국어)"
                  className="mt-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              ) : null}
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">
                학기 <span className="text-destructive">*</span>
              </span>
              <select
                name="term"
                required
                value={meta.term}
                onChange={(e) => setMeta((m) => ({ ...m, term: e.target.value }))}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">— 학기 선택 —</option>
                {TERM_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">
              전형 카테고리{" "}
              <span className="text-xs font-normal text-muted-foreground">
                (선택, 비우면 AI 가 결정)
              </span>
            </span>
            <input
              type="text"
              name="admission_category"
              maxLength={200}
              value={meta.admissionCategory}
              onChange={(e) =>
                setMeta((m) => ({ ...m, admissionCategory: e.target.value }))
              }
              placeholder="예: 글로벌요양복지과"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">
              모집요강 파일 <span className="text-destructive">*</span>
            </span>
            <input
              type="file"
              name="file"
              accept=".pdf,.hwp,.hwpx,application/pdf,application/x-hwp,application/vnd.hancom.hwpx"
              required
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
              className="text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-secondary/80"
            />
            {fileName ? (
              <span className="text-xs text-muted-foreground">
                선택됨: {fileName}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">
                PDF (최대 40MB) / HWP·HWPX (최대 30MB) 지원. HWP 는 서버에서 자동 텍스트 변환.
              </span>
            )}
          </label>

          <div className="flex items-center gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Claude Sonnet 분석 중...
                </>
              ) : (
                <>
                  <Sparkles className="size-4" />
                  AI 추출 시작
                </>
              )}
            </Button>
            <Link
              href="/admissions"
              className={buttonVariants({ variant: "outline" })}
            >
              취소
            </Link>
          </div>

          {error ? (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}
        </form>
      </Card>

      {result ? (
        result.ok ? (
          <ReviewForm
            spec={result.spec}
            meta={{
              universityNameKo: meta.universityNameKo,
              term: meta.term,
              admissionCategory: meta.admissionCategory || undefined,
              sourceFileName: fileName,
            }}
            universities={universities}
            docTypes={docTypes}
            aiLog={{
              raw: result.raw,
              confidence: result.confidence,
              usage: result.usage,
              extracted_at: new Date().toISOString(),
            }}
          />
        ) : (
          <ExtractResultDisplay result={result} />
        )
      ) : null}
    </div>
  );
}

function ExtractResultDisplay({ result }: { result: CallExtractResult }) {
  if (result.ok) return null;

  return (
    <Card className="p-6 space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold">추출 실패</h2>
        <Badge variant="destructive">error</Badge>
      </div>
      <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {result.error}
      </div>
      {result.raw ? (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            모델 원본 응답 보기
          </summary>
          <pre className="mt-2 max-h-96 overflow-auto rounded-md bg-muted p-3 text-xs">
            {result.raw}
          </pre>
        </details>
      ) : null}
    </Card>
  );
}
