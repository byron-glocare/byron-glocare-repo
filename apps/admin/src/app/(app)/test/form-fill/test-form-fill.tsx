"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, FileText, Loader2, Upload, Wand2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { autoMap, type CatalogType } from "@/lib/test/auto-map";

type BindingOption = {
  token: string;
  label: string;
  group: string;
  kind: "text" | "image";
};

type TestStudent = { id: string; name: string };

type Engine = "v1" | "v2";

/** v1(정규식) + v2(구조적) 슬롯을 함께 다루는 느슨한 타입 */
type Slot = {
  index: number;
  kind: string;
  // v1
  original?: string;
  before?: string;
  after?: string;
  // v2
  id?: string;
  addr?: string | string[];
  boxes?: number;
  options?: string[];
  blanks?: number;
  line_text?: string;
  template?: string;
  unit?: "year" | "month" | "day";
  label_left?: string | null;
  label_above?: string | null;
};

const KIND_LABEL: Record<string, string> = {
  // v1
  underscore: "밑줄",
  spaces: "공백",
  empty_cell: "빈 셀",
  // v2
  text: "빈 셀",
  char_grid: "글자칸 격자",
  checkbox_group: "체크박스",
  underline_blank: "밑줄+탭 빈칸",
  anchor_split: "앵커 분할",
  date_part: "날짜 단위",
};

