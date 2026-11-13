"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { DIRECT_UPLOAD_MAX_MB } from "@/lib/upload-limits";
import { createAdmissionSourceUploadUrl } from "../../new/approve-action";
import { setSpecSourceFileAction } from "./source-file-action";

/** 모집요강 원본 올리기/교체 — 파일만 보관한다(AI 추출 없음, 입력된 정보 그대로) */
export function SourceFileButton({ specId, hasFile }: { specId: string; hasFile: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);

  const upload = async (file: File) => {
    if (file.size > DIRECT_UPLOAD_MAX_MB * 1024 * 1024) {
      toast.error(`파일이 너무 큽니다 (최대 ${DIRECT_UPLOAD_MAX_MB}MB)`);
      return;
    }
    if (hasFile && !window.confirm("원본 파일을 이 파일로 바꿀까요?\n입력된 모집요강 정보는 바뀌지 않습니다.")) return;
    setPending(true);
    try {
      const signed = await createAdmissionSourceUploadUrl(file.name);
      if (!signed.ok) throw new Error(signed.error);
      const { error: upErr } = await createClient()
        .storage.from("admission-form-files")
        .uploadToSignedUrl(signed.path, signed.token, file, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });
      if (upErr) throw new Error(upErr.message);
      const res = await setSpecSourceFileAction(specId, signed.publicUrl);
      if (!res.ok) throw new Error(res.error);
      toast.success(hasFile ? "원본 파일을 바꿨습니다." : "원본 파일을 올렸습니다.");
      router.refresh();
    } catch (e) {
      toast.error("원본 파일을 올리지 못했습니다", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".pdf,.hwp,.hwpx,application/pdf,application/x-hwp,application/vnd.hancom.hwpx"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void upload(file);
        }}
      />
      <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => inputRef.current?.click()}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        {hasFile ? "원본 교체" : "원본 올리기"}
      </Button>
    </>
  );
}
