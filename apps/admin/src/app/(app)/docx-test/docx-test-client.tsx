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
  const [detected, setDetected] = useState<string[] | null>(null);

  async function onSubmit() {
    const file = inputRef.current?.files?.[0];
    if (!file) {
      toast.error(".docx 파일을 선택하세요.");
      return;
    }
    setBusy(true);
    setDetected(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/docx-test/fill", { method: "POST", body: fd });
      if (!res.ok) {
        const msg = await res.text().catch(() => "처리 실패");
        toast.error("실패", { description: msg });
        return;
      }
      // 감지 필드
      try {
        const raw = res.headers.get("X-Detected");
        if (raw) setDetected(JSON.parse(decodeURIComponent(raw)) as string[]);
      } catch {
        /* ignore */
      }
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

        {detected ? (
          <div className="rounded-md border border-border bg-muted/30 p-3">
            <div className="mb-2 flex items-center gap-1.5 text-sm font-medium">
              <Download className="size-3.5" />
              감지·채움된 항목 {detected.length}개
            </div>
            {detected.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                감지된 항목이 없습니다. (표 라벨이 사전과 다르거나 표가 아닐 수
                있어요)
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {detected.map((d, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {d}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
