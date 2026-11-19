"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { createCaseThumbUploadUrl } from "@/app/(app)/study-cases/actions";

const MAX_MB = 5;

/** 사례 썸네일 올리기 — 미리보기 + 올리기/교체/빼기. 값(이미지 주소)은 폼 저장 때 반영된다. */
export function CaseThumbUpload({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);

  const upload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("이미지 파일만 올릴 수 있습니다");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`이미지가 너무 큽니다 (최대 ${MAX_MB}MB)`);
      return;
    }
    setPending(true);
    try {
      const signed = await createCaseThumbUploadUrl(file.name);
      if (!signed.ok) throw new Error(signed.error);
      const { error } = await createClient()
        .storage.from("admission-form-files")
        .uploadToSignedUrl(signed.data.path, signed.data.token, file, { contentType: file.type, upsert: false });
      if (error) throw new Error(error.message);
      onChange(signed.data.publicUrl);
      toast.success("이미지를 올렸습니다. 저장을 눌러야 홈페이지에 반영됩니다.");
    } catch (e) {
      toast.error("이미지를 올리지 못했습니다", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex items-end gap-3">
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="썸네일 미리보기" className="h-32 w-24 rounded-md border border-border object-cover" />
      ) : (
        <div className="flex h-32 w-24 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
          없음
        </div>
      )}
      <div className="flex flex-col gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void upload(file);
          }}
        />
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => inputRef.current?.click()}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
          {value ? "이미지 교체" : "이미지 올리기"}
        </Button>
        {value ? (
          <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => onChange("")}>
            <X className="size-4" />
            빼기
          </Button>
        ) : null}
        <span className="text-xs text-muted-foreground">세로 9:16 캡처 권장 · 최대 {MAX_MB}MB</span>
      </div>
    </div>
  );
}
