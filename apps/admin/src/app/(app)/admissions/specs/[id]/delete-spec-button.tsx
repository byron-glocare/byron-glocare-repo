"use client";

import { useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { deleteSpecAction } from "./delete-action";

export function DeleteSpecButton({
  specId,
  universityId,
}: {
  specId: string;
  universityId: number;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      className="text-destructive hover:bg-destructive/10"
      onClick={() => {
        if (
          !confirm(
            "이 모집요강을 삭제하시겠습니까?\n(연결된 학생 지원이 있으면 완전 삭제 대신 보관 처리됩니다)"
          )
        ) {
          return;
        }
        startTransition(() => deleteSpecAction(specId, universityId));
      }}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Trash2 className="size-4" />
      )}
      삭제
    </Button>
  );
}
