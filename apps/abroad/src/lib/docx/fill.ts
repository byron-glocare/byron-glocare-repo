import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

/**
 * DOCX 양식 자동 채움 엔진 (center, 실제 학생값).
 *   - 빈 셀(값 슬롯)을 문서순 번호. 슬롯 매핑/라벨 추론으로 값 결정.
 *   - 텍스트는 토큰 치환, 이미지(사진·서명)는 그 칸에 그림 삽입.
 *   - 값 셀만 가로·세로 가운데 정렬. docxtemplater 로 텍스트 치환.
 */

export const normLabel = (s: string): string =>
  s.replace(/\s+/g, "").toLowerCase();

/** 슬롯 채움 결과. text=토큰 치환, image=그 칸에 그림 삽입. overwrite=칸 기존내용 덮어쓰기. */
export type SlotFill =
  | { kind: "text"; value: string; viaLabel: boolean; overwrite: boolean }
  | {
      kind: "image";
      bytes: Buffer;
      ext: string;
      wEmu: number;
      hEmu: number;
      viaLabel: boolean;
      overwrite: boolean;
    };

/**
 * 슬롯 값 해석기.
 *   allIndex=전체 셀 번호, emptyIndex=빈칸이면 빈칸 번호(아니면 null), labelNorm=추론 앞 라벨.
 */
export type SlotResolve = (ctx: {
  allIndex: number;
  emptyIndex: number | null;
  labelNorm: string | null;
}) => SlotFill | null;

const cellText = (tc: string): string =>
  (tc.match(/<w:t[ >][\s\S]*?<\/w:t>/g) || [])
    .map((t) => t.replace(/<[^>]+>/g, ""))
    .join("")
    .replace(/&amp;/g, "&")
    .trim();

function readCells(xml: string): {
  cells: { raw: string; start: number; end: number }[];
  texts: string[];
} {
  const cells: { raw: string; start: number; end: number }[] = [];
  const re = /<w:tc>[\s\S]*?<\/w:tc>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)))
    cells.push({ raw: m[0], start: m.index, end: m.index + m[0].length });
  return { cells, texts: cells.map((c) => cellText(c.raw)) };
}

/** 값 셀: vAlign center + 첫 문단 jc center + innerRun 주입. overwrite=기존 run 제거 후 주입. */
function putCell(raw: string, innerRun: string, overwrite: boolean): string {
  let r = raw;
  if (/<w:tcPr>/.test(r))
    r = r.replace(
      /<w:tcPr>([\s\S]*?)<\/w:tcPr>/,
      (_m, i: string) =>
        `<w:tcPr>${i.replace(/<w:vAlign[^>]*\/>/g, "")}<w:vAlign w:val="center"/></w:tcPr>`
    );
  else r = r.replace(/<w:tc>/, '<w:tc><w:tcPr><w:vAlign w:val="center"/></w:tcPr>');

  let done = false;
  r = r.replace(
    /(<w:p(?: [^>]*)?>)([\s\S]*?)(<\/w:p>)/,
    (m, po: string, inner: string, pc: string) => {
      if (done) return m;
      done = true;
      let pPr = "";
      let rest = inner;
      const pm = inner.match(/^(<w:pPr>[\s\S]*?<\/w:pPr>)([\s\S]*)$/);
      if (pm) {
        pPr = pm[1];
        rest = pm[2];
      }
      if (pPr)
        pPr = pPr.replace(
          /<w:pPr>([\s\S]*?)<\/w:pPr>/,
          (_x, pi: string) =>
            `<w:pPr>${pi.replace(/<w:jc[^>]*\/>/g, "")}<w:jc w:val="center"/></w:pPr>`
        );
      else pPr = `<w:pPr><w:jc w:val="center"/></w:pPr>`;
      const keep = overwrite ? "" : rest;
      return po + pPr + keep + innerRun + pc;
    }
  );
  return r;
}

