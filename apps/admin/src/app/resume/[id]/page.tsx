import { redirect } from "next/navigation";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isGlocareAdmin } from "@/lib/admin-guard";
import {
  resumeDraftDataSchema,
  resumeContentSchema,
  type ResumeContent,
} from "@/lib/validators";
import { rawToContent } from "@/lib/resume/organize";
import { ResumeEditor } from "@/components/resume/resume-editor";

export const dynamic = "force-dynamic";

/**
 * 이력서 HTML 편집기 (관리자 전용, 전체 화면 — 인쇄/PDF 깔끔하게 (app) 밖).
 *   [id] = customer id. 가장 최근 제출된 resume draft 를 편집한다.
 */
export default async function ResumePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: customerId } = await params;

  // 인증 + 어드민 권한
  const sessionClient = await createClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();
  if (!user) redirect(`/login?redirect=/resume/${customerId}`);
  if (!isGlocareAdmin(user)) redirect("/forbidden");

  const supabase = createAdminClient();

  const { data: draft } = await supabase
    .from("resume_drafts")
    .select("id, data, resume_content, photo_path")
    .eq("customer_id", customerId)
    .not("submitted_at", "is", null)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!draft) {
    return (
      <div className="mx-auto max-w-md p-10 text-center text-sm text-muted-foreground">
        제출된 이력서가 없습니다. 학생이 작성 링크로 제출하면 여기서 이력서를
        생성·편집할 수 있습니다.
      </div>
    );
  }

  // 사진 → data URI (private bucket, service_role 로 download)
  let photoDataUri = "";
  if (draft.photo_path) {
    const { data: blob } = await supabase.storage
      .from("resume-photos")
      .download(draft.photo_path);
    if (blob) {
      const buf = Buffer.from(await blob.arrayBuffer());
      const mime = blob.type || "image/jpeg";
      photoDataUri = `data:${mime};base64,${buf.toString("base64")}`;
    }
  }

  // 내용: resume_content 있으면 그것, 없으면 원본을 최소 매핑(미생성 상태)
  let content: ResumeContent | null = null;
  const generated = draft.resume_content != null;
  if (generated) {
    const parsed = resumeContentSchema.safeParse(draft.resume_content);
    if (parsed.success) content = parsed.data;
  }
  if (!content) {
    const rawParsed = resumeDraftDataSchema.safeParse(draft.data);
    content = rawParsed.success
      ? rawToContent(rawParsed.data)
      : resumeContentSchema.parse({});
  }

  return (
    <ResumeEditor
      customerId={customerId}
      draftId={draft.id}
      initialContent={content}
      photoDataUri={photoDataUri}
      generated={generated}
    />
  );
}
