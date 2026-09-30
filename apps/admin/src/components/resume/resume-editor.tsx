"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Printer, Save, Sparkles } from "lucide-react";

import {
  generateResumeContent,
  saveResumeContent,
} from "@/app/(app)/customers/resume-actions";
import { RESUME_CSS, buildResumeInnerHtml } from "@/lib/resume/resume-html";
import type { ResumeContent } from "@/lib/validators";

const txt = (el: Element | null) =>
  (el?.textContent ?? "").replace(/ /g, " ").trim();

/** 완성본/인쇄 전 — 정보 없는 칸·항목·섹션에 .empty 표시(CSS가 숨김). */
function markEmpty(root: HTMLElement) {
  root
    .querySelectorAll<HTMLElement>("[contenteditable][data-single]")
    .forEach((c) => {
      if (!txt(c)) c.innerHTML = "";
    });
  root.querySelectorAll(".duties li, .intro p").forEach((n) => {
    if (!txt(n)) n.remove();
  });
  root.querySelectorAll<HTMLElement>(".duties").forEach((u) => {
    if (!u.children.length) u.innerHTML = "";
  });
  root.querySelectorAll<HTMLElement>(".intro").forEach((u) => {
    if (!txt(u)) u.innerHTML = "";
  });
  root.querySelectorAll(".item").forEach((it) => {
    let empty: boolean;
    if (it.classList.contains("kv")) {
      empty = it.closest('[data-list="skills"]')
        ? !txt(it.querySelector(".k"))
        : !txt(it.querySelector(".v"));
    } else {
      empty = Array.from(it.querySelectorAll("[contenteditable]")).every(
        (c) => !txt(c)
      );
    }
    it.classList.toggle("empty", empty);
  });
  root.querySelectorAll(".sec[data-list], .side-block").forEach((s) =>
    s.classList.toggle(
      "empty",
      s.querySelectorAll(".item:not(.empty)").length === 0
    )
  );
  root.querySelector(".hl")?.classList.toggle("empty", !txt(root.querySelector(".hl-text")));
  root
    .querySelector(".intro-sec")
    ?.classList.toggle("empty", !txt(root.querySelector(".intro")));
}

/** 편집 모드 복귀 — 빈 duties 에 편집용 빈 li 하나 복원. */
function unmarkForEdit(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>(".duties").forEach((u) => {
    if (!u.children.length) u.innerHTML = "<li></li>";
  });
}

/** 편집된 DOM(.resume-root) 에서 ResumeContent 를 다시 읽어낸다. */
function serialize(root: HTMLElement): ResumeContent {
  const list = (sel: string) =>
    Array.from(root.querySelectorAll(`[data-list="${sel}"] .list > .item`));
  const tl = (items: Element[]) =>
    items.map((it) => ({
      period: txt(it.querySelector(".period")),
      status: txt(it.querySelector(".status")),
      title: txt(it.querySelector(".title")),
      sub: txt(it.querySelector(".sub")),
      duties: Array.from(it.querySelectorAll(".duties li"))
        .map((li) => txt(li))
        .filter(Boolean),
    }));
  return {
    name_en: txt(root.querySelector(".name-en")),
    name_ko: txt(root.querySelector(".name-ko")),
    headline: txt(root.querySelector(".hl-text")),
    info: list("info").map((it) => ({
      k: txt(it.querySelector(".k")),
      v: txt(it.querySelector(".v")),
    })),
    skills: list("skills").map((it) => ({
      name: txt(it.querySelector(".k")),
      level: txt(it.querySelector(".v")),
    })),
    educations: tl(list("edu")),
    careers: tl(list("career")),
    certifications: list("certs").map((it) => ({
      title: txt(it.querySelector(".title")),
      sub: txt(it.querySelector(".sub")),
      date: txt(it.querySelector(".date")),
    })),
    activities: tl(list("acts")),
    intro: Array.from(root.querySelectorAll(".intro p"))
      .map((p) => txt(p))
      .filter(Boolean),
  };
}

