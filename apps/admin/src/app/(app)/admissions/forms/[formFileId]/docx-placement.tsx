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
  aiMapSlotsAction,
  placementDocxAction,
  previewDocxAction,
  saveSlotMappingAction,
} from "./docx-actions";

export type MapChoice = { key: string; label: string; aliases?: string[] };
type SlotInfo = {
  slot: number;
  emptyIndex: number | null;
  empty: boolean;
  hint: string;
};

// 라벨 매칭용 정규화: 공백·괄호·구두점·별표 등 제거 후 소문자.
//   (기존엔 공백만 제거 → 정확 일치만 잡혀 "자동 추천이 잘 안 됨". 이제 부분 일치까지.)
const norm = (s: string) =>
  (s || "")
    .replace(/[\s　]+/g, "")
    .replace(/[()[\]{}<>:：·・,.\/*\-_~"'’“”|]/g, "")
    .toLowerCase();

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
  // 자동 배치 제안 대기(적용/미적용). null = 대기 없음.
  const [pendingAuto, setPendingAuto] = useState<{
    mapping: Record<string, string>;
    count: number;
    mode: "fill" | "overwrite";
  } | null>(null);

  const labelOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of choices) m.set(c.key, c.label);
    return m;
  }, [choices]);

  // 매칭 후보 인덱스: key → 정규화된 이름·별칭 목록 (2자 이상)
  const matchIndex = useMemo(
    () =>
      choices.map((c) => ({
        key: c.key,
        terms: [c.label, ...(c.aliases ?? [])]
          .map(norm)
          .filter((t) => t.length >= 2),
      })),
    [choices]
  );

  // 힌트(빈칸 앞 라벨)로 가장 잘 맞는 표준데이터 key 추정.
  //   1) 완전 일치 → 2) 양방향 부분 포함(가장 긴 후보 우선). 없으면 null.
  const bestMatch = useCallback(
    (hintRaw: string): string | null => {
      const hint = norm(hintRaw);
      if (hint.length < 2) return null;
      for (const c of matchIndex) if (c.terms.includes(hint)) return c.key;
      let best: { key: string; len: number } | null = null;
      for (const c of matchIndex)
        for (const t of c.terms)
          if (hint.includes(t) || t.includes(hint))
            if (!best || t.length > best.len) best = { key: c.key, len: t.length };
      return best?.key ?? null;
    },
    [matchIndex]
  );

  const slotsRef = useRef<SlotInfo[]>([]);
  const mappingRef = useRef<Record<string, string>>({ ...savedSlots });
  const chipEls = useRef<Map<number, HTMLElement>>(new Map());
  const activeRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const infoOf = (slot: number) =>
    slotsRef.current.find((s) => s.slot === slot);
  const hintOf = (slot: number) => infoOf(slot)?.hint ?? "";
  const isEmpty = (slot: number) => infoOf(slot)?.empty ?? true;

  // 슬롯 매핑은 a{전체셀번호} 우선, 빈칸이면 레거시 {빈칸번호}, 없으면 힌트 자동추천.
  const explicitState = (
    slot: number
  ): { key: string } | { skip: true } | null => {
    const ak = `a${slot}`;
    if (ak in mappingRef.current) {
      const k = mappingRef.current[ak];
      return k ? { key: k } : { skip: true };
    }
    const si = infoOf(slot);
    if (si?.empty && si.emptyIndex !== null) {
      const lk = String(si.emptyIndex);
      if (lk in mappingRef.current) {
        const k = mappingRef.current[lk];
        return k ? { key: k } : { skip: true };
      }
    }
    return null;
  };
  // 칩에 표시할 유효 키 (명시 / 자동추천 / 없음)
  const effectiveKey = useCallback(
    (slot: number): { key: string; explicit: boolean } | null => {
      const ex = explicitState(slot);
      if (ex) return "skip" in ex ? null : { key: ex.key, explicit: true };
      if (isEmpty(slot)) {
        const auto = bestMatch(hintOf(slot));
        if (auto) return { key: auto, explicit: false };
      }
      return null;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bestMatch]
  );

  const repaint = useCallback(() => {
    for (const [slot, el] of chipEls.current) {
      const ex = explicitState(slot);
      const eff = effectiveKey(slot);
      const active = activeRef.current === slot;
      let text = "＋";
      let state = "empty";
      if (ex && "skip" in ex) {
        text = "✕ 비움";
        state = "skip";
      } else if (eff) {
        text = labelOf.get(eff.key) ?? eff.key;
        state = eff.explicit ? "set" : "auto";
      }
      el.textContent = text;
      el.dataset.state = state;
      el.dataset.active = active ? "1" : "0";
      el.dataset.empty = isEmpty(slot) ? "1" : "0";
      const hint = hintOf(slot);
      el.title =
        (hint ? `${hint} → ` : "") +
        (state === "empty"
          ? "미지정 (클릭해 값 지정)"
          : state === "skip"
            ? "채우지 않음"
            : text);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const mm = (textNode.nodeValue || "").match(/⟦S(\d+)⟧/);
      if (!mm) continue;
      const slot = Number(mm[1]);
      // 마커 텍스트는 제거(흐름에서 빼야 칸이 안 늘어남)
      textNode.nodeValue = (textNode.nodeValue || "").replace(/⟦S\d+⟧/g, "");
      // 칩을 담을 칸(td/th) 찾기 → relative 로 만들고 absolute 칩을 띄움
      let host: HTMLElement | null = textNode.parentElement;
      while (host && host.tagName !== "TD" && host.tagName !== "TH")
        host = host.parentElement;
      const anchor = host ?? textNode.parentElement;
      if (!anchor) continue;
      anchor.style.position = "relative";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "slot-chip";
      btn.dataset.slot = String(slot);
      anchor.appendChild(btn);
      chipEls.current.set(slot, btn);
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

  // 항상 a{전체셀번호} 키로 저장. 빈칸의 레거시 키는 정리(중복 방지·마이그레이션).
  function assign(slot: number, key: string) {
    const next = { ...mappingRef.current, [`a${slot}`]: key };
    const si = infoOf(slot);
    if (si?.empty && si.emptyIndex !== null) delete next[String(si.emptyIndex)];
    mappingRef.current = next;
    repaint();
    force();
  }
  function clearExplicit(slot: number) {
    const next = { ...mappingRef.current };
    delete next[`a${slot}`];
    const si = infoOf(slot);
    if (si?.empty && si.emptyIndex !== null) delete next[String(si.emptyIndex)];
    mappingRef.current = next;
    repaint();
    force();
  }

  // AI 자동 배치 실행(30~60초) → 제안 계산(아직 미적용). mode:
  //   fill      = 이미 지정된 칸은 그대로 두고 빈칸만 자동 매핑(기존 유지)
  //   overwrite = 기존 매핑 전부 버리고 처음부터 자동 매핑(전체 덮어쓰기)
  const [autoBusy, setAutoBusy] = useState(false);
  function runAutoMap(mode: "fill" | "overwrite") {
    if (autoBusy) return;
    setPendingAuto(null);
    setAutoBusy(true);
    (async () => {
      try {
        const r = await aiMapSlotsAction(formFileId);
        if (!r.ok) {
          toast.error("AI 자동 배치 실패", { description: r.error });
          return;
        }
        const aiMap = r.mapping;
        const proposed: Record<string, string> =
          mode === "overwrite" ? {} : { ...mappingRef.current };
        let n = 0;
        for (const si of slotsRef.current) {
          if (!si.empty) continue; // 앞 라벨이 있는 빈칸만 대상
          if (mode === "fill" && explicitState(si.slot)) continue; // 이미 지정된 칸 유지
          const key = aiMap[String(si.slot)];
          if (!key) continue;
          proposed[`a${si.slot}`] = key;
          if (si.emptyIndex !== null) delete proposed[String(si.emptyIndex)];
          n++;
        }
        if (n === 0) {
          toast.info("AI가 매핑할 수 있는 빈칸을 찾지 못했습니다.");
          return;
        }
        setPendingAuto({ mapping: proposed, count: n, mode });
      } finally {
        setAutoBusy(false);
      }
    })();
  }

  function applyPendingAuto() {
    if (!pendingAuto) return;
    mappingRef.current = pendingAuto.mapping;
    setPendingAuto(null);
    repaint();
    force();
    toast.success(
      `자동 배치 ${pendingAuto.count}칸 적용됨 — [저장]을 눌러야 반영됩니다.`
    );
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
            직접 지정합니다. 편집기 상단의 <strong>[AI 자동 배치]</strong>로 AI가 빈칸을
            읽어 표준데이터에 한 번에 매핑할 수 있습니다(빈칸만 / 전체 덮어쓰기).
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
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => runAutoMap("fill")}
                  disabled={autoBusy}
                  title="AI가 빈칸을 읽어 표준데이터로 매핑. 이미 지정한 칸은 유지."
                >
                  {autoBusy ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="size-3.5" />
                  )}
                  AI 자동 배치 · 빈칸만
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => runAutoMap("overwrite")}
                  disabled={autoBusy}
                  title="기존 매핑을 모두 버리고 AI가 처음부터 매핑"
                >
                  {autoBusy ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="size-3.5" />
                  )}
                  AI 전체 덮어쓰기
                </Button>
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

            {autoBusy ? (
              <div className="flex items-center gap-2 border-b border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-700">
                <Loader2 className="size-4 animate-spin" />
                AI가 양식을 읽어 빈칸을 매핑하는 중… (30~60초)
              </div>
            ) : null}

            {pendingAuto ? (
              <div className="flex flex-wrap items-center gap-2 border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm">
                <Sparkles className="size-4 shrink-0 text-amber-600" />
                <span>
                  {pendingAuto.mode === "overwrite"
                    ? "전체 덮어쓰기"
                    : "빈칸만"}{" "}
                  자동 배치:{" "}
                  <strong>{pendingAuto.count}칸</strong>이 매핑됩니다. 적용할까요?
                  <span className="ml-1 text-xs text-muted-foreground">
                    (적용 후에도 [저장]을 눌러야 실제 반영)
                  </span>
                </span>
                <div className="ml-auto flex gap-2">
                  <Button type="button" size="sm" onClick={applyPendingAuto}>
                    적용
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setPendingAuto(null)}
                  >
                    미적용
                  </Button>
                </div>
              </div>
            ) : null}

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
                  <strong>빈칸(＋)</strong> 또는 내용 있는 칸의{" "}
                  <strong>모서리 점</strong>을 클릭 → 표준데이터·
                  <strong>사진·서명·오늘 날짜</strong> 중 선택. (회색=자동매칭 /
                  파랑=직접지정 · 내용칸은 덮어씀)
                </p>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm">
                    {isEmpty(activeSlot) ? "빈칸" : "칸"}{" "}
                    {hintOf(activeSlot) ? (
                      <span className="ml-0.5 text-muted-foreground">
                        ({isEmpty(activeSlot) ? "앞 라벨" : "내용"}:{" "}
                        {hintOf(activeSlot)})
                      </span>
                    ) : null}
                    {!isEmpty(activeSlot) ? (
                      <span className="ml-1 text-[11px] text-amber-600">· 덮어씀</span>
                    ) : null}
                  </span>
                  <select
                    value={(() => {
                      const ex = explicitState(activeSlot);
                      if (ex) return "skip" in ex ? "" : ex.key;
                      return "__auto__";
                    })()}
                    onChange={(e) => {
                      if (e.target.value === "__auto__") clearExplicit(activeSlot);
                      else assign(activeSlot, e.target.value);
                    }}
                    className="h-8 min-w-[14rem] rounded-md border border-input bg-background px-2 text-sm"
                  >
                    {isEmpty(activeSlot) ? (
                      <option value="__auto__">— 자동(라벨매칭)에 맡김 —</option>
                    ) : (
                      <option value="__auto__">— 지정 안 함 —</option>
                    )}
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
        /* docx-preview 가 표 칸 너비(dxa→px) 합이 모달보다 커 옆으로 퍼지는 것 방지:
           표를 컨테이너 폭(100%)에 묶고 고정 레이아웃 → 칸은 비율대로 축소되어 들어맞음. */
        .docx-edit-host .docx-wrapper table, .docx-preview-host .docx-wrapper table {
          table-layout: fixed !important; width: 100% !important; max-width: 100% !important;
        }
        .docx-edit-host .docx-wrapper td, .docx-edit-host .docx-wrapper th,
        .docx-preview-host .docx-wrapper td, .docx-preview-host .docx-wrapper th {
          overflow: hidden !important; word-break: break-word;
        }
        .docx-edit-host .docx-wrapper, .docx-preview-host .docx-wrapper { overflow-x: hidden; }
        /* 편집기 칩: 칸 위에 absolute 로 띄워 레이아웃에서 제외 → 표가 안 늘어남.
           빈 양식 그대로 렌더되고 칩만 오버레이. */
        .slot-chip {
          position: absolute; left: 1px; top: 1px; z-index: 3;
          max-width: calc(100% - 2px); padding: 0 4px;
          font-size: 11px; line-height: 1.4; border-radius: 4px; cursor: pointer;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          border: 1px dashed #94a3b8; background: #f1f5f9; color: #475569;
        }
        /* 내용 있는 칸: 모서리에 작게(내용 안 가림). 보이게 유지 → hover/지정시 강조 */
        .slot-chip[data-empty="0"] {
          left: auto; right: 1px; top: 1px; max-width: 80%;
          padding: 0 4px; font-size: 10px; opacity: 0.85;
          background: #fef9c3; border-color: #ca8a04; color: #854d0e;
        }
        .slot-chip[data-empty="0"]:hover,
        .slot-chip[data-empty="0"][data-state="set"],
        .slot-chip[data-empty="0"][data-state="skip"] { opacity: 1; }
        .slot-chip[data-empty="0"][data-state="set"] {
          background: #dbeafe; border-color: #2563eb; color: #1d4ed8;
        }
        .slot-chip[data-state="auto"] { border-style: solid; border-color: #cbd5e1; background: #e2e8f0; color: #334155; }
        .slot-chip[data-state="set"]  { border-style: solid; border-color: #2563eb; background: #dbeafe; color: #1d4ed8; font-weight: 600; }
        .slot-chip[data-state="skip"] { border-color: #fca5a5; background: #fef2f2; color: #b91c1c; }
        .slot-chip[data-active="1"] { outline: 2px solid #f59e0b; outline-offset: 1px; }
      `}</style>
    </div>
  );
}
