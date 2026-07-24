/**
 * 작성서류(원본 양식) 자동 채움 코어 — 유학센터/셀프 학생 공용.
 *
 *   업로드된 원본 양식(.docx)을 학생의 표준데이터/이미지/서술형 답변으로 채워 반환.
 *   세션·클라이언트는 호출측(센터 RLS / 학생 authed)이 주입 → 여기선 순수 로직만.
 *   (기존 /center/.../final/docx-fill 라우트 본문을 그대로 이동. 동작 불변.)
 */

import "server-only";

import PizZip from "pizzip";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createServiceClient,
  STUDENT_FILES_BUCKET,
} from "@/lib/supabase/service";
import {
  fillDocx,
  swapImagesByTag,
  normLabel,
  type SlotResolve,
  type SlotAlign,
} from "@/lib/docx/fill";
import { fillPdfOverlay } from "@/lib/admission/fill-pdf-overlay";
import { finalDocFileName } from "@/lib/admission/build-form-sheet";
import { loadFillFonts } from "@/lib/admission/load-font";
import type { FormFieldOverlay } from "@/types/study";
import type { Database, Json } from "@/types/database";

type Client = SupabaseClient<Database>;

export type FillDocxResult =
  | { ok: true; bytes: Buffer; fileName: string }
  | { ok: false; status: number; message: string };

function fmt(v: Json | undefined): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object")
    return Array.isArray(v) ? v.map(String).join(", ") : "";
  if (typeof v === "boolean") return v ? "예" : "";
  return String(v);
}

