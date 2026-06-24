import { notFound } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/server";
import { ResumeForm } from "./resume-form";
import type { ResumeDraftDataInput } from "@/lib/validators";

export const dynamic = "force-dynamic";

export default async function PublicResumePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createAdminClient();

  const { data: draft } = await supabase
    .from("resume_drafts")
    .select("id, token, expires_at, submitted_at, data, photo_path")
    .eq("token", token)
    .maybeSingle();

  if (!draft) notFound();

  const expired = new Date(draft.expires_at).getTime() < Date.now();
  const alreadySubmitted = !!draft.submitted_at;

  // 만료된 링크만 차단. 제출된 상태에서도 7일 안엔 수정 가능.
  if (expired) {
    return (
      <Wrapper>
        <Notice
          title="링크가 만료됐어요"
          titleVi="Đường link đã hết hạn"
          body="이 링크의 유효기간이 지났습니다. 담당자에게 새 링크를 요청해주세요."
          bodyVi="Link này đã hết hạn. Vui lòng yêu cầu link mới từ người phụ trách."
        />
      </Wrapper>
    );
  }

  const initialData = (draft.data ?? {}) as ResumeDraftDataInput;
  const expiresAtLabel = new Date(draft.expires_at).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Wrapper>
      <header className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold">요양보호사 이력서 작성</h1>
        <p className="text-sm text-muted-foreground">Đơn xin việc Điều dưỡng viên</p>
        <p className="text-xs text-muted-foreground">
          링크 만료 / Hạn dùng: {expiresAtLabel}
        </p>
      </header>
      <ResumeForm
        token={token}
        initial={initialData}
        hasPhoto={!!draft.photo_path}
        alreadySubmitted={alreadySubmitted}
      />
    </Wrapper>
  );
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/30">
      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">{children}</div>
    </div>
  );
}

function Notice({
  title,
  titleVi,
  body,
  bodyVi,
}: {
  title: string;
  titleVi: string;
  body: string;
  bodyVi: string;
}) {
  return (
    <div className="bg-card rounded-lg border border-border p-8 text-center space-y-3 mt-20">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground">{titleVi}</p>
      <p className="text-sm">{body}</p>
      <p className="text-sm text-muted-foreground">{bodyVi}</p>
    </div>
  );
}
