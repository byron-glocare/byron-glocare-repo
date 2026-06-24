import { PageHeader } from "@/components/page-header";
import { DocxTestClient } from "./docx-test-client";

export const dynamic = "force-dynamic";

export default function DocxTestPage() {
  return (
    <>
      <PageHeader
        title="DOCX 양식 채움 테스트"
        description="docx 양식을 올리면 표 라벨을 자동 감지해 더미값으로 채운 결과를 내려받습니다 (텍스트 v1)"
        breadcrumbs={[{ label: "양식 테스트" }]}
      />
      <div className="space-y-4 p-6">
        <div className="rounded-md border border-info/20 bg-info/5 p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">사용법</p>
          <ol className="mt-1 list-decimal space-y-0.5 pl-5">
            <li>입학원서 등 양식을 <b>.docx</b> 로 준비 (필요하면 cloudconvert 로 변환)</li>
            <li>업로드 → “채움 실행” → 더미 학생값으로 채워진 docx 다운로드</li>
            <li>표 안 “라벨 → 오른쪽 빈칸”을 자동 인식해 채웁니다. (값 칸만 가운데 정렬)</li>
          </ol>
          <p className="mt-2 text-xs">
            ※ 지금은 텍스트 자동채움 테스트입니다. 이미지(사진·서명)·실제 학생값
            연결은 다음 단계예요.
          </p>
        </div>
        <DocxTestClient />
      </div>
    </>
  );
}