/** 파일/이미지 값({url}|{path}|https) → 바이트 */
async function imageBytes(v: Json | undefined): Promise<Buffer | null> {
  const tryFetch = async (url: string): Promise<Buffer | null> => {
    try {
      const r = await fetch(url);
      if (!r.ok) return null;
      return Buffer.from(await r.arrayBuffer());
    } catch {
      return null;
    }
  };
  if (typeof v === "string" && /^https?:\/\//.test(v)) return tryFetch(v);
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const o = v as { url?: string; path?: string };
    if (o.url) return tryFetch(o.url);
    if (o.path) {
      try {
        const svc = createServiceClient();
        const { data } = await svc.storage
          .from(STUDENT_FILES_BUCKET)
          .download(o.path);
        if (!data) return null;
        return Buffer.from(await data.arrayBuffer());
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * @param supabase RLS 클라이언트(센터/학생). 학생 소유 확인은 RLS 가 담당.
 * @param studentId 채울 학생
 * @param formFileId 원본 양식 파일
 */
export async function fillFormDocx(
  supabase: Client,
  studentId: string,
  formFileId: string
): Promise<FillDocxResult> {
  const [{ data: student }, { data: form }] = await Promise.all([
    supabase
      .from("study_managed_students")
      .select("id, name")
      .eq("id", studentId)
      .maybeSingle(),
    supabase
      .from("study_admission_form_files")
      .select(
        "id, name_ko, file_name, file_url, mime_type, label_mapping, slot_mapping"
      )
      .eq("id", formFileId)
      .maybeSingle(),
  ]);
  if (!student || !form)
    return { ok: false, status: 404, message: "Not Found" };

  const isDocx =
    (form.mime_type ?? "").includes("word") ||
    form.file_name.toLowerCase().endsWith(".docx") ||
    form.file_url.toLowerCase().includes(".docx");
  if (!isDocx)
    return { ok: false, status: 400, message: "이 양식은 .docx 가 아닙니다." };

  const [{ data: types }, { data: values }, { data: essayDrafts }] =
    await Promise.all([
      supabase
        .from("study_student_data_types")
        .select("key, label_ko, label_vi, aliases"),
      supabase
        .from("study_student_data_values")
        .select("data_type_key, value")
        .eq("student_id", studentId),
      supabase
        .from("study_student_essay_drafts")
        .select("question_index, generated_text, edited_text")
        .eq("student_id", studentId)
        .eq("form_file_id", formFileId),
    ]);
  // 서술형 답변: 섹션 인덱스 → 최종 텍스트(편집본 우선)
  const essayMap = new Map<number, string>();
  for (const d of essayDrafts ?? [])
    essayMap.set(
      d.question_index,
      (d.edited_text ?? d.generated_text ?? "").trim()
    );

  const catMap = new Map<string, string>();
  for (const t of types ?? []) {
    const add = (s: string | null | undefined) => {
      if (s && s.trim()) catMap.set(normLabel(s), t.key);
    };
    add(t.label_ko);
    add(t.label_vi);
    const aliases = Array.isArray(t.aliases) ? (t.aliases as string[]) : [];
    for (const a of aliases) add(a);
  }
  const valMap = new Map<string, string>();
  const rawValMap = new Map<string, Json>();
  for (const dv of values ?? []) {
    valMap.set(dv.data_type_key, fmt(dv.value));
    rawValMap.set(dv.data_type_key, dv.value);
  }

  // 이미지(사진·서명) 값 미리 받기
  const isImageVal = (key: string, v: Json | undefined): boolean => {
    if (!(v && typeof v === "object" && !Array.isArray(v))) return false;
    const o = v as { url?: string; path?: string };
    const s = o.path || o.url || "";
    if (/\.(png|jpe?g|gif|webp)$/i.test(s)) return true;
    return /photo|사진|signature|서명|sign/i.test(key);
  };
  const extOf = (v: Json | undefined): string => {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const o = v as { url?: string; path?: string };
      const m = (o.path || o.url || "").match(/\.(png|jpe?g|gif|webp)$/i);
      if (m) return m[1].toLowerCase() === "jpg" ? "jpg" : m[1].toLowerCase();
    }
    return "png";
  };
  const sizeFor = (key: string): { wEmu: number; hEmu: number } => {
    if (/sign|서명/i.test(key)) return { wEmu: 1_440_000, hEmu: 540_000 };
    if (/photo|사진/i.test(key)) return { wEmu: 1_080_000, hEmu: 1_440_000 };
    return { wEmu: 1_080_000, hEmu: 1_080_000 };
  };
  const imageByKey = new Map<
    string,
    { bytes: Buffer; ext: string; wEmu: number; hEmu: number }
  >();
  for (const [key, raw] of rawValMap) {
    if (!isImageVal(key, raw)) continue;
    const bytes = await imageBytes(raw);
    if (!bytes) continue;
    imageByKey.set(key, { bytes, ext: extOf(raw), ...sizeFor(key) });
  }

  const now = new Date();
  const todayStr = `${now.getFullYear()}. ${now.getMonth() + 1}. ${now.getDate()}.`;

  const savedMap =
    form.label_mapping && typeof form.label_mapping === "object"
      ? (form.label_mapping as Record<string, string>)
      : {};
  const slotMap =
    form.slot_mapping && typeof form.slot_mapping === "object"
      ? (form.slot_mapping as Record<string, string>)
      : {};
  const alignOf = (idx: number): SlotAlign | undefined => {
    const v = slotMap[`j:a${idx}`];
    return v === "left" || v === "right" || v === "center" ? v : undefined;
  };
  const resolveKey = (
    allIndex: number,
    emptyIndex: number | null,
    labelNorm: string | null
  ): {
    key: string;
    viaLabel: boolean;
    overwrite: boolean;
    align?: SlotAlign;
  } | null => {
    const ak = `a${allIndex}`;
    if (ak in slotMap) {
      const k = slotMap[ak];
      if (!k) return null;
      return {
        key: k,
        viaLabel: false,
        overwrite: slotMap[`m:a${allIndex}`] !== "append",
        align: alignOf(allIndex),
      };
    }
    if (emptyIndex !== null && String(emptyIndex) in slotMap) {
      const k = slotMap[String(emptyIndex)];
      if (!k) return null;
      return { key: k, viaLabel: false, overwrite: false };
    }
    if (labelNorm) {
      let key: string | undefined;
      if (labelNorm in savedMap) {
        key = savedMap[labelNorm];
        if (!key) return null;
      } else {
        key = catMap.get(labelNorm);
      }
      if (key) return { key, viaLabel: true, overwrite: false };
    }
    return null;
  };
  const resolve: SlotResolve = ({ allIndex, emptyIndex, labelNorm }) => {
    const rk = resolveKey(allIndex, emptyIndex, labelNorm);
    if (!rk) return null;
    const { key, viaLabel, overwrite, align } = rk;
    if (key === "__today__")
      return { kind: "text", value: todayStr, viaLabel, overwrite, align };
    const em = key.match(/^essay:(\d+)$/);
    if (em)
      return {
        kind: "text",
        value: essayMap.get(Number(em[1])) ?? "",
        viaLabel,
        overwrite,
        align,
      };
    const img = imageByKey.get(key);
    if (img)
      return {
        kind: "image",
        bytes: img.bytes,
        ext: img.ext,
        wEmu: img.wEmu,
        hEmu: img.hEmu,
        viaLabel,
        overwrite,
        align,
      };
    return {
      kind: "text",
      value: valMap.get(key) ?? "",
      viaLabel,
      overwrite,
      align,
    };
  };

  let buf: Buffer;
  try {
    const res = await fetch(form.file_url);
    if (!res.ok) throw new Error(`원본 다운로드 실패 (${res.status})`);
    buf = Buffer.from(await res.arrayBuffer());
  } catch (e) {
    return {
      ok: false,
      status: 502,
      message: `원본 양식을 불러오지 못했습니다: ${
        e instanceof Error ? e.message : e
      }`,
    };
  }

  let filled: Buffer;
  try {
    const zip = new PizZip(buf);
    await swapImagesByTag(zip, async (tag) => {
      const key = catMap.get(normLabel(tag));
      if (!key) return null;
      return imageBytes(rawValMap.get(key));
    });
    const swapped = zip.generate({ type: "nodebuffer" }) as Buffer;
    filled = fillDocx(swapped, resolve).filled;
  } catch (e) {
    return {
      ok: false,
      status: 500,
      message: `채움 실패: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  const fileName = `${form.name_ko}_${student.name}.docx`.replace(/\s+/g, "_");
  return { ok: true, bytes: filled, fileName };
}

/** 채움 결과 → HTTP 응답 (센터/학생 라우트 공용) */
export function docxResponse(
  result: Extract<FillDocxResult, { ok: true }>,
  isPreview: boolean
): Response {
  const encoded = encodeURIComponent(result.fileName);
  const disposition = isPreview ? "inline" : "attachment";
  return new Response(result.bytes as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `${disposition}; filename="document.docx"; filename*=UTF-8''${encoded}`,
      "Cache-Control": "private, no-store",
    },
  });
}

// =============================================================================
// PDF 좌표 오버레이 채움 (양식이 PDF + field_overlays 있을 때)
// =============================================================================

export type FillPdfResult =
  | { ok: true; bytes: Uint8Array; fileName: string }
  | { ok: false; status: number; message: string };

function formatValue(v: Json | undefined, inputType: string): string {
  if (v === null || v === undefined || v === "") return "";
  if (inputType === "boolean") return v === true ? "예" : "아니오";
  if (Array.isArray(v)) return v.map(String).join(", ");
  if (typeof v === "object") return "";
  return String(v);
}

/** 파일류 input_type — 이미지로 렌더. */
const FILE_TYPES = new Set(["signature", "file", "image", "photo"]);

export async function fillFormPdf(
  supabase: Client,
  opts: {
    studentId: string;
    formFileId: string;
    appId: string;
    inputVals: Record<string, string>;
    origin: string;
  }
): Promise<FillPdfResult> {
  const { studentId, formFileId, appId, inputVals, origin } = opts;

  const [{ data: student }, { data: form }, { data: app }] = await Promise.all([
    supabase
      .from("study_managed_students")
      .select("id, name")
      .eq("id", studentId)
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
  if (!student || !form)
    return { ok: false, status: 404, message: "Not Found" };

  const overlays = (form.field_overlays ?? []) as FormFieldOverlay[];
  if (overlays.length === 0) {
    return {
      ok: false,
      status: 400,
      message:
        "이 양식은 채움 좌표가 지정되지 않았습니다. (글로케어에서 좌표 지정 필요)",
    };
  }
  const isPdf =
    (form.mime_type ?? "").toLowerCase().includes("pdf") ||
    form.file_name.toLowerCase().endsWith(".pdf") ||
    form.file_url.toLowerCase().includes(".pdf");
  if (!isPdf) {
    return { ok: false, status: 400, message: "PDF 양식만 좌표 채움이 가능합니다." };
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

  const bindKey = (ov: FormFieldOverlay) => ov.dataKey ?? ov.key;
  const dataKeys = new Set<string>();
  const essayIdx = new Set<number>();
  for (const ov of overlays) {
    const kind = ov.kind ?? "text";
    if (kind === "text" && ov.source === "input") continue;
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
            .eq("student_id", studentId)
            .in("data_type_key", dataKeysArr)
        : Promise.resolve({
            data: [] as Array<{ data_type_key: string; value: Json }>,
          }),
      essayIdx.size > 0
        ? supabase
            .from("study_student_essay_drafts")
            .select("question_index, generated_text, edited_text")
            .eq("student_id", studentId)
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
      else if (
        ct.includes("jpeg") ||
        ct.includes("jpg") ||
        /\.jpe?g($|\?)/i.test(url)
      )
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
      valuesForFill.set(ov.key, ov.staticText ?? "");
    } else if (ov.source === "input") {
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

  let pdfBytes: ArrayBuffer;
  try {
    const res = await fetch(form.file_url);
    if (!res.ok) throw new Error(`원본 PDF 다운로드 실패 (${res.status})`);
    pdfBytes = await res.arrayBuffer();
  } catch (e) {
    return {
      ok: false,
      status: 502,
      message: `원본 양식 PDF 를 불러오지 못했습니다: ${
        e instanceof Error ? e.message : String(e)
      }`,
    };
  }

  let bytes: Uint8Array;
  try {
    const fonts = await loadFillFonts(origin);
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
    return {
      ok: false,
      status: 500,
      message: `PDF 채움 실패: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  const fileName = finalDocFileName({
    docName: form.name_ko,
    studentName: student.name,
    universityNameKo: uni?.name_ko ?? "",
    departmentName: form.department_name ?? app?.target_department_label ?? null,
    term: spec?.term ?? "",
    ext: "pdf",
  });
  return { ok: true, bytes, fileName };
}

/** PDF 채움 결과 → HTTP 응답 */
export function pdfResponse(
  result: Extract<FillPdfResult, { ok: true }>,
  isPreview: boolean
): Response {
  const encoded = encodeURIComponent(result.fileName);
  const disposition = isPreview ? "inline" : "attachment";
  return new Response(Buffer.from(result.bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="document.pdf"; filename*=UTF-8''${encoded}`,
      "Cache-Control": "private, no-store",
    },
  });
}
