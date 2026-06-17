/**
 * GET /center/students/[id]/final/pdf?form=<formFileId>&app=<applicationId>[&preview=1]
 *   원본 양식 PDF 에 학생 데이터를 좌표 오버레이로 채워 반환.
 *   - 양식이 PDF 이고 field_overlays 가 있을 때만 동작 (없으면 docx 폴백 라우트 사용).
 *   - preview=1 이면 inline (브라우저 미리보기), 아니면 attachment 다운로드.
 */

import { type NextRequest } from "next/server";

import { verifyCenterSession } from "@/lib/center/dal";
import { createCenterClient } from "@/lib/supabase/center";
import { fillPdfOverlay } from "@/lib/admission/fill-pdf-overlay";
import { finalDocFileName } from "@/lib/admission/build-form-sheet";
import { loadKoreanFont } from "@/lib/admission/load-font";
import type { FormFieldOverlay } from "@/types/study";
import type { Json } from "@/types/database";

export const runtime = "nodejs";

function formatValue(v: Json | undefined, inputType: string): string {
  if (v === null || v === undefined || v === "") return "";
  if (inputType === "boolean") return v === true ? "예" : "아니오";
  if (Array.isArray(v)) return v.map(String).join(", ");
  if (inputType === "file" && typeof v === "object" && v !== null) {
    const o = v as { file_name?: string; url?: string };
    return o.file_name ?? o.url ?? "";
  }
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await verifyCenterSession();
  const { id } = await params;
  const formFileId = req.nextUrl.searchParams.get("form") ?? "";
  const appId = req.nextUrl.searchParams.get("app") ?? "";
  const isPreview = req.nextUrl.searchParams.get("preview") === "1";
  const supabase = await createCenterClient();

  const [{ data: student }, { data: form }, { data: app }] = await Promise.all([
    supabase
      .from("study_managed_students")
      .select("id, name")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("study_admission_form_files")
      .select("*")
      .eq("id", formFileId)
      .maybeSingle(),
    appId
      ? supabase
          .from("study_applications")
          .select("id, admission_spec_id, target_department_label")
          .eq("id", appId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (!student || !form) return new Response("Not Found", { status: 404 });

  const overlays = (form.field_overlays ?? []) as FormFieldOverlay[];
  if (overlays.length === 0) {
    return new Response(
      "이 양식은 채움 좌표가 지정되지 않았습니다. (글로케어에서 좌표 지정 필요)",
      { status: 400 }
    );
  }
  const isPdf =
    (form.mime_type ?? "").toLowerCase().includes("pdf") ||
    form.file_name.toLowerCase().endsWith(".pdf") ||
    form.file_url.toLowerCase().includes(".pdf");
  if (!isPdf) {
    return new Response("PDF 양식만 좌표 채움이 가능합니다.", { status: 400 });
  }

  const [{ data: spec }, { data: uni }] = await Promise.all([
    app
      ? supabase
          .from("study_admission_specs")
          .select("id, term")
          .eq("id", app.admission_spec_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("universities")
      .select("id, name_ko")
      .eq("id", form.university_id)
      .maybeSingle(),
  ]);

  // overlay key 분리: 데이터 키 vs essay:N
  const dataKeys = new Set<string>();
  const essayIdx = new Set<number>();
  for (const ov of overlays) {
    if (ov.key.startsWith("essay:")) {
      const n = Number(ov.key.slice("essay:".length));
      if (Number.isFinite(n)) essayIdx.add(n);
    } else {
      dataKeys.add(ov.key);
    }
  }
  const dataKeysArr = Array.from(dataKeys);

  const [{ data: types }, { data: values }, { data: drafts }] =
    await Promise.all([
      dataKeysArr.length > 0
        ? supabase
            .from("study_student_data_types")
            .select("key, input_type")
            .in("key", dataKeysArr)
        : Promise.resolve({
            data: [] as Array<{ key: string; input_type: string }>,
          }),
      dataKeysArr.length > 0
        ? supabase
            .from("study_student_data_values")
            .select("data_type_key, value")
            .eq("student_id", id)
            .in("data_type_key", dataKeysArr)
        : Promise.resolve({
            data: [] as Array<{ data_type_key: string; value: Json }>,
          }),
      essayIdx.size > 0
        ? supabase
            .from("study_student_essay_drafts")
            .select("question_index, generated_text, edited_text")
            .eq("student_id", id)
            .eq("form_file_id", formFileId)
        : Promise.resolve({
            data: [] as Array<{
              question_index: number;
              generated_text: string | null;
              edited_text: string | null;
            }>,
          }),
    ]);

  const inputTypeMap = new Map((types ?? []).map((t) => [t.key, t.input_type]));
  const valueMap = new Map((values ?? []).map((v) => [v.data_type_key, v.value]));
  const draftMap = new Map(
    (drafts ?? []).map((d) => [
      d.question_index,
      d.edited_text ?? d.generated_text ?? "",
    ])
  );

  const valuesForFill = new Map<string, string>();
  for (const ov of overlays) {
    if (valuesForFill.has(ov.key)) continue;
    if (ov.key.startsWith("essay:")) {
      const n = Number(ov.key.slice("essay:".length));
      valuesForFill.set(ov.key, draftMap.get(n) ?? "");
    } else {
      valuesForFill.set(
        ov.key,
        formatValue(valueMap.get(ov.key), inputTypeMap.get(ov.key) ?? "text")
      );
    }
  }

  // 원본 PDF + 폰트 로드
  let pdfBytes: ArrayBuffer;
  try {
    const res = await fetch(form.file_url);
    if (!res.ok) throw new Error(`원본 PDF 다운로드 실패 (${res.status})`);
    pdfBytes = await res.arrayBuffer();
  } catch (e) {
    return new Response(
      `원본 양식 PDF 를 불러오지 못했습니다: ${
        e instanceof Error ? e.message : String(e)
      }`,
      { status: 502 }
    );
  }

  let bytes: Uint8Array;
  try {
    const fontBytes = await loadKoreanFont(req.nextUrl.origin);
    bytes = await fillPdfOverlay({
      pdfBytes,
      fontBytes,
      overlays,
      values: valuesForFill,
    });
  } catch (e) {
    return new Response(
      `PDF 채움 실패: ${e instanceof Error ? e.message : String(e)}`,
      { status: 500 }
    );
  }

  const fileName = finalDocFileName({
    docName: form.name_ko,
    studentName: student.name,
    universityNameKo: uni?.name_ko ?? "",
    departmentName: form.department_name ?? app?.target_department_label ?? null,
    term: spec?.term ?? "",
    ext: "pdf",
  });
  const encoded = encodeURIComponent(fileName);
  const disposition = isPreview ? "inline" : "attachment";

  return new Response(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="document.pdf"; filename*=UTF-8''${encoded}`,
      "Cache-Control": "private, no-store",
    },
  });
}
