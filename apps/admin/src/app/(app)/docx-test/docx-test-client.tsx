"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { FileUp, Loader2, Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function DocxTestClient() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [matched, setMatched] = useState<string[] | null>(null);
  const [unmatched, setUnmatched] = useState<string[]>([]);

  async function onSubmit() {
    const file = inputRef.current?.files?.[0];
    if (!file) {
      toast.error(".docx 파일을 선택하세요.");
      return;
    }
    setBusy(true);
    setMatched(null);
    setUnmatched([]);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/docx-test/fill", { method: "POST", body: fd });
      if (!res.ok) {
        const msg = await res.text().catch(() => "처리 실패");
        toast.error("실패", { description: msg });
        return;
      }
      // 매칭/미매칭
      const parseHdr = (name: string): string[] => {
        try {
          const raw = res.headers.get(name);
          return raw ? (JSON.parse(decodeURIComponent(raw)) as string[]) : [];
        } catch {
          return [];
        }
      };
      setMatched(parseHdr("X-Matched"));
      setUnmatched(parseHdr("X-Unmatched"));
      // 다운로드
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name.replace(/\.docx$/i, "") + "_채움예시.docx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("채움 완료 — 다운로드됨");
    } catch (e) {
      toast.error("오류", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            accept=".docx"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            className="block text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-muted file:px-3 file:py-1.5 file:text-sm"
          />
          <Button type="button" onClick={onSubmit} disabled={busy}>
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileUp className="size-4" />
            )}
            채움 실행
          </Button>
        </div>
        {fileName ? (
          <p className="text-xs text-muted-foreground">선택: {fileName}</p>
        ) : null}

        {matched ? (
          <div className="space-y-3">
            <div className="rounded-md border border-success/20 bg-success/5 p-3">
              <div className="mb-2 flex items-center gap-1.5 text-sm font-medium text-foreground">
                <Download className="size-3.5" />
                채움된 항목 {matched.length}개 (표준데이터 매칭)
              </div>
              {matched.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  매칭된 항목이 없습니다. 아래 “미매칭”을 데이터 메뉴에서 별칭으로
                  추가하면 잡힙니다.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {matched.map((d, i) => (
                    <Badge
                      key={i}
                      className="border-success/20 bg-success/10 text-success"
                    >
                      {d}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {unmatched.length > 0 ? (
              <div className="rounded-md border border-amber-300/40 bg-amber-50/50 p-3">
                <div className="mb-2 text-sm font-medium text-amber-800">
                  미매칭 후보 {unmatched.length}개 — 데이터 메뉴에서 별칭으로
                  추가하면 자동 채움됩니다
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {unmatched.map((d, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className="border-amber-300 text-amber-800"
                    >
                      {d}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
