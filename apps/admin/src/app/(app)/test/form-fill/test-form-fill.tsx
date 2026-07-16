"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, FileText, Loader2, Upload } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type BindingOption = {
  token: string;
  label: string;
  group: string;
  kind: "text" | "image";
};

type Slot = {
  index: number;
  kind: "underscore" | "spaces" | "empty_cell";
  original: string;
  before: string;
  after: string;
};

const KIND_LABEL: Record<Slot["kind"], string> = {
  underscore: "밑줄",
  spaces: "공백",
  empty_cell: "빈 셀",
};

export function TestFormFill({
  options,
  values,
}: {
  options: BindingOption[];
  values: Record<string, string>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [mapping, setMapping] = useState<Record<number, string>>({});
  const [active, setActive] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; details: string[] } | null>(
    null
  );
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);

  const optByToken = new Map(options.map((o) => [o.token, o]));

  /** 미리보기 DOM 의 ⟦S{n}⟧ 마커 → 클릭 가능한 칩으로 치환 */
  const decorateMarkers = useCallback(
    (root: HTMLElement) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const targets: Text[] = [];
      while (walker.nextNode()) {
        const n = walker.currentNode as Text;
        if (n.nodeValue && /⟦S\d+⟧/.test(n.nodeValue)) targets.push(n);
      }
      for (const node of targets) {
        const frag = document.createDocumentFragment();
        const parts = (node.nodeValue ?? "").split(/(⟦S\d+⟧)/);
        for (const p of parts) {
          const m = p.match(/^⟦S(\d+)⟧$/);
          if (!m) {
            frag.appendChild(document.createTextNode(p));
            continue;
          }
          const idx = Number(m[1]);
          const btn = document.createElement("button");
          btn.type = "button";
          btn.dataset.slot = String(idx);
          btn.className = "slot-chip";
          frag.appendChild(btn);
        }
        node.parentNode?.replaceChild(frag, node);
      }
    },
    []
  );

  /** 칩 라벨/스타일 갱신 (매핑 변경 시) */
  const refreshChips = useCallback(() => {
    const root = previewRef.current;
    if (!root) return;
    root.querySelectorAll<HTMLButtonElement>("button[data-slot]").forEach((b) => {
      const idx = Number(b.dataset.slot);
      const token = mapping[idx];
      const opt = token ? optByToken.get(token) : undefined;
      const label = token
        ? token.startsWith("lit:")
          ? `"${token.slice(4)}"`
          : (opt?.label ?? token)
        : `빈칸 ${idx}`;
      b.textContent = label;
      const bound = !!token;
      const isActive = active === idx;
      b.style.cssText = [
        "display:inline-block",
        "margin:0 2px",
        "padding:0 6px",
        "border-radius:4px",
        "font-size:11px",
        "line-height:1.6",
        "cursor:pointer",
        "vertical-align:middle",
        `border:1px solid ${isActive ? "#0284c7" : bound ? "#10b981" : "#f59e0b"}`,
        `background:${isActive ? "#e0f2fe" : bound ? "#d1fae5" : "#fef3c7"}`,
        `color:${bound ? "#065f46" : "#92400e"}`,
      ].join(";");
    });
  }, [mapping, active, optByToken]);

  useEffect(() => {
    refreshChips();
  }, [refreshChips]);

  async function scan() {
    if (!file) return;
    setBusy(true);
    setError(null);
    setSlots(null);
    setMapping({});
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setResultUrl(null);

    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/test/form-fill/scan", { method: "POST", body: fd });
      const j = (await res.json()) as {
        slots?: Slot[];
        markedDocx?: string;
        error?: string;
      };
      if (!res.ok || !j.slots || !j.markedDocx) {
        setError({ message: j.error ?? `탐지 실패 (HTTP ${res.status})`, details: [] });
        return;
      }
      setSlots(j.slots);

      // 마커가 박힌 docx 를 렌더 → 마커를 클릭 칩으로
      const bin = Uint8Array.from(atob(j.markedDocx), (c) => c.charCodeAt(0));
      const blob = new Blob([bin], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      const { renderAsync } = await import("docx-preview");
      if (previewRef.current) {
        previewRef.current.innerHTML = "";
        await renderAsync(blob, previewRef.current, undefined, {
          className: "docx",
          inWrapper: true,
        });
        decorateMarkers(previewRef.current);
        refreshChips();
      }
    } catch (e) {
      setError({ message: (e as Error).message, details: [] });
    } finally {
      setBusy(false);
    }
  }

  // 칩 클릭 → 해당 슬롯 선택
  useEffect(() => {
    const root = previewRef.current;
    if (!root) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "BUTTON" && t.dataset.slot) {
        e.preventDefault();
        setActive(Number(t.dataset.slot));
      }
    };
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, [slots]);

  async function fill() {
    if (!file) return;
    setBusy(true);
    setError(null);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setResultUrl(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("mapping", JSON.stringify(mapping));
      const res = await fetch("/test/form-fill/fill", { method: "POST", body: fd });
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
      setResultUrl(URL.createObjectURL(blob));
      try {
        const { renderAsync } = await import("docx-preview");
        if (resultRef.current) {
          resultRef.current.innerHTML = "";
          await renderAsync(blob, resultRef.current, undefined, {
            className: "docx",
            inWrapper: true,
          });
        }
      } catch {
        /* preview 실패 무시 */
      }
    } catch (e) {
      setError({ message: (e as Error).message, details: [] });
    } finally {
      setBusy(false);
    }
  }

  const boundCount = Object.values(mapping).filter(Boolean).length;
  const activeSlot = slots?.find((s) => s.index === active) ?? null;
  const groups = Array.from(new Set(options.map((o) => o.group)));

  return (
    <div className="space-y-4">
      <Card className="space-y-2 p-5">
        <h2 className="text-sm font-semibold">이 테스트가 증명하는 것</h2>
        <p className="text-sm text-muted-foreground">
          <strong>
            &quot;지원자 : ______ (인)&quot;, &quot;___년 ___월 ___일&quot;
          </strong>{" "}
          처럼 <strong>한 칸/문단 안에 다른 텍스트와 섞인 빈칸</strong>을, 주변
          글자(<code>년</code>, <code>(인)</code>)를 그대로 둔 채 그 자리에만 값을
          채웁니다. 셀을 통째로 덮어쓰던 기존 방식이 못 하던 지점입니다. Word 편집은
          필요 없습니다.
        </p>
      </Card>

      {/* 1) 업로드 → 빈칸 탐지 */}
      <Card className="space-y-3 p-5">
        <h2 className="text-sm font-semibold">1) 양식 업로드 → 빈칸 탐지</h2>
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-muted">
            <Upload className="size-4" />
            {file ? "다른 파일" : "DOCX 선택"}
            <input
              type="file"
              accept=".docx"
              className="hidden"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setSlots(null);
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
          <Button type="button" onClick={scan} disabled={!file || busy}>
            {busy && !slots ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                탐지 중...
              </>
            ) : (
              "빈칸 탐지"
            )}
          </Button>
          {slots ? (
            <span className="text-sm text-muted-foreground">
              빈칸 <strong>{slots.length}</strong>개 · 연결됨{" "}
              <strong className="text-emerald-700">{boundCount}</strong>
            </span>
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
          </div>
        ) : null}
      </Card>

      {slots ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
          {/* 2) 미리보기 — 빈칸 클릭 */}
          <Card className="p-5">
            <h2 className="mb-2 text-sm font-semibold">
              2) 빈칸을 클릭해서 값 출처를 연결하세요
            </h2>
            <p className="mb-3 text-xs text-muted-foreground">
              <span className="rounded bg-amber-100 px-1 text-amber-800">노랑</span>{" "}
              = 미연결 ·{" "}
              <span className="rounded bg-emerald-100 px-1 text-emerald-800">
                초록
              </span>{" "}
              = 연결됨 ·{" "}
              <span className="rounded bg-sky-100 px-1 text-sky-800">파랑</span> =
              선택 중
            </p>
            <div
              ref={previewRef}
              className="max-h-[70vh] overflow-auto rounded-md border bg-white p-2"
            />
          </Card>

          {/* 3) 바인딩 패널 */}
          <div className="space-y-4">
            <Card className="p-5">
              <h2 className="mb-2 text-sm font-semibold">3) 값 출처 선택</h2>
              {activeSlot ? (
                <>
                  <div className="mb-2 rounded-md border bg-muted/40 p-2 text-xs">
                    <div className="mb-1 flex items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px]">
                        빈칸 {activeSlot.index}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        {KIND_LABEL[activeSlot.kind]}
                      </Badge>
                    </div>
                    <div className="text-muted-foreground">
                      앞: <span className="text-foreground">{activeSlot.before || "—"}</span>
                      {" · "}뒤: <span className="text-foreground">{activeSlot.after || "—"}</span>
                    </div>
                  </div>

                  <select
                    value={
                      mapping[activeSlot.index]?.startsWith("lit:")
                        ? "__lit__"
                        : (mapping[activeSlot.index] ?? "")
                    }
                    onChange={(e) => {
                      const v = e.target.value;
                      setMapping((cur) => {
                        const next = { ...cur };
                        if (!v) delete next[activeSlot.index];
                        else if (v === "__lit__") next[activeSlot.index] = "lit:";
                        else next[activeSlot.index] = v;
                        return next;
                      });
                    }}
                    className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                  >
                    <option value="">— 연결 안 함 —</option>
                    <option value="__lit__">✎ 직접 입력</option>
                    {groups.map((g) => (
                      <optgroup key={g} label={g}>
                        {options
                          .filter((o) => o.group === g)
                          .map((o) => (
                            <option key={o.token} value={o.token}>
                              {o.kind === "image" ? "🖼 " : ""}
                              {o.label}
                              {o.kind === "text" && values[o.token]
                                ? ` — ${values[o.token]}`
                                : ""}
                            </option>
                          ))}
                      </optgroup>
                    ))}
                  </select>

                  {mapping[activeSlot.index]?.startsWith("lit:") ? (
                    <input
                      type="text"
                      autoFocus
                      value={mapping[activeSlot.index].slice(4)}
                      onChange={(e) =>
                        setMapping((cur) => ({
                          ...cur,
                          [activeSlot.index]: `lit:${e.target.value}`,
                        }))
                      }
                      placeholder="이 양식에만 쓰는 값"
                      className="mt-2 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    />
                  ) : null}
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  왼쪽 미리보기에서 빈칸(노란 칩)을 클릭하세요.
                </p>
              )}
            </Card>

            {/* 4) 채우기 */}
            <Card className="space-y-3 p-5">
              <h2 className="text-sm font-semibold">4) 테스트 데이터로 채우기</h2>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  onClick={fill}
                  disabled={busy || boundCount === 0}
                >
                  {busy && slots ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      채우는 중...
                    </>
                  ) : (
                    `채우기 (${boundCount}개)`
                  )}
                </Button>
                {resultUrl ? (
                  <a
                    href={resultUrl}
                    download={`filled-${file?.name ?? "form.docx"}`}
                    className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    <Download className="size-4" />
                    다운로드
                  </a>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                연결 안 한 빈칸은 원래 상태로 되돌립니다(레이아웃 보존).
              </p>
            </Card>
          </div>
        </div>
      ) : null}

      {/* 결과 */}
      {resultUrl ? (
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold">
            채운 결과 (최종 확인은 Word 로)
          </h2>
          <div
            ref={resultRef}
            className="max-h-[70vh] overflow-auto rounded-md border bg-white p-2"
          />
        </Card>
      ) : null}
    </div>
  );
}
