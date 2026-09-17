"use client";

/**
 * 작성서류 양식 삭제 버튼 — 요강 학과 카드(편집·상세)와 양식 상세에서 쓴다.
 *   그 학과의 그 종류 양식을 버전까지 통째로 지운다(슬롯 배치·서술형 설정 포함).
 *   같은 파일을 다른 학과 복사본이 쓰고 있으면 스토리지 파일은 남긴다(deleteFormFileAction 이 확인).
 */

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { deleteFormFileAction } from "@/app/(app)/universities/[id]/forms/actions";

export function DeleteFormFileButton({
  formFileId,
  universityId,
  name,
  afterHref,
  label,
}: {
  formFileId: string;
  universityId: number;
  name: string;
  /** 지운 뒤 이동할 곳. 없으면 현재 화면을 새로 고친다. */
  afterHref?: string;
  label?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = () => {
    if (!confirm(`"${name}" 양식을 지울까요?\n이 학과의 이 양식은 이전 버전과 슬롯 배치까지 함께 지워집니다. 되돌릴 수 없습니다.`)) return;
    start(async () => {
      try {
        await deleteFormFileAction(formFileId, universityId);
        toast.success("양식을 지웠습니다.");
        if (afterHref) router.push(afterHref);
        else router.refresh();
      } catch (e) {
        toast.error("삭제 실패", { description: e instanceof Error ? e.message : String(e) });
      }
    });
  };
  return (
    <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={pending} onClick={run} aria-label={`${name} 삭제`}>
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
      {label ?? "삭제"}
    </Button>
  );
}
