"use client";

/**
 * 학생 서류 미리보기 — 유학센터·학생이 올린 모든 파일을 어드민에서 바로 연다.
 *
 *   한 창에서 왼쪽 목록으로 전부 넘겨 볼 수 있다(← → 키도 됨).
 *   PDF 는 브라우저 내장 뷰어, 이미지는 그대로, docx 는 docx-preview 로 그린다.
 *   그 밖의 형식(hwp 등)은 미리볼 수 없어 새 탭 열기만 준다.
 *
 *   미리보기 URL 은 download 옵션 없는 서명 URL 이어야 한다 — download 가 붙으면
 *   Content-Disposition: attachment 라 iframe 에서도 내려받기가 돼 버린다.
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type PreviewDoc = {
  key: string;
  /** 목록 묶음 — 제출서류 / 최종 제출 서류 / 정보 입력 첨부 */
  group: string;
  /** 서류 종류 (요강 이름) */
  label: string;
  /** 업로드 파일명 */
  fileName: string;
  /** 미리보기용 서명 URL (download 옵션 없음) */
  url: string | null;
};

type Kind = "pdf" | "image" | "docx" | "other";

function kindOf(fileName: string): Kind {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "pdf";
  if (["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(ext)) return "image";
  if (ext === "docx") return "docx";
  return "other";
}

const Ctx = createContext<{ docs: PreviewDoc[]; open: (index: number) => void } | null>(null);

export function DocPreviewProvider({
  docs,
  children,
}: {
  docs: PreviewDoc[];
  children: React.ReactNode;
}) {
  const [index, setIndex] = useState<number | null>(null);
  const open = useCallback((i: number) => setIndex(i), []);

  return (
    <Ctx.Provider value={{ docs, open }}>
      {children}
      {index !== null && docs.length > 0 ? (
        <Viewer docs={docs} index={index} setIndex={setIndex} />
      ) : null}
    </Ctx.Provider>
  );
}

/** 미리보기 버튼 — index 를 주면 그 서류부터, 안 주면 첫 서류부터 */
export function PreviewButton({
  index = 0,
  label = "미리보기",
  variant = "outline",
}: {
  index?: number;
  label?: string;
  variant?: "outline" | "default" | "secondary";
}) {
  const ctx = useContext(Ctx);
  if (!ctx || ctx.docs.length === 0) return null;
  return (
    <Button variant={variant} size="sm" onClick={() => ctx.open(index)}>
      <Eye className="size-3.5" />
      {label}
    </Button>
  );
}

function Viewer({
  docs,
  index,
  setIndex,
}: {
  docs: PreviewDoc[];
  index: number;
  setIndex: (i: number | null) => void;
}) {
  const doc = docs[index];
  const go = useCallback(
    (d: number) => setIndex(Math.min(docs.length - 1, Math.max(0, index + d))),
    [docs.length, index, setIndex]
  );

  // ← → 로 넘기기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  // 목록을 묶음별로
  const groups: { name: string; items: { doc: PreviewDoc; i: number }[] }[] = [];
  docs.forEach((d, i) => {
    const g = groups.find((x) => x.name === d.group);
    if (g) g.items.push({ doc: d, i });
    else groups.push({ name: d.group, items: [{ doc: d, i }] });
  });

  return (
    <Dialog open onOpenChange={(o) => !o && setIndex(null)}>
      <DialogContent className="flex h-[90vh] flex-col gap-0 p-0 sm:max-w-6xl">
        <div className="flex items-center gap-2 border-b px-4 py-2.5 pr-12">
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate text-sm font-semibold">{doc.label}</DialogTitle>
            <p className="truncate text-xs text-muted-foreground">{doc.fileName}</p>
          </div>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {index + 1} / {docs.length}
          </span>
          <Button variant="outline" size="icon-sm" onClick={() => go(-1)} disabled={index === 0} aria-label="이전 서류">
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => go(1)}
            disabled={index === docs.length - 1}
            aria-label="다음 서류"
          >
            <ChevronRight className="size-4" />
          </Button>
          {doc.url ? (
            <a
              href={doc.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="size-3.5" />새 탭
            </a>
          ) : null}
        </div>

        <div className="grid min-h-0 flex-1 md:grid-cols-[240px_1fr]">
          <nav className="hidden min-h-0 overflow-y-auto border-r bg-muted/30 p-2 md:block">
            {groups.map((g) => (
              <div key={g.name} className="mb-3">
                <p className="px-2 pb-1 text-[11px] font-medium text-muted-foreground">
                  {g.name} ({g.items.length})
                </p>
                {g.items.map(({ doc: d, i }) => (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => setIndex(i)}
                    className={cn(
                      "block w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted",
                      i === index && "bg-primary/10 font-medium text-primary"
                    )}
                  >
                    <span className="block truncate">{d.label}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{d.fileName}</span>
                  </button>
                ))}
              </div>
            ))}
          </nav>
          <div className="min-h-0 overflow-auto bg-muted/40">
            <Body key={doc.key} doc={doc} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Body({ doc }: { doc: PreviewDoc }) {
  const kind = kindOf(doc.fileName);
  if (!doc.url) return <Notice text="파일 링크를 만들지 못했습니다. 파일이 저장소에 없을 수 있습니다." />;
  if (kind === "pdf") return <iframe src={doc.url} title={doc.label} className="h-full w-full bg-white" />;
  if (kind === "image")
    return (
      // eslint-disable-next-line @next/next/no-img-element -- 서명 URL 원본을 그대로 보여준다
      <img src={doc.url} alt={doc.label} className="mx-auto max-h-full max-w-full object-contain p-4" />
    );
  if (kind === "docx") return <DocxBody url={doc.url} />;
  return <Notice text="이 형식은 미리볼 수 없습니다. 위의 '새 탭'으로 열거나 다운로드하세요." />;
}

function DocxBody({ url }: { url: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        const { renderAsync } = await import("docx-preview");
        if (cancelled) return;
        c.innerHTML = "";
        await renderAsync(blob, c, undefined, {
          className: "docx",
          inWrapper: true,
          breakPages: true,
          experimental: true,
        });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (failed) return <Notice text="docx 를 그리지 못했습니다. '새 탭'으로 내려받아 확인하세요." />;
  return (
    <div ref={ref}>
      <p className="p-6 text-center text-sm text-muted-foreground">불러오는 중…</p>
    </div>
  );
}

function Notice({ text }: { text: string }) {
  return <p className="p-10 text-center text-sm text-muted-foreground">{text}</p>;
}