const tokenRun = (tokenKey: string): string =>
  `<w:r><w:t xml:space="preserve">{{${tokenKey}}}</w:t></w:r>`;

/** 인라인 이미지 그림 run (네임스페이스 인라인 선언 — 루트 미선언이어도 안전) */
function drawingRun(
  rId: string,
  id: number,
  wEmu: number,
  hEmu: number
): string {
  return (
    `<w:r><w:drawing>` +
    `<wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" distT="0" distB="0" distL="0" distR="0">` +
    `<wp:extent cx="${wEmu}" cy="${hEmu}"/>` +
    `<wp:effectExtent l="0" t="0" r="0" b="0"/>` +
    `<wp:docPr id="${id}" name="img${id}"/>` +
    `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
    `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:nvPicPr><pic:cNvPr id="${id}" name="img${id}"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${wEmu}" cy="${hEmu}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
    `</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`
  );
}

/** png/jpeg/gif 가 [Content_Types].xml 에 없으면 추가 */
function ensureImageContentTypes(zip: PizZip, exts: Set<string>): void {
  const ctPath = "[Content_Types].xml";
  let ct = zip.file(ctPath)?.asText();
  if (!ct) return;
  for (const ext of exts) {
    const ctype =
      ext === "jpg" || ext === "jpeg"
        ? "image/jpeg"
        : ext === "gif"
          ? "image/gif"
          : "image/png";
    if (!new RegExp(`Extension="${ext}"`, "i").test(ct))
      ct = ct.replace("</Types>", `<Default Extension="${ext}" ContentType="${ctype}"/></Types>`);
  }
  zip.file(ctPath, ct);
}

/**
 * 양식 안의 "태그된 이미지"(대체텍스트/이름 = 사진·서명 등)를 학생 이미지로 교체.
 *   (운영자가 미리 더미 이미지를 넣어둔 경우용. 슬롯 클릭 배치와 별개.)
 */
