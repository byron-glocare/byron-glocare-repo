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
import { loadFillFonts } from "@/lib/admission/load-font";
import {
  createServiceClient,
  STUDENT_FILES_BUCKET,
} from "@/lib/supabase/service";
import type { FormFieldOverlay } from "@/types/study";
import type { Json } from "@/types/database";

export const runtime = "nodejs";

function formatValue(v: Json | undefined, inputType: string): string {
  if (v === null || v === undefined || v === "") return "";
  if (inputType === "boolean") return v === true ? "예" : "아니오";
  if (Array.isArray(v)) return v.map(String).join(", ");
  // 파일/서명/이미지 등 객체 값은 텍스트로 그리지 않는다 (JSON 덤프 방지)
  if (typeof v === "object") return "";
  return String(v);
}

/** 파일류 input_type — 이미지로 렌더. */
const FILE_TYPES = new Set(["signature", "file", "image", "photo"]);

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

  // 박스 종류별 바인딩 키 수집. bindKey = dataKey(있으면) | key(레거시).
  const bindKey = (ov: FormFieldOverlay) => ov.dataKey ?? ov.key;
  const dataKeys = new Set<string>();
  const essayIdx = new Set<number>();
  for (const ov of overlays) {
    const kind = ov.kind ?? "text";
    if (kind === "text" && ov.source === "input") continue; // 생성 시 입력 — DB 조회 불필요
    const bk = bindKey(ov);
    if (bk.startsWith("essay:")) {
      const n = Number(bk.slice("essay:".length));
      if (Number.isFinite(n)) essayIdx.add(n);
    } else {
      dataKeys.add(bk);
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

  // 생성 시 입력값 (쿼리 inputs=JSON, overlay.key 로 키잉) + 날짜 기본 오늘
  let inputVals: Record<string, string> = {};
  try {
    const raw = req.nextUrl.searchParams.get("inputs");
    if (raw) inputVals = JSON.parse(raw) as Record<string, string>;
  } catch {
    inputVals = {};
  }
  const today = new Date().toISOString().slice(0, 10);

  const resolveStudentText = (bk: string): string => {
    if (bk.startsWith("essay:")) {
      const n = Number(bk.slice("essay:".length));
      return draftMap.get(n) ?? "";
    }
    return formatValue(valueMap.get(bk), inputTypeMap.get(bk) ?? "text");
  };

  const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();
  const isChecked = (v: Json | undefined, match?: string): boolean => {
    if (match && match.trim()) {
      const m = norm(match);
      if (Array.isArray(v)) return v.some((x) => norm(x) === m);
      return norm(v) === m;
    }
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === "string") return v.trim() !== "";
    if (typeof v === "boolean") return v;
    return v != null;
  };

  async function fetchImage(
    url: string
  ): Promise<{ bytes: Uint8Array; type: "png" | "jpg" } | null> {
    try {
      const r = await fetch(url);
      if (!r.ok) return null;
      const buf = new Uint8Array(await r.arrayBuffer());
      const ct = (r.headers.get("content-type") ?? "").toLowerCase();
      let type: "png" | "jpg" | null = null;
      if (ct.includes("png") || /\.png($|\?)/i.test(url)) type = "png";
      else if (ct.includes("jpeg") || ct.includes("jpg") || /\.jpe?g($|\?)/i.test(url))
        type = "jpg";
      else if (buf[0] === 0x89 && buf[1] === 0x50) type = "png";
      else if (buf[0] === 0xff && buf[1] === 0xd8) type = "jpg";
      if (!type) return null;
      return { bytes: buf, type };
    } catch {
      return null;
    }
  }

  const typeOf = (cp: "png" | null, path: string, buf: Uint8Array) => {
    if (/\.png($|\?)/i.test(path)) return "png" as const;
    if (/\.jpe?g($|\?)/i.test(path)) return "jpg" as const;
    if (buf[0] === 0x89 && buf[1] === 0x50) return "png" as const;
    if (buf[0] === 0xff && buf[1] === 0xd8) return "jpg" as const;
    return cp;
  };

  // 파일/서명/사진 값({url} 또는 {path}) → 이미지 바이트. path 는 비공개 버킷에서 다운로드.
  async function imageFromValue(
    v: Json | undefined
  ): Promise<{ bytes: Uint8Array; type: "png" | "jpg" } | null> {
    if (typeof v === "string" && /^https?:\/\//.test(v)) return fetchImage(v);
    if (!v || typeof v !== "object" || Array.isArray(v)) return null;
    const o = v as { url?: string; path?: string };
    if (o.url) return fetchImage(o.url);
    if (o.path) {
      try {
        const svc = createServiceClient();
        const { data, error } = await svc.storage
          .from(STUDENT_FILES_BUCKET)
          .download(o.path);
        if (error || !data) return null;
        const buf = new Uint8Array(await data.arrayBuffer());
        const type = typeOf(null, o.path, buf);
        return type ? { bytes: buf, type } : null;
      } catch {
        return null;
      }
    }
    return null;
  }

  const valuesForFill = new Map<string, string>();
  const checks = new Map<string, boolean>();
  const imageJobs: Array<Promise<void>> = [];
  const images = new Map<string, { bytes: Uint8Array; type: "png" | "jpg" }>();

  for (const ov of overlays) {
    const kind = ov.kind ?? "text";
    const bk = bindKey(ov);
    const it = inputTypeMap.get(bk) ?? "text";
    // 종류가 이미지/사인 이거나, 연결된 데이터가 파일류면 이미지로 렌더
    const asImage =
      kind === "image" || kind === "signature" || FILE_TYPES.has(it);
    if (kind === "check") {
      checks.set(ov.key, isChecked(valueMap.get(bk), ov.matchValue));
    } else if (asImage) {
      const val = valueMap.get(bk);
      imageJobs.push(
        imageFromValue(val).then((img) => {
          if (img) images.set(ov.key, img);
        })
      );
    } else if (ov.source === "static") {
      // 관리자가 미리 적어둔 고정 텍스트
      valuesForFill.set(ov.key, ov.staticText ?? "");
    } else if (ov.source === "input") {
      // 날짜 부분(년/월/일) 박스는 inputLabel 로 한 값을 공유
      const fieldKey = ov.datePart
        ? `datelabel:${ov.inputLabel || "작성일"}`
        : ov.key;
      let v = inputVals[fieldKey] ?? "";
      if (!v && (ov.inputType === "date" || ov.datePart)) v = today;
      if (ov.datePart && /^\d{4}-\d{2}-\d{2}/.test(v)) {
        v =
          ov.datePart === "year"
            ? v.slice(0, 4)
            : ov.datePart === "month"
              ? v.slice(5, 7)
              : v.slice(8, 10);
      }
      valuesForFill.set(ov.key, v);
    } else {
      valuesForFill.set(ov.key, resolveStudentText(bk));
    }
  }
  await Promise.all(imageJobs);

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
    const fonts = await loadFillFonts(req.nextUrl.origin);
    bytes = await fillPdfOverlay({
      pdfBytes,
      koFontBytes: fonts.ko,
      latinFontBytes: fonts.latin,
      overlays,
      values: valuesForFill,
      checks,
      images,
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
