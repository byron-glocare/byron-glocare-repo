"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { tr, type Locale } from "@/lib/i18n";

import {
  rereadAllDocsAction,
  syncDocExtractionsAction,
  type FilledField,
} from "./doc-extraction-actions";

type Phase =
  | { kind: "idle" }
  /** remaining=null → 아직 개수를 모름(다시 읽기 직후) */
  | { kind: "reading"; remaining: number | null };

/**
 * 정보 입력(유학센터) 화면을 열면 아직 안 읽은 업로드 서류를 자동으로 읽는다.
 *   syncDocExtractionsAction 을 remaining > 0 인 동안 순차 호출 → 채운 항목 토스트 →
 *   바뀐 게 있으면 마지막에 router.refresh() 한 번.
 */
export function useDocSync({
  locale,
  studentId,
  initialUnread,
  enabled,
  onFilled,
}: {
  locale: Locale;
  studentId: string;
  /** 서버가 계산한 "아직 안 읽은 서류 수" — 0 이면 열 때 호출하지 않는다 */
  initialUnread: number;
  enabled: boolean;
  /** 자동으로 채운 값을 에디터 로컬 상태에 반영 */
  onFilled: (fields: FilledField[]) => void;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>(
    enabled && initialUnread > 0
      ? { kind: "reading", remaining: initialUnread }
      : { kind: "idle" }
  );
  const [error, setError] = useState<string | null>(null);
  const runningRef = useRef(false);
  const startedRef = useRef(false);
  const onFilledRef = useRef(onFilled);
  useEffect(() => {
    onFilledRef.current = onFilled;
  });

  /** 반복 호출 루프 — 상태 변경은 모두 await 이후에만 한다. */
  const runLoop = async (): Promise<void> => {
    if (runningRef.current) return;
    runningRef.current = true;
    const filledAll: FilledField[] = [];
    let changed = false;
    try {
      for (let guard = 0; guard < 200; guard++) {
        const res = await syncDocExtractionsAction(studentId);
        if (!res.ok) {
          setError(res.error);
          break;
        }
        if (res.processed > 0) changed = true;
        if (res.filled.length > 0) {
          filledAll.push(...res.filled);
          onFilledRef.current(res.filled);
        }
        if (res.remaining <= 0 || res.processed === 0) break;
        setPhase({ kind: "reading", remaining: res.remaining });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      runningRef.current = false;
      setPhase({ kind: "idle" });
    }

    if (filledAll.length > 0) {
      toast.success(
        tr(
          locale,
          `서류에서 ${filledAll.length}개 항목을 채웠습니다`,
          `Đã điền ${filledAll.length} mục từ giấy tờ`
        ),
        {
          description: filledAll
            .map((f) => (locale === "ko" ? f.label_ko : f.label_vi))
            .join(", "),
        }
      );
    }
    if (changed) router.refresh();
  };

  // 화면을 열 때 한 번 (StrictMode 이중 실행 방지)
  useEffect(() => {
    if (!enabled || initialUnread <= 0 || startedRef.current) return;
    startedRef.current = true;
    void runLoop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** "서류 전부 다시 읽기" */
  const rereadAll = async (): Promise<void> => {
    if (runningRef.current) return;
    setError(null);
    setPhase({ kind: "reading", remaining: null });
    const res = await rereadAllDocsAction(studentId);
    if (!res.ok) {
      setError(res.error);
      setPhase({ kind: "idle" });
      return;
    }
    await runLoop();
  };

  return { phase, error, rereadAll, busy: phase.kind === "reading" };
}

/** 상태 한 줄 ("업로드한 서류를 읽는 중… (n개 남음)") */
export function DocSyncStatus({
  locale,
  phase,
  error,
}: {
  locale: Locale;
  phase: Phase;
  error: string | null;
}) {
  if (phase.kind === "reading") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm text-violet-800">
        <Loader2 className="size-4 animate-spin" />
        {phase.remaining === null
          ? tr(locale, "업로드한 서류를 읽는 중…", "Đang đọc giấy tờ đã tải…")
          : tr(
              locale,
              `업로드한 서류를 읽는 중… (${phase.remaining}개 남음)`,
              `Đang đọc giấy tờ đã tải… (còn ${phase.remaining})`
            )}
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
        {tr(locale, "서류 자동 읽기 실패", "Không tự đọc được giấy tờ")}: {error}
      </div>
    );
  }
  return null;
}