export async function swapImagesByTag(
  zip: PizZip,
  resolve: (tag: string) => Promise<Buffer | null>
): Promise<number> {
  const docXmlFile = zip.file("word/document.xml");
  if (!docXmlFile) return 0;
  const xml = docXmlFile.asText();

  const relsFile = zip.file("word/_rels/document.xml.rels");
  const rels = relsFile ? relsFile.asText() : "";
  const relMap = new Map<string, string>();
  for (const m of rels.matchAll(/<Relationship Id="([^"]+)"[^>]*Target="([^"]+)"/g))
    relMap.set(m[1], m[2]);

  let swapped = 0;
  const drawings = xml.match(/<w:drawing>[\s\S]*?<\/w:drawing>/g) || [];
  for (const d of drawings) {
    const tag =
      (d.match(/<wp:docPr[^>]*descr="([^"]*)"/) || [])[1] ||
      (d.match(/<wp:docPr[^>]*name="([^"]*)"/) || [])[1] ||
      "";
    if (!tag) continue;
    const bytes = await resolve(tag);
    if (!bytes) continue;
    const rId = (d.match(/<a:blip[^>]*r:embed="([^"]+)"/) || [])[1];
    if (!rId) continue;
    let target = relMap.get(rId);
    if (!target) continue;
    if (!target.startsWith("word/")) target = "word/" + target.replace(/^\.?\//, "");
    zip.file(target, bytes);
    swapped++;
  }
  return swapped;
}

/** docx 버퍼 → 슬롯 해석기로 텍스트 치환 + 이미지 삽입. */
export function fillDocx(
  srcBuf: Buffer,
  resolve: SlotResolve
): { filled: Buffer; matchedCount: number } {
  const zip = new PizZip(srcBuf);
  const docXml = zip.file("word/document.xml");
  if (!docXml) throw new Error("올바른 .docx 가 아닙니다.");
  const xml = docXml.asText();
  const { cells, texts } = readCells(xml);

  const textPlan = new Map<number, { key: string; value: string; overwrite: boolean }>();
  const imagePlan: {
    cellIdx: number;
    bytes: Buffer;
    ext: string;
    wEmu: number;
    hEmu: number;
    overwrite: boolean;
  }[] = [];
  const usedLabel = new Set<number>();
  let n = 0;
  let emptyIndex = -1;
  for (let i = 0; i < cells.length; i++) {
    const empty = texts[i] === "";
    if (empty) emptyIndex++;
    let labelIdx = -1;
    let labelNorm: string | null = null;
    if (empty) {
      for (let j = i - 1; j >= 0; j--) {
        if (texts[j] !== "") {
          labelIdx = j;
          break;
        }
      }
      if (labelIdx >= 0 && !usedLabel.has(labelIdx)) labelNorm = normLabel(texts[labelIdx]);
    }
    const res = resolve({ allIndex: i, emptyIndex: empty ? emptyIndex : null, labelNorm });
    if (!res) continue;
    if (res.viaLabel && labelIdx >= 0) usedLabel.add(labelIdx);
    if (res.kind === "text")
      textPlan.set(i, { key: `f${n++}`, value: res.value, overwrite: res.overwrite });
    else
      imagePlan.push({
        cellIdx: i,
        bytes: res.bytes,
        ext: res.ext,
        wEmu: res.wEmu,
        hEmu: res.hEmu,
        overwrite: res.overwrite,
      });
  }

  // 이미지: media + rels + content types
  const imageRun = new Map<number, string>();
  if (imagePlan.length) {
    const relsPath = "word/_rels/document.xml.rels";
    let rels =
      zip.file(relsPath)?.asText() ??
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;
    let maxId = 0;
    for (const m of rels.matchAll(/Id="rId(\d+)"/g))
      maxId = Math.max(maxId, Number(m[1]));
    const exts = new Set<string>();
    let imgN = 0;
    let docPrId = 9001;
    for (const im of imagePlan) {
      maxId++;
      imgN++;
      const rId = `rId${maxId}`;
      const ext = (im.ext || "png").toLowerCase();
      exts.add(ext);
      const mediaName = `slotimg${imgN}.${ext}`;
      zip.file(`word/media/${mediaName}`, im.bytes);
      rels = rels.replace(
        "</Relationships>",
        `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${mediaName}"/></Relationships>`
      );
      imageRun.set(im.cellIdx, drawingRun(rId, docPrId++, im.wEmu, im.hEmu));
    }
    zip.file(relsPath, rels);
    ensureImageContentTypes(zip, exts);
  }

  // 셀 편집 (뒤에서부터 splice)
  const edits: { start: number; end: number; raw: string }[] = [];
  for (const [idx, info] of textPlan)
    edits.push({
      start: cells[idx].start,
      end: cells[idx].end,
      raw: putCell(cells[idx].raw, tokenRun(info.key), info.overwrite),
    });
  for (const im of imagePlan)
    edits.push({
      start: cells[im.cellIdx].start,
      end: cells[im.cellIdx].end,
      raw: putCell(cells[im.cellIdx].raw, imageRun.get(im.cellIdx) ?? "", im.overwrite),
    });
  let out = xml;
  for (const e of edits.sort((a, b) => b.start - a.start))
    out = out.slice(0, e.start) + e.raw + out.slice(e.end);
  zip.file("word/document.xml", out);

  // 텍스트 토큰 치환
  const values: Record<string, string> = {};
  for (const [, info] of textPlan) values[info.key] = info.value;
  const doc = new Docxtemplater(zip, {
    delimiters: { start: "{{", end: "}}" },
    nullGetter: () => "",
  });
  doc.render(values);
  const filled = doc.getZip().generate({ type: "nodebuffer" }) as Buffer;
  return { filled, matchedCount: textPlan.size + imagePlan.length };
}
