/**
 * GET /center/students/[id]/final/docx-fill?form=<formFileId>[&preview=1]
 *   업로드된 .docx 원본 양식을 학생의 실제 표준데이터로 채워 반환.
 *   - 표 라벨을 데이터 메뉴(label_ko/label_vi/aliases)와 매칭해 그 칸만 채움.
 *   - 양식이 .docx 일 때만 동작 (PDF 좌표 양식은 /final/pdf).
 */

import { type NextRequest } from "next/server";
import PizZip from "pizzip";

import { verifyCenterSession } from "@/lib/center/dal";
import { createCenterClient } from "@/lib/supabase/center";
import {
  createServiceClient,
  STUDENT_FILES_BUCKET,
} from "@/lib/supabase/service";
import {
  fillDocx,
  swapImagesByTag,
  normLabel,
  type SlotResolve,
} from "@/lib/docx/fill";
import type { Json } from "@/types/database";

export const runtime = "nodejs";

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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await verifyCenterSession();
  const { id } = await params;
  const formFileId = req.nextUrl.searchParams.get("form") ?? "";
  const isPreview = req.nextUrl.searchParams.get("preview") === "1";
  const supabase = await createCenterClient();

  const [{ data: student }, { data: form }] = await Promise.all([
    supabase
      .from("study_managed_students")
      .select("id, name")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("study_admission_form_files")
      .select(
        "id, name_ko, file_name, file_url, mime_type, label_mapping, slot_mapping"
      )
      .eq("id", formFileId)
      .maybeSingle(),
  ]);
  if (!student || !form) return new Response("Not Found", { status: 404 });

  const isDocx =
    (form.mime_type ?? "").includes("word") ||
    form.file_name.toLowerCase().endsWith(".docx") ||
    form.file_url.toLowerCase().includes(".docx");
  if (!isDocx)
    return new Response("이 양식은 .docx 가 아닙니다.", { status: 400 });

  const [{ data: types }, { data: values }] = await Promise.all([
    supabase
      .from("study_student_data_types")
      .select("key, label_ko, label_vi, aliases"),
    supabase
      .from("study_student_data_values")
      .select("data_type_key, value")
      .eq("student_id", id),
  ]);

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

  // 이미지(사진·서명) 값 미리 받기 — 슬롯/라벨이 이미지 키로 풀리면 그 칸에 그림 삽입
  const isImageVal = (key: string, v: Json | undefined): boolean => {
    if (!(v && typeof v === "object" && !Array.isArray(v))) return false;
    const o = v as { url?: string; path?: string };
    const s = o.path || o.url || "";
    if (/\.(png|jpe?g|gif|webp)$/i.test(s)) return true;
    return /photo|사진|signature|서명|sign/i.test(key); // 확장자 없어도 사진/서명 키
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
    if (/sign|서명/i.test(key)) return { wEmu: 1_440_000, hEmu: 540_000 }; // 40×15mm
    if (/photo|사진/i.test(key)) return { wEmu: 1_080_000, hEmu: 1_440_000 }; // 30×40mm
    return { wEmu: 1_080_000, hEmu: 1_080_000 }; // 30×30mm
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

  // 슬롯 매핑(빈칸 직접 배치) 우선 → 라벨 매핑 → 카탈로그 자동매칭 폴백
  const savedMap =
    form.label_mapping && typeof form.label_mapping === "object"
      ? (form.label_mapping as Record<string, string>)
      : {};
  const slotMap =
    form.slot_mapping && typeof form.slot_mapping === "object"
      ? (form.slot_mapping as Record<string, string>)
      : {};
  const resolveKey = (
    slot: number,
    labelNorm: string | null
  ): { key: string; viaLabel: boolean } | null => {
    const sk = String(slot);
    if (sk in slotMap) {
      const k = slotMap[sk];
      if (!k) return null; // 명시적으로 "채우지 않음"
      return { key: k, viaLabel: false };
    }
    if (labelNorm) {
      let key: string | undefined;
      if (labelNorm in savedMap) {
        key = savedMap[labelNorm];
        if (!key) return null;
      } else {
        key = catMap.get(labelNorm);
      }
      if (key) return { key, viaLabel: true };
    }
    return null;
  };
  const resolve: SlotResolve = ({ slot, labelNorm }) => {
    const rk = resolveKey(slot, labelNorm);
    if (!rk) return null;
    const { key, viaLabel } = rk;
    if (key === "__today__")
      return { kind: "text", value: todayStr, viaLabel };
    const img = imageByKey.get(key);
    if (img)
      return {
        kind: "image",
        bytes: img.bytes,
        ext: img.ext,
        wEmu: img.wEmu,
        hEmu: img.hEmu,
        viaLabel,
      };
    return { kind: "text", value: valMap.get(key) ?? "", viaLabel };
  };

  let buf: Buffer;
  try {
    const res = await fetch(form.file_url);
    if (!res.ok) throw new Error(`원본 다운로드 실패 (${res.status})`);
    buf = Buffer.from(await res.arrayBuffer());
  } catch (e) {
    return new Response(
      `원본 양식을 불러오지 못했습니다: ${e instanceof Error ? e.message : e}`,
      { status: 502 }
    );
  }

  let filled: Buffer;
  try {
    // 1) 태그된 더미 이미지(사진·서명 등)를 학생 이미지로 교체
    const zip = new PizZip(buf);
    await swapImagesByTag(zip, async (tag) => {
      const key = catMap.get(normLabel(tag));
      if (!key) return null;
      return imageBytes(rawValMap.get(key));
    });
    const swapped = zip.generate({ type: "nodebuffer" }) as Buffer;
    // 2) 텍스트 토큰 채움
    filled = fillDocx(swapped, resolve).filled;
  } catch (e) {
    return new Response(
      `채움 실패: ${e instanceof Error ? e.message : String(e)}`,
      { status: 500 }
    );
  }

  const fileName = `${form.name_ko}_${student.name}.docx`.replace(/\s+/g, "_");
  const encoded = encodeURIComponent(fileName);
  const disposition = isPreview ? "inline" : "attachment";

  return new Response(filled as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `${disposition}; filename="document.docx"; filename*=UTF-8''${encoded}`,
      "Cache-Control": "private, no-store",
    },
  });
}
