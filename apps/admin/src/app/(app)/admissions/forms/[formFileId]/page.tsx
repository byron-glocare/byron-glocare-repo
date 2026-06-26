/**
 * /admissions/forms/[formFileId] — [작성서류] 상세.
 *   제목=서류명, 부제목=대학교명.
 *   기본정보(서류명·대학·적용학과·적용학기·업로드일·다운로드) + 상세정보(양식종류·필요데이터)
 *   + 미리보기 + 다운로드(원본 / AI 빈양식).
 *
 *   위치는 입학서류 메뉴지만 대학교 상세에서도 링크로 접근.
 *   (빈상태 업로드·파일교체 3버튼·AI 원본모사 빈양식은 후속 증분.)
 */

import { notFound, redirect } from "next/navigation";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { FormDocDetail } from "./form-doc-detail";
import {
  OverlayPicker,
  type RawOverlay,
  type FieldChoice,
} from "./overlay-picker";
import { DocxMapper } from "./docx-mapper";
import { DocxPlacement } from "./docx-placement";
import { detectDocxFields, type DocxFieldCandidate } from "@/lib/docx/fill";

export const dynamic = "force-dynamic";

export default async function FormDocDetailPage({
  params,
}: {
  params: Promise<{ formFileId: string }>;
}) {
  const { formFileId } = await params;

  const supabaseUser = await createClient();
  const {
    data: { user },
  } = await supabaseUser.auth.getUser();
  if (!user) redirect(`/login?redirect=/admissions/forms/${formFileId}`);

  const supabase = createAdminClient();

  const { data: form } = await supabase
    .from("study_admission_form_files")
    .select(
      "id, university_id, key, name_ko, file_url, file_name, mime_type, notes, uploaded_at, is_current, department_name, required_data_type_keys, applies_to_terms, applies_to_department_ids, essay_questions, field_overlays, label_mapping, slot_mapping"
    )
    .eq("id", formFileId)
    .maybeSingle();
  if (!form) notFound();

  const [{ data: uni }, { data: depts }, { data: specs }, { data: catalogRows }] =
    await Promise.all([
      supabase
        .from("universities")
        .select("id, name_ko")
        .eq("id", form.university_id)
        .maybeSingle(),
      supabase
        .from("departments")
        .select("id, name_ko, active")
        .eq("university_id", form.university_id)
        .order("sort_order"),
      supabase
        .from("study_admission_specs")
        .select("required_documents, status, updated_at")
        .eq("university_id", form.university_id)
        .order("updated_at", { ascending: false }),
      supabase
        .from("study_student_data_types")
        .select("key, label_ko, category, aliases")
        .eq("is_active", true)
        .order("category")
        .order("sort_order"),
    ]);

  // 서류명 후보 = 최신 모집요강(승인 우선)의 required_documents 이름들
  const repSpec =
    (specs ?? []).find((s) => s.status === "approved") ?? (specs ?? [])[0];
  const docNameOptions = (() => {
    const out = new Set<string>();
    const reqs = Array.isArray(repSpec?.required_documents)
      ? (repSpec!.required_documents as Array<{ name_ko?: string }>)
      : [];
    for (const r of reqs) if (r?.name_ko) out.add(r.name_ko);
    return Array.from(out);
  })();

  // 좌표 지정기용 — PDF 일 때만. 항목 = 필요 표준데이터(저장본) + 서술형 질문.
  const ext = (form.file_name.split(".").pop() ?? "").toLowerCase();
  const isPdf =
    ext === "pdf" ||
    (form.mime_type ?? "").toLowerCase().includes("pdf") ||
    form.file_url.toLowerCase().includes(".pdf");
  const isDocx =
    ext === "docx" ||
    (form.mime_type ?? "").toLowerCase().includes("word") ||
    form.file_url.toLowerCase().includes(".docx");

  // docx 양식이면 채움 가능한 칸(라벨) 감지
  let docxFields: DocxFieldCandidate[] = [];
  if (isDocx) {
    try {
      const r = await fetch(form.file_url);
      if (r.ok) docxFields = detectDocxFields(Buffer.from(await r.arrayBuffer()));
    } catch {
      docxFields = [];
    }
  }
  const savedMapping =
    form.label_mapping && typeof form.label_mapping === "object"
      ? (form.label_mapping as Record<string, string>)
      : {};
  const savedSlots =
    form.slot_mapping && typeof form.slot_mapping === "object"
      ? (form.slot_mapping as Record<string, string>)
      : {};
  const essayQs = Array.isArray(form.essay_questions)
    ? (form.essay_questions as Array<{ question_ko?: string }>)
    : [];
  // 연결 후보 = 전체 활성 표준데이터(카탈로그) + 양식의 서술형 질문.
  //   (필요 표준데이터를 미리 체크할 필요 없이, 박스를 어디든 연결 가능)
  const overlayChoices: FieldChoice[] = [
    ...(catalogRows ?? []).map((c) => ({
      key: c.key,
      label: c.label_ko,
      aliases: [c.label_ko, ...((c.aliases as string[] | null) ?? [])],
    })),
    ...essayQs.map((q, i) => ({
      key: `essay:${i}`,
      label: `[서술형] ${q.question_ko ?? `질문 ${i + 1}`}`,
      aliases: q.question_ko ? [q.question_ko] : [],
    })),
  ];
  const initialOverlays: RawOverlay[] = Array.isArray(form.field_overlays)
    ? (form.field_overlays as RawOverlay[])
    : [];

  return (
    <>
      <PageHeader
        title={form.name_ko || "작성서류"}
        description={uni?.name_ko ?? `대학 #${form.university_id}`}
        breadcrumbs={[
          { href: "/admissions", label: "입학서류" },
          { label: form.name_ko || "작성서류" },
        ]}
      />
      <div className="p-6">
        <FormDocDetail
          form={{
            id: form.id,
            university_id: form.university_id,
            university_name: uni?.name_ko ?? `대학 #${form.university_id}`,
            key: form.key,
            name_ko: form.name_ko,
            file_url: form.file_url,
            file_name: form.file_name,
            department_name: form.department_name,
            notes: form.notes,
            uploaded_at: form.uploaded_at,
            required_data_type_keys: form.required_data_type_keys ?? [],
            applies_to_terms: form.applies_to_terms ?? [],
            applies_to_department_ids: form.applies_to_department_ids ?? [],
          }}
          departments={(depts ?? []).map((d) => ({
            id: d.id,
            name_ko: d.name_ko,
            active: d.active,
          }))}
          docNameOptions={docNameOptions}
        />

        {isDocx ? (
          <>
            <Card className="mt-6 p-6">
              <DocxPlacement
                formFileId={form.id}
                choices={overlayChoices}
                savedSlots={savedSlots}
              />
            </Card>
            <Card className="mt-6 p-6">
              <DocxMapper
                formFileId={form.id}
                fields={docxFields}
                choices={overlayChoices}
                saved={savedMapping}
              />
            </Card>
          </>
        ) : isPdf ? (
          <Card className="mt-6 p-6">
            <OverlayPicker
              formFileId={form.id}
              fileUrl={form.file_url}
              choices={overlayChoices}
              initialOverlays={initialOverlays}
            />
          </Card>
        ) : (
          <Card className="mt-6 p-6">
            <h2 className="text-base font-semibold">채움 설정</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              자동 채움은 <strong>DOCX</strong>(권장) 또는 <strong>PDF</strong> 양식만
              지원합니다. 위 “파일 교체”에서 .docx 로 올리면 이 영역에서 라벨↔표준데이터
              매핑을 지정할 수 있습니다.
            </p>
          </Card>
        )}
      </div>
    </>
  );
}
