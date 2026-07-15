"use client";

import { useRef, useState } from "react";
import { Download, FileText, Loader2, Upload } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type TokenDef = { token: string; label: string; sample: string };

export function TestFormFill({
  textTokens,
  imageTokens,
}: {
  textTokens: TokenDef[];
  imageTokens: TokenDef[];
}) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; details: string[] } | null>(
    null
  );
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultName, setResultName] = useState<string>("filled.docx");
  const previewRef = useRef<HTMLDivElement | null>(null);

  async function run() {
    if (!file) return;
    setBusy(true);
    setError(null);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setResultUrl(null);

    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/test/form-fill/fill", {
        method: "POST",
        body: fd,
      });

      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as {
          error?: string;
          details?: string[];
        } | null;
        setError({
          message: j?.error ?? `채움 실패 (HTTP ${res.status})`,
          details: j?.details ?? [],
        });
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setResultUrl(url);
      setResultName(`filled-${file.name}`);

      // 인라인 미리보기 (docx-preview) — 실패해도 다운로드는 가능
      try {
        const { renderAsync } = await import("docx-preview");
        if (previewRef.current) {
          previewRef.current.innerHTML = "";
          await renderAsync(blob, previewRef.current, undefined, {
            className: "docx",
            inWrapper: true,
          });
        }
      } catch {
        /* preview 실패는 무시 */
      }
    } catch (e) {
      setError({ message: (e as Error).message, details: [] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* 접근법 설명 */}
      <Card className="space-y-2 p-5">
        <h2 className="text-sm font-semibold">이 테스트가 검증하는 것</h2>
        <p className="text-sm text-muted-foreground">
          원본 서식을 <strong>그대로 유지</strong>한 채, 각 빈칸에 학생 값과
          서명·사진 이미지가 <strong>정확한 위치·크기</strong>로 들어가는지
          (사람이 손댈 필요 0) 확인합니다. 방식은{" "}
          <strong>&quot;양식당 1회 토큰 심기 → 학생마다 자동 채움&quot;</strong>{" "}
          (in-place 템플릿)입니다.
        </p>
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          동남보건대 입학원서로 테스트하려면: 그 양식을 Word 로 열어 아래 표의
          빈칸을 <code className="rounded bg-white px-1">{"{{토큰}}"}</code> 으로
          바꿔 저장한 뒤 업로드하세요. (서명·사진은{" "}
          <code className="rounded bg-white px-1">{"{{%signature}}"}</code> ·{" "}
          <code className="rounded bg-white px-1">{"{{%photo}}"}</code>)
        </div>
      </Card>

      {/* 사용법 3단계 */}
      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold">사용법 (양식당 1회 셋업)</h2>
        <ol className="space-y-2 text-sm text-muted-foreground">
          <li>
            <Badge variant="outline" className="mr-2">
              1
            </Badge>
            원본 양식(.docx)을 Word 로 연다. (한글 .hwp 는 Word/워드로 변환)
          </li>
          <li>
            <Badge variant="outline" className="mr-2">
              2
            </Badge>
            값이 들어갈 빈칸/밑줄/셀을 아래 토큰으로 <strong>덮어쓴다</strong>.
            예: 성명 칸 → <code className="rounded bg-muted px-1">{"{{name_ko}}"}</code>
            , 서명란 → <code className="rounded bg-muted px-1">{"{{%signature}}"}</code>
          </li>
          <li>
            <Badge variant="outline" className="mr-2">
              3
            </Badge>
            저장 후 아래에 업로드 → <strong>채우기</strong>. 결과를 Word 로 열어
            위치·서식을 확인한다.
          </li>
        </ol>
      </Card>

      {/* 토큰 사전 */}
      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold">
          토큰 사전 & 테스트 데이터 값
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <h3 className="mb-1.5 text-xs font-medium text-muted-foreground">
              텍스트 토큰 — <code>{"{{토큰}}"}</code> (이중 중괄호)
            </h3>
            <div className="overflow-hidden rounded-md border">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-medium">토큰</th>
                    <th className="px-2 py-1.5 text-left font-medium">항목</th>
                    <th className="px-2 py-1.5 text-left font-medium">
                      채울 값
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {textTokens.map((t) => (
                    <tr key={t.token} className="border-t">
                      <td className="px-2 py-1 font-mono text-[11px]">
                        {`{{${t.token}}}`}
                      </td>
                      <td className="px-2 py-1">{t.label}</td>
                      <td className="px-2 py-1 text-muted-foreground">
                        {t.sample}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <h3 className="mb-1.5 text-xs font-medium text-muted-foreground">
              이미지 토큰 — <code>{"{{%토큰}}"}</code>
            </h3>
            <div className="overflow-hidden rounded-md border">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-medium">토큰</th>
                    <th className="px-2 py-1.5 text-left font-medium">항목</th>
                    <th className="px-2 py-1.5 text-left font-medium">값</th>
                  </tr>
                </thead>
                <tbody>
                  {imageTokens.map((t) => (
                    <tr key={t.token} className="border-t">
                      <td className="px-2 py-1 font-mono text-[11px]">
                        {`{{%${t.token}}}`}
                      </td>
                      <td className="px-2 py-1">{t.label}</td>
                      <td className="px-2 py-1 text-muted-foreground">
                        {t.sample}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              서명·사진은 테스트용 자동 생성 이미지를 사용합니다. 서명은 넓은
              칸에, 사진은 3.5×4.5cm 비율 박스에 원본 비율 유지하며 fit 됩니다.
            </p>
          </div>
        </div>
      </Card>

      {/* 업로드 + 실행 */}
      <Card className="space-y-3 p-5">
        <h2 className="text-sm font-semibold">템플릿 업로드 → 채우기</h2>
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-muted">
            <Upload className="size-4" />
            {file ? "다른 파일 선택" : "DOCX 선택"}
            <input
              type="file"
              accept=".docx"
              className="hidden"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setError(null);
              }}
            />
          </label>
          {file ? (
            <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <FileText className="size-4" />
              {file.name}
            </span>
          ) : null}
          <Button type="button" onClick={run} disabled={!file || busy}>
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                채우는 중...
              </>
            ) : (
              "테스트 데이터로 채우기"
            )}
          </Button>
          {resultUrl ? (
            <a
              href={resultUrl}
              download={resultName}
              className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              <Download className="size-4" />
              결과 다운로드
            </a>
          ) : null}
        </div>

        {error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <p className="font-medium">{error.message}</p>
            {error.details.length > 0 ? (
              <ul className="mt-1 list-disc pl-5 text-xs">
                {error.details.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            ) : null}
            <p className="mt-1 text-xs text-muted-foreground">
              대개 토큰이 잘못 닫혔거나(예: {"{{name}"}), 표 셀 안에서 토큰이
              여러 조각으로 나뉘어 있을 때 발생합니다. Word 에서 해당 토큰을
              한 번에 다시 입력해 보세요.
            </p>
          </div>
        ) : null}
      </Card>

      {/* 미리보기 */}
      {resultUrl ? (
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold">
            채운 결과 미리보기 (브라우저 렌더 — 최종 확인은 Word 로)
          </h2>
          <div
            ref={previewRef}
            className="max-h-[70vh] overflow-auto rounded-md border bg-white p-2"
          />
        </Card>
      ) : null}
    </div>
  );
}
