import path from "node:path";
import { promises as fs } from "node:fs";
import Docxtemplater from "docxtemplater";
import ImageModule from "docxtemplater-image-module-free";
import imageSize from "image-size";

import { createAdminClient } from "@/lib/supabase/server";
import {
  fillDocxSlots,
  type InlineSlot,
  type SlotBinding,
} from "@/lib/docx/inline-slots";
import {
  buildBindings,
  isSignatureToken,
  type CatalogRow,
} from "@/lib/test/bindings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const TEMPLATES_DIR = path.join(process.cwd(), "templates");

const SIGNATURE_BOX: [number, number] = [150, 48];
const PHOTO_BOX: [number, number] = [128, 165];

function fitInBox(
  w: number,
  h: number,
  boxW: number,
  boxH: number
): [number, number] {
  if (w <= 0 || h <= 0) return [boxW, boxH];
  const r = w / h;
  return r > boxW / boxH ? [boxW, Math.round(boxW / r)] : [Math.round(boxH * r), boxH];
}

function safeSize(buf: Buffer): [number, number] {
  try {
    const d = imageSize(buf);
    if (d.width && d.height) return [d.width, d.height];
  } catch {
    /* ignore */
  }
  return [1, 1];
}

/**
 * POST /test/form-fill/fill — docx + 슬롯 바인딩 → 테스트 값으로 채운 docx.
 *   mapping: { [slotIndex]: token }  (token = 표준데이터 키 | 날짜파생 | today* | "lit:<직접입력>")
 */
export async function POST(req: Request): Promise<Response> {
  let file: unknown;
  let mapping: Record<number, string> = {};
  try {
    const form = await req.formData();
    file = form.get("file");
    mapping = JSON.parse(String(form.get("mapping") ?? "{}")) as Record<
      number,
      string
    >;
  } catch {
    return Response.json({ error: "요청을 읽지 못했습니다." }, { status: 400 });
  }

  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "DOCX 파일을 첨부하세요." }, { status: 400 });
  }

  try {
    // 값 출처 = 실제 표준데이터 카탈로그 (+ 날짜 파생 + 작성일)
    const supabase = createAdminClient();
    const { data: types } = await supabase
      .from("study_student_data_types")
      .select("key, label_ko, category, input_type")
      .eq("is_active", true)
      .order("sort_order");
    const { options, values } = buildBindings((types ?? []) as CatalogRow[]);
    const optByToken = new Map(options.map((o) => [o.token, o]));

    const buf = Buffer.from(await file.arrayBuffer());
    const usedImageTokens = new Set<string>();

    const resolve = (slot: InlineSlot): SlotBinding | null => {
      const token = mapping[slot.index];
      if (!token) return null;
      if (token.startsWith("lit:")) {
        return { kind: "text", value: token.slice(4) };
      }
      const opt = optByToken.get(token);
      if (!opt) return null;
      if (opt.kind === "image") {
        usedImageTokens.add(token);
        return { kind: "image", token: `{{%${token}}}` };
      }
      return { kind: "text", value: values[token] ?? "" };
    };

    const { zip, usedImage } = fillDocxSlots(buf, resolve);

    let out: Buffer;
    if (usedImage) {
      const [sigBuf, photoBuf] = await Promise.all([
        fs.readFile(path.join(TEMPLATES_DIR, "test-signature.png")),
        fs.readFile(path.join(TEMPLATES_DIR, "test-photo.png")),
      ]);
      const sigDim = safeSize(sigBuf);
      const photoDim = safeSize(photoBuf);
      const isSig = (token: string) =>
        isSignatureToken(token, optByToken.get(token)?.label ?? "");

      const imageModule = new ImageModule({
        centered: false,
        getImage: (value: string) => (isSig(value) ? sigBuf : photoBuf),
        getSize: (_img, _value, name): [number, number] =>
          isSig(name)
            ? fitInBox(sigDim[0], sigDim[1], SIGNATURE_BOX[0], SIGNATURE_BOX[1])
            : fitInBox(photoDim[0], photoDim[1], PHOTO_BOX[0], PHOTO_BOX[1]),
      });
      const doc = new Docxtemplater(zip, {
        delimiters: { start: "{{", end: "}}" },
        nullGetter: () => "",
        modules: [imageModule],
      });
      const data: Record<string, string> = {};
      for (const t of usedImageTokens) data[t] = t;
      doc.render(data);
      out = doc.getZip().generate({
        type: "nodebuffer",
        compression: "DEFLATE",
      }) as Buffer;
    } else {
      out = zip.generate({
        type: "nodebuffer",
        compression: "DEFLATE",
      }) as Buffer;
    }

    return new Response(new Uint8Array(out), {
      status: 200,
      headers: {
        "Content-Type": DOCX_MIME,
        "Content-Disposition": `attachment; filename="filled-${encodeURIComponent(
          file.name
        )}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const err = e as {
      message?: string;
      properties?: { errors?: Array<{ properties?: { explanation?: string } }> };
    };
    const details = (err?.properties?.errors ?? [])
      .map((x) => x?.properties?.explanation)
      .filter((x): x is string => !!x);
    return Response.json(
      { error: err?.message ?? "채움에 실패했습니다.", details },
      { status: 500 }
    );
  }
}