const DATE_UNIT_KO: Record<string, string> = {
  year: "년",
  month: "월",
  day: "일",
};

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function TestFormFill({
  options,
  values,
  catalog,
  students,
}: {
  options: BindingOption[];
  values: Record<string, string>;
  catalog: CatalogType[];
  students: TestStudent[];
}) {
  const [engine, setEngine] = useState<Engine>("v2");
  const [studentId, setStudentId] = useState<string>("");
  const [studentValues, setStudentValues] = useState<Record<string, string>>({});
  const [autoNote, setAutoNote] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [mapping, setMapping] = useState<Record<number, string>>({});
  const [active, setActive] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; details: string[] } | null>(
    null
  );
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  // 마커 docx(base64) / 채움 결과 blob — 렌더는 카드가 마운트된 뒤 useEffect 에서.
  const [markedDocx, setMarkedDocx] = useState<string | null>(null);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);

  const optByToken = useMemo(
    () => new Map(options.map((o) => [o.token, o])),
    [options]
  );
  const slotByIndex = useMemo(
    () => new Map((slots ?? []).map((s) => [s.index, s])),
    [slots]
  );

  /** 매핑 토큰 → 칩에 보일 라벨 */
  const labelForToken = useCallback(
    (idx: number, token: string | undefined): string => {
      if (!token) return `빈칸 ${idx}`;
      if (token.startsWith("lit:")) return `"${token.slice(4)}"`;
      if (token.startsWith("opt:")) {
        const s = slotByIndex.get(idx);
        const oi = Number(token.slice(4));
        return `☑ ${s?.options?.[oi] ?? oi}`;
      }
      return optByToken.get(token)?.label ?? token;
    },
    [optByToken, slotByIndex]
  );

  /** 미리보기 DOM 의 ⟦S{n}⟧ 마커 → 클릭 가능한 칩으로 치환 */
  const decorateMarkers = useCallback((root: HTMLElement) => {
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
  }, []);

  /** 칩 라벨/스타일 갱신 (매핑 변경 시) */
  const refreshChips = useCallback(() => {
    const root = previewRef.current;
    if (!root) return;
    root.querySelectorAll<HTMLButtonElement>("button[data-slot]").forEach((b) => {
      const idx = Number(b.dataset.slot);
      const token = mapping[idx];
      b.textContent = labelForToken(idx, token);
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
  }, [mapping, active, labelForToken]);

  useEffect(() => {
    refreshChips();
  }, [refreshChips]);

  async function scan() {
    if (!file) return;
    setBusy(true);
    setError(null);
    setSlots(null);
    setMarkedDocx(null);
    setMapping({});
    setActive(null);
    setAutoNote(null);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setResultUrl(null);
    setResultBlob(null);

    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("engine", engine);
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
      // 실제 렌더는 미리보기 카드가 마운트된 뒤 아래 useEffect 에서 (previewRef 보장)
      setMarkedDocx(j.markedDocx);
    } catch (e) {
      setError({ message: (e as Error).message, details: [] });
    } finally {
      setBusy(false);
    }
  }

  // 마커 docx → docx-preview 렌더 + 마커를 클릭 칩으로 (카드 마운트 후 실행)
  useEffect(() => {
    if (!markedDocx) return;
    let cancelled = false;
    (async () => {
      try {
        const bin = Uint8Array.from(atob(markedDocx), (c) => c.charCodeAt(0));
        const blob = new Blob([bin], { type: DOCX_MIME });
        const { renderAsync } = await import("docx-preview");
        if (cancelled || !previewRef.current) return;
        previewRef.current.innerHTML = "";
        await renderAsync(blob, previewRef.current, undefined, {
          className: "docx",
          inWrapper: true,
        });
        if (cancelled || !previewRef.current) return;
        decorateMarkers(previewRef.current);
        refreshChips();
      } catch (e) {
        setError({ message: (e as Error).message, details: [] });
      }
    })();
    return () => {
      cancelled = true;
    };
    // decorateMarkers 는 안정적, refreshChips 는 초기 1회만 필요(이후 매핑 변경은 별도 effect)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markedDocx]);

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
      fd.set("engine", engine);
      fd.set("studentId", studentId);
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
      setResultBlob(blob); // 렌더는 아래 useEffect (결과 카드 마운트 후)
    } catch (e) {
      setError({ message: (e as Error).message, details: [] });
    } finally {
      setBusy(false);
    }
  }

  // 채운 결과 blob → docx-preview 렌더 (결과 카드 마운트 후 실행)
  useEffect(() => {
    if (!resultBlob) return;
    let cancelled = false;
    (async () => {
      try {
        const { renderAsync } = await import("docx-preview");
        if (cancelled || !resultRef.current) return;
        resultRef.current.innerHTML = "";
        await renderAsync(resultBlob, resultRef.current, undefined, {
          className: "docx",
          inWrapper: true,
        });
      } catch {
        /* preview 실패 무시 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resultBlob]);

  async function loadStudent(id: string) {
    setStudentId(id);
    setStudentValues({});
    if (!id) return;
    try {
      const res = await fetch(
        `/test/form-fill/student?id=${encodeURIComponent(id)}`
      );
      const j = (await res.json()) as { values?: Record<string, string> };
      if (res.ok && j.values) setStudentValues(j.values);
    } catch {
      /* ignore */
    }
  }

  function runAutoMap() {
    if (!slots) return;
    const validTokens = new Set(options.map((o) => o.token));
    const { mapping: m, mappedCount } = autoMap(
      slots,
      catalog,
      validTokens,
      Object.keys(studentValues).length ? studentValues : undefined
    );
    setMapping(m);
    setActive(null);
    setAutoNote(`자동 매핑 완료 — ${mappedCount} / ${slots.length}개 연결됨`);
  }

  const boundCount = Object.values(mapping).filter(Boolean).length;
  const activeSlot = slots?.find((s) => s.index === active) ?? null;
  const groups = Array.from(new Set(options.map((o) => o.group)));
  const kindCounts = (slots ?? []).reduce<Record<string, number>>((acc, s) => {
    acc[s.kind] = (acc[s.kind] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <Card className="space-y-2 p-5">
        <h2 className="text-sm font-semibold">엔진 선택</h2>
        <div className="flex flex-wrap items-center gap-2">
          {(["v2", "v1"] as Engine[]).map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => {
                if (e === engine) return;
                setEngine(e);
                setSlots(null);
                setMarkedDocx(null);
                setMapping({});
                setActive(null);
                setError(null);
              }}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                engine === e
                  ? "border-sky-500 bg-sky-50 font-semibold text-sky-800"
                  : "border-input bg-background hover:bg-muted"
              }`}
            >
              {e === "v2" ? "v2 · 구조적 표 격자 탐지" : "v1 · 정규식(밑줄·공백·빈셀)"}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          <strong>v2</strong> 는 표를 gridSpan/vMerge 반영해 격자로 재구성하고{" "}
          <strong>탭 빈칸·체크박스·주민번호 격자·앵커</strong>까지 구조적으로 잡습니다.
          같은 양식을 v1/v2 로 각각 돌려 커버리지를 비교해 보세요.
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
              `빈칸 탐지 (${engine})`
            )}
          </Button>
          {slots ? (
            <span className="text-sm text-muted-foreground">
              빈칸 <strong>{slots.length}</strong>개 · 연결됨{" "}
              <strong className="text-emerald-700">{boundCount}</strong>
            </span>
          ) : null}
        </div>
        {slots && slots.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(kindCounts).map(([k, n]) => (
              <Badge key={k} variant="secondary" className="text-[10px]">
                {KIND_LABEL[k] ?? k} {n}
              </Badge>
            ))}
          </div>
        ) : null}
        {slots ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 p-2.5">
            <span className="text-xs font-medium">테스트 학생</span>
            <select
              value={studentId}
              onChange={(e) => loadStudent(e.target.value)}
              className="rounded-md border border-input bg-background px-2 py-1 text-sm"
            >
              <option value="">— 더미값(테스트+라벨) —</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {studentId ? (
              <span className="text-xs text-muted-foreground">
                값 {Object.keys(studentValues).length}개 로드됨
              </span>
            ) : null}
            <span className="mx-1 h-4 w-px bg-border" />
            <Button
              type="button"
              variant="outline"
              onClick={runAutoMap}
              className="h-8 gap-1.5"
            >
              <Wand2 className="size-4" />
              자동 매핑
            </Button>
            {autoNote ? (
              <span className="text-xs font-medium text-sky-700">{autoNote}</span>
            ) : null}
          </div>
        ) : null}
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
                    <div className="mb-1 flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px]">
                        빈칸 {activeSlot.index}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        {KIND_LABEL[activeSlot.kind] ?? activeSlot.kind}
                      </Badge>
                      {activeSlot.boxes ? (
                        <Badge variant="secondary" className="text-[10px]">
                          {activeSlot.boxes}칸
                        </Badge>
                      ) : null}
                      {activeSlot.unit ? (
                        <Badge variant="secondary" className="text-[10px]">
                          {DATE_UNIT_KO[activeSlot.unit]}
                        </Badge>
                      ) : null}
                    </div>
                    {engine === "v2" ? (
                      <div className="text-muted-foreground">
                        {activeSlot.label_left ? (
                          <div>
                            왼쪽:{" "}
                            <span className="text-foreground">
                              {activeSlot.label_left}
                            </span>
                          </div>
                        ) : null}
                        {activeSlot.label_above ? (
                          <div>
                            위:{" "}
                            <span className="text-foreground">
                              {activeSlot.label_above}
                            </span>
                          </div>
                        ) : null}
                        {activeSlot.line_text ? (
                          <div>
                            문단:{" "}
                            <span className="text-foreground">
                              {activeSlot.line_text}
                            </span>
                          </div>
                        ) : null}
                        {!activeSlot.label_left &&
                        !activeSlot.label_above &&
                        !activeSlot.line_text ? (
                          <span>라벨 문맥 없음</span>
                        ) : null}
                      </div>
                    ) : (
                      <div className="text-muted-foreground">
                        앞:{" "}
                        <span className="text-foreground">
                          {activeSlot.before || "—"}
                        </span>
                        {" · "}뒤:{" "}
                        <span className="text-foreground">
                          {activeSlot.after || "—"}
                        </span>
                      </div>
                    )}
                  </div>

                  {activeSlot.kind === "checkbox_group" &&
                  activeSlot.options ? (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">
                        체크할 항목을 고르세요 (☑)
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          setMapping((cur) => {
                            const next = { ...cur };
                            delete next[activeSlot.index];
                            return next;
                          })
                        }
                        className={`block w-full rounded-md border px-2 py-1.5 text-left text-sm ${
                          !mapping[activeSlot.index]
                            ? "border-sky-500 bg-sky-50"
                            : "border-input hover:bg-muted"
                        }`}
                      >
                        — 선택 안 함 —
                      </button>
                      {activeSlot.options.map((opt, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() =>
                            setMapping((cur) => ({
                              ...cur,
                              [activeSlot.index]: `opt:${i}`,
                            }))
                          }
                          className={`block w-full rounded-md border px-2 py-1.5 text-left text-sm ${
                            mapping[activeSlot.index] === `opt:${i}`
                              ? "border-emerald-500 bg-emerald-50 font-medium"
                              : "border-input hover:bg-muted"
                          }`}
                        >
                          ☑ {opt || `(옵션 ${i})`}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <>
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
                            else if (v === "__lit__")
                              next[activeSlot.index] = "lit:";
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
                  )}
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
                연결 안 한 빈칸은 건드리지 않습니다(레이아웃 보존).
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