export function ResumeEditor({
  customerId,
  draftId,
  initialContent,
  photoDataUri,
  generated,
}: {
  customerId: string;
  draftId: string;
  initialContent: ResumeContent;
  photoDataUri: string;
  generated: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [content, setContent] = useState<ResumeContent>(initialContent);
  const [renderKey, setRenderKey] = useState(0);
  const [view, setView] = useState(false);
  const [pending, startTransition] = useTransition();

  const innerHtml = buildResumeInnerHtml(content, photoDataUri);

  // DOM 편집 동작 (추가/삭제/사진/붙여넣기/Enter 제한) — 렌더될 때마다 재부착
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const onClick = (ev: MouseEvent) => {
      const t = ev.target as HTMLElement;
      const del = t.closest(".del");
      if (del) {
        del.closest(".item")?.remove();
        return;
      }
      const add = t.closest("[data-add]") as HTMLElement | null;
      if (add) {
        const key = add.dataset.add!;
        const block = add.closest("[data-list]")!;
        const listEl = block.querySelector(".list")!;
        const tpl = block.querySelector<HTMLTemplateElement>(`#tpl-${key}`);
        if (tpl) {
          listEl.insertAdjacentHTML("beforeend", tpl.innerHTML);
          listEl
            .lastElementChild?.querySelector<HTMLElement>("[contenteditable]")
            ?.focus();
        }
      }
    };
    const onPaste = (ev: ClipboardEvent) => {
      const t = ev.target as HTMLElement;
      if (!t.closest("[contenteditable]")) return;
      ev.preventDefault();
      const text = ev.clipboardData?.getData("text/plain") ?? "";
      const single = t.closest("[data-single]");
      document.execCommand(
        "insertText",
        false,
        single ? text.replace(/\s*\n\s*/g, " ") : text
      );
    };
    const onKeydown = (ev: KeyboardEvent) => {
      const t = ev.target as HTMLElement;
      if (ev.key === "Enter" && t.closest("[data-single]")) ev.preventDefault();
    };
    const photoInput = root.querySelector<HTMLInputElement>(
      "#resume-photo-input"
    );
    const photoImg = root.querySelector<HTMLImageElement>("#resume-photo");
    const onPhoto = () => {
      const f = photoInput?.files?.[0];
      if (!f || !photoImg) return;
      const r = new FileReader();
      r.onload = () => {
        photoImg.src = String(r.result);
      };
      r.readAsDataURL(f);
    };

    const onBeforePrint = () => markEmpty(root);

    root.addEventListener("click", onClick);
    root.addEventListener("paste", onPaste);
    root.addEventListener("keydown", onKeydown);
    photoInput?.addEventListener("change", onPhoto);
    window.addEventListener("beforeprint", onBeforePrint);
    return () => {
      root.removeEventListener("click", onClick);
      root.removeEventListener("paste", onPaste);
      root.removeEventListener("keydown", onKeydown);
      photoInput?.removeEventListener("change", onPhoto);
      window.removeEventListener("beforeprint", onBeforePrint);
    };
  }, [renderKey]);

  // 완성본 미리보기 ↔ 편집 전환 시 빈 항목 표시/복원
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (view) markEmpty(root);
    else unmarkForEdit(root);
  }, [view, renderKey]);

  function onGenerate() {
    const msg = generated
      ? "AI로 이력서를 다시 정리할까요? 편집 중인 내용은 새 결과로 대체됩니다."
      : "학생이 제출한 내용을 AI가 이력서 형식으로 정리합니다. 진행할까요?";
    if (!confirm(msg)) return;
    startTransition(async () => {
      const r = await generateResumeContent(customerId, draftId);
      if (r.ok) {
        setContent(r.data.content);
        setRenderKey((k) => k + 1);
        setView(false);
        toast.success("AI 정리 완료. 검토 후 저장하세요.");
      } else {
        toast.error("생성 실패", { description: r.error });
      }
    });
  }

  function onSave() {
    const root = rootRef.current;
    if (!root) return;
    const current = serialize(root);
    startTransition(async () => {
      const r = await saveResumeContent(customerId, draftId, current);
      if (r.ok) {
        setContent(current);
        toast.success("저장되었습니다.");
      } else {
        toast.error("저장 실패", { description: r.error });
      }
    });
  }

  return (
    <div>
      <style>{RESUME_CSS}</style>
      <div className="no-print sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-2.5">
        <span className="mr-auto text-sm text-muted-foreground">
          {view
            ? "완성본 미리보기 — 빈 칸은 자동 생략"
            : "편집 모드 — 글자·사진을 눌러 수정, 빈 칸은 인쇄 때 생략"}
        </span>
        <button
          type="button"
          onClick={onGenerate}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted/40 disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          {generated ? "AI 재생성" : "AI로 생성"}
        </button>
        <button
          type="button"
          onClick={() => setView((v) => !v)}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted/40"
        >
          {view ? "✎ 편집" : "✓ 완성본"}
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted/40 disabled:opacity-60"
        >
          <Save className="size-4" />
          저장
        </button>
        <button
          type="button"
          onClick={() => {
            if (rootRef.current) markEmpty(rootRef.current);
            window.print();
          }}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground"
        >
          <Printer className="size-4" />
          PDF / 인쇄
        </button>
      </div>

      <div
        key={renderKey}
        ref={rootRef}
        className={`resume-root${view ? " view" : ""}`}
        style={{ background: "#E9E6E5", paddingTop: 1, paddingBottom: 1 }}
        dangerouslySetInnerHTML={{ __html: innerHtml }}
      />
    </div>
  );
}
