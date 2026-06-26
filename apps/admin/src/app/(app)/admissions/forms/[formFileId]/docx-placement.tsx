"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, Loader2, MousePointerClick, Save, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  placementDocxAction,
  previewDocxAction,
  saveSlotMappingAction,
} from "./docx-actions";

export type MapChoice = { key: string; label: string; aliases?: string[] };
type SlotInfo = { slot: number; hint: string };

const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();

function b64ToBlob(b64: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

export function DocxPlacement({
  formFileId,
  choices,
  savedSlots,
}: {
  formFileId: string;
  choices: MapChoice[];
  savedSlots: Record<string, string>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const [, force] = useReducer((x) => x + 1, 0);

  const labelOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of choices) m.set(c.key, c.label);
    return m;
  }, [choices]);

  // 정규화 별칭 → key (칸 힌트 자동 추천용)
  const aliasIndex = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of choices) {
      m.set(norm(c.label), c.key);
      for (const a of c.aliases ?? []) m.set(norm(a), c.key);
    }
    return m;
  }, [choices]);

  const slotsRef = useRef<SlotInfo[]>([]);
  const mappingRef = useRef<Record<string, string>>({ ...savedSlots });
  const chipEls = useRef<Map<number, HTMLElement>>(new Map());
  const activeRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const hintOf = (slot: number) =>
    slotsRef.current.find((s) => s.slot === slot)?.hint ?? "";

  // 슬롯의 "유효 키": 명시 매핑 우선, 없으면 힌트 자동추천
  const effectiveKey = useCallback(
    (slot: number): { key: string; explicit: boolean } | null => {
      const sk = String(slot);
      if (sk in mappingRef.current) {
        const k = mappingRef.current[sk];
        return k ? { key: k, explicit: true } : null; // "" = 명시적 비움
      }
      const auto = aliasIndex.get(norm(hintOf(slot)));
      return auto ? { key: auto, explicit: false } : null;
    },
    [aliasIndex]
  );

  const repaint = useCallback(() => {
    for (const [slot, el] of chipEls.current) {
      const eff = effectiveKey(slot);
      const active = activeRef.current === slot;
      let text = "＋";
      let state = "empty";
      const sk = String(slot);
      if (sk in mappingRef.current && !mappingRef.current[sk]) {
        text = "✕ 비움";
        state = "skip";
      } else if (eff) {
        text = labelOf.get(eff.key) ?? eff.key;
        state = eff.explicit ? "set" : "auto";
      }
      el.textContent = text;
      el.dataset.state = state;
      el.dataset.active = active ? "1" : "0";
      const hint = hintOf(slot);
      el.title =
        (hint ? `${hint} → ` : "") +
        (state === "empty"
          ? "미지정"
          : state === "skip"
            ? "채우지 않음"
            : text);
    }
  }, [effectiveKey, labelOf]);

  const buildChips = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    chipEls.current.clear();
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    const targets: Text[] = [];
    let node: Node | null;
    while ((node = walker.nextNode()))
      if (/⟦S\d+⟧/.test(node.nodeValue || "")) targets.push(node as Text);
    for (const textNode of targets) {
      const parent = textNode.parentNode;
      if (!parent) continue;
      const parts = (textNode.nodeValue || "").split(/(⟦S\d+⟧)/);
      const frag = document.createDocumentFragment();
      for (const part of parts) {
        const mm = part.match(/^⟦S(\d+)⟧$/);
        if (mm) {
          const slot = Number(mm[1]);
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "slot-chip";
          btn.dataset.slot = String(slot);
          frag.appendChild(btn);
          chipEls.current.set(slot, btn);
        } else if (part) {
          frag.appendChild(document.createTextNode(part));
        }
      }
      parent.replaceChild(frag, textNode);
    }
    repaint();
  }, [repaint]);

  // 편집기 열기 → 마커 박은 docx 받아 docx-preview 로 렌더 → 칩 생성
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const r = await placementDocxAction(formFileId);
      if (cancelled) return;
      if (!r.ok) {
        toast.error("배치 편집 준비 실패", { description: r.error });
        setLoading(false);
        setOpen(false);
        return;
      }
      slotsRef.current = r.slots;
      const container = containerRef.current;
      if (!container) return;
      container.innerHTML = "";
      try {
        const { renderAsync } = await import("docx-preview");
        if (cancelled) return;
        await renderAsync(b64ToBlob(r.base64), container, undefined, {
          className: "docx",
          inWrapper: true,
          breakPages: true,
          experimental: true,
        });
        if (cancelled) return;
        buildChips();
      } catch (e) {
        if (!cancelled)
          container.innerHTML = `<p style="color:#dc2626;padding:1rem">렌더 실패: ${
            e instanceof Error ? e.message : String(e)
          }</p>`;
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, formFileId, buildChips]);

  // 칩 클릭 → 활성 슬롯 지정
  const onContainerClick = (e: React.MouseEvent) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>(".slot-chip");
    if (!t) return;
    e.preventDefault();
    const slot = Number(t.dataset.slot);
    activeRef.current = activeRef.current === slot ? null : slot;
    repaint();
    force();
    // 화면 안으로 스크롤
    t.scrollIntoView({ block: "center", behavior: "smooth" });
  };

  function assign(slot: number, key: string) {
    mappingRef.current = { ...mappingRef.current, [String(slot)]: key };
    repaint();
    force();
  }
  function clearExplicit(slot: number) {
    const next = { ...mappingRef.current };
    delete next[String(slot)];
    mappingRef.current = next;
    repaint();
    force();
  }

  function onSave() {
    // 빈 문자열(명시 비움) 포함 그대로 저장. 단, 자동추천만 있고 명시 안 한 건 저장 안 함.
    startTransition(async () => {
      const r = await saveSlotMappingAction(formFileId, mappingRef.current);
      if (r.ok) {
        toast.success("배치를 저장했습니다.");
        router.refresh();
      } else toast.error("저장 실패", { description: r.error });
    });
  }

  // 채움 미리보기
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const previewBytesRef = useRef<Blob | null>(null);

  async function onPreview() {
    setPreviewBusy(true);
    try {
      const r = await previewDocxAction(formFileId, {
        slotMapping: mappingRef.current,
      });
      if (!r.ok) {
        toast.error("미리보기 실패", { description: r.error });
        return;
      }
      previewBytesRef.current = b64ToBlob(r.base64);
      setPreviewOpen(true);
    } finally {
      setPreviewBusy(false);
    }
  }
  useEffect(() => {
    if (!previewOpen) return;
    const c = previewRef.current;
    const blob = previewBytesRef.current;
    if (!c || !blob) return;
    let cancelled = false;
    c.innerHTML = "";
    (async () => {
      const { renderAsync } = await import("docx-preview");
      if (cancelled) return;
      await renderAsync(blob, c, undefined, {
        className: "docx",
        inWrapper: true,
        breakPages: true,
        experimental: true,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [previewOpen]);

  const activeSlot = activeRef.current;
  const assignedCount = Object.values(mappingRef.current).filter((v) => v).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">빈칸 클릭 배치 (정밀)</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            미리보기에서 빈칸을 클릭해 <strong>어느 칸에 어떤 값</strong>을 넣을지
            직접 지정합니다. 지정 안 한 칸은 라벨 자동매칭으로 채워집니다.
            {assignedCount > 0 ? (
              <>
                {" "}
                · 지정됨 <Badge variant="secondary">{assignedCount}</Badge>
              </>
            ) : null}
          </p>
        </div>
        <Button type="button" size="sm" onClick={() => setOpen(true)}>
          <MousePointerClick className="size-3.5" />
          빈칸 클릭 배치 편집
        </Button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/60 p-2 sm:p-4">
          <div className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <span className="text-sm font-semibold">
                빈칸 클릭 배치 편집 · 빈칸을 클릭 → 아래에서 값 선택
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onPreview}
                  disabled={previewBusy}
                >
                  {previewBusy ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Eye className="size-3.5" />
                  )}
                  채움 미리보기
                </Button>
                <Button type="button" size="sm" onClick={onSave} disabled={pending}>
                  {pending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Save className="size-3.5" />
                  )}
                  저장
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setOpen(false)}
                >
                  <X className="size-3.5" />
                  닫기
                </Button>
              </div>
            </div>

            <div className="docx-edit-host relative min-h-0 flex-1 overflow-auto bg-neutral-200 p-4">
              {loading ? (
                <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> 문서 준비 중…
                </div>
              ) : null}
              <div ref={containerRef} onClick={onContainerClick} />
            </div>

            {/* 활성 슬롯 값 선택 바 */}
            <div className="border-t border-border bg-muted/30 px-4 py-2.5">
              {activeSlot === null ? (
                <p className="text-sm text-muted-foreground">
                  <Sparkles className="mr-1 inline size-3.5" />
                  문서에서 <strong>＋</strong> 또는 값이 표시된 빈칸을 클릭하세요.
                  (회색=자동매칭 / 파랑=직접지정)
                </p>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm">
                    빈칸 <Badge variant="outline">#{activeSlot}</Badge>
                    {hintOf(activeSlot) ? (
                      <span className="ml-1.5 text-muted-foreground">
                        (앞 라벨: {hintOf(activeSlot)})
                      </span>
                    ) : null}
                  </span>
                  <select
                    value={mappingRef.current[String(activeSlot)] ?? "__auto__"}
                    onChange={(e) => {
                      if (e.target.value === "__auto__") clearExplicit(activeSlot);
                      else assign(activeSlot, e.target.value);
                    }}
                    className="h-8 min-w-[14rem] rounded-md border border-input bg-background px-2 text-sm"
                  >
                    <option value="__auto__">— 자동(라벨매칭)에 맡김 —</option>
                    <option value="">✕ 채우지 않음</option>
                    {choices.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      activeRef.current = null;
                      repaint();
                      force();
                    }}
                  >
                    완료
                  </Button>
                </div>
              )}
            </div>
          </div>

          {previewOpen ? (
            <div
              className="fixed inset-0 z-[60] flex flex-col bg-black/70 p-3 sm:p-6"
              onClick={() => setPreviewOpen(false)}
            >
              <div
                className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                  <span className="text-sm font-semibold">
                    채움 미리보기 (더미 학생값)
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPreviewOpen(false)}
                  >
                    <X className="size-3.5" />
                    닫기
                  </Button>
                </div>
                <div className="docx-preview-host min-h-0 flex-1 overflow-auto bg-neutral-200 p-4">
                  <div ref={previewRef} />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <style>{`
        .docx-edit-host .docx-wrapper, .docx-preview-host .docx-wrapper { background: transparent; padding: 0; }
        .docx-edit-host .docx-wrapper > section.docx, .docx-preview-host .docx-wrapper > section.docx {
          margin: 0 auto 1rem; box-shadow: 0 1px 6px rgba(0,0,0,0.2); background: #fff;
        }
        /* Word 원본이 고정 너비 표 → docx-preview 가 퍼지지 않게 강제 고정 + 칸 넘침 클립 */
        .docx-edit-host table, .docx-preview-host table { table-layout: fixed; }
        .docx-edit-host td, .docx-edit-host th, .docx-preview-host td, .docx-preview-host th {
          overflow: hidden; word-break: break-word;
        }
        .slot-chip {
          display: inline-block; max-width: 100%; min-width: 1.25rem; padding: 0 5px; margin: 0 1px;
          font-size: 11px; line-height: 1.5; border-radius: 4px; cursor: pointer;
          vertical-align: bottom; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          border: 1px dashed #94a3b8; background: #f1f5f9; color: #475569;
        }
        .slot-chip[data-state="auto"] { border-style: solid; border-color: #cbd5e1; background: #e2e8f0; color: #334155; }
        .slot-chip[data-state="set"]  { border-style: solid; border-color: #2563eb; background: #dbeafe; color: #1d4ed8; font-weight: 600; }
        .slot-chip[data-state="skip"] { border-color: #fca5a5; background: #fef2f2; color: #b91c1c; }
        .slot-chip[data-active="1"] { outline: 2px solid #f59e0b; outline-offset: 1px; }
      `}</style>
    </div>
  );
}
