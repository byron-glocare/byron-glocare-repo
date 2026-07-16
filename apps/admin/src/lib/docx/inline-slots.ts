/**
 * 문자 단위 빈칸(슬롯) 탐지 — 기존 셀 단위 방식의 한계를 넘기 위한 엔진.
 *
 * 기존 injectSlotMarkers 는 "셀 하나 = 슬롯 하나"라서
 *   "지원자 :            (인)"  /  "      년      월      일"
 * 처럼 **한 칸/문단 안에 다른 텍스트와 섞인 빈칸**은 다룰 수 없었다(셀 통째 덮어쓰기/뒤에 덧붙이기).
 *
 * 여기서는 <w:t> 텍스트 안의 빈칸(밑줄 런·연속 공백)과 빈 셀을 각각 독립 슬롯으로 잡고,
 * 그 **정확한 위치**에만 토큰을 심는다. → 주변 텍스트("년", "(인)")는 그대로 보존.
 */

import PizZip from "pizzip";

export type SlotKind = "underscore" | "spaces" | "empty_cell";

export type InlineSlot = {
  index: number;
  kind: SlotKind;
  /** 원래 문자열 (미매핑 시 그대로 복원) */
  original: string;
  /** 빈칸 앞 문맥 (라벨 추정용) */
  before: string;
  /** 빈칸 뒤 문맥 */
  after: string;
};

export const marker = (i: number): string => `⟦S${i}⟧`;
const MARKER_RUN = (i: number) =>
  `<w:r><w:t xml:space="preserve">${marker(i)}</w:t></w:r>`;

/** 빈칸 패턴: 밑줄 2개 이상 / 공백(일반·전각·nbsp) 3개 이상 */
const BLANK_RE = /_{2,}|[  　]{3,}/g;

/** 모든 <w:t> 에 xml:space="preserve" 보장 (공백 보존). self-closing 은 대상 아님. */
function ensurePreserve(xml: string): string {
  return xml.replace(/<w:t(\s[^>]*)?>/g, (m, attrs: string | undefined) => {
    if (attrs && /xml:space\s*=/.test(attrs)) return m;
    return `<w:t${attrs ?? ""} xml:space="preserve">`;
  });
}

type Edit = {
  start: number;
  end: number;
  /** 슬롯 번호를 받아 대체 문자열 생성 */
  render: (i: number) => string;
  slot: Omit<InlineSlot, "index">;
};

/** <w:tc> 블록의 텍스트가 비었는지 */
function cellIsEmpty(block: string): boolean {
  const texts = [...block.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)]
    .map((m) => m[1])
    .join("");
  return texts.trim() === "";
}

/**
 * 원본 document.xml → 마커가 박힌 xml + 슬롯 목록.
 *   결정적(deterministic): 같은 입력 → 같은 슬롯 번호. (스캔/채움에서 재사용)
 */
export function markInlineSlots(rawXml: string): {
  markedXml: string;
  slots: InlineSlot[];
} {
  const xml = ensurePreserve(rawXml);
  const edits: Edit[] = [];

  // ── A) <w:t> 텍스트 안의 빈칸 (밑줄·연속공백) ─────────────────────
  const tRe = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
  let m: RegExpExecArray | null;
  while ((m = tRe.exec(xml)) !== null) {
    const text = m[1];
    if (!text) continue;
    const openEnd = m[0].indexOf(">") + 1; // 여는 태그 끝
    const textStart = m.index + openEnd;

    BLANK_RE.lastIndex = 0;
    let b: RegExpExecArray | null;
    while ((b = BLANK_RE.exec(text)) !== null) {
      const s = b.index;
      const e = s + b[0].length;
      // 문단 맨 앞/뒤 공백만 있는 경우도 빈칸으로 인정(예: "     년" 앞의 들여쓰기)
      const kind: SlotKind = b[0].startsWith("_") ? "underscore" : "spaces";
      edits.push({
        start: textStart + s,
        end: textStart + e,
        render: (i) => marker(i),
        slot: {
          kind,
          original: b[0],
          before: text.slice(Math.max(0, s - 24), s).trim(),
          after: text.slice(e, e + 14).trim(),
        },
      });
    }
  }

  // ── B) 빈 셀 (텍스트가 아예 없는 <w:tc>) ──────────────────────────
  const tcRe = /<w:tc[\s>][\s\S]*?<\/w:tc>/g;
  let c: RegExpExecArray | null;
  while ((c = tcRe.exec(xml)) !== null) {
    const block = c[0];
    if (!cellIsEmpty(block)) continue;
    const pEnd = block.indexOf("</w:p>");
    if (pEnd < 0) continue; // 문단 없는 셀은 건너뜀
    const pos = c.index + pEnd;
    edits.push({
      start: pos,
      end: pos, // 삽입
      render: (i) => MARKER_RUN(i),
      slot: { kind: "empty_cell", original: "", before: "", after: "" },
    });
  }

  // ── 위치 순으로 번호 부여 후, 뒤에서부터 적용 ────────────────────
  edits.sort((a, b2) => a.start - b2.start || a.end - b2.end);
  const slots: InlineSlot[] = edits.map((e, i) => ({ index: i, ...e.slot }));

  let out = xml;
  for (let i = edits.length - 1; i >= 0; i--) {
    const e = edits[i];
    out = out.slice(0, e.start) + e.render(i) + out.slice(e.end);
  }
  return { markedXml: out, slots };
}

/** 슬롯에 넣을 것: 확정된 텍스트 값 / 이미지 토큰(docxtemplater image module 이 채움) */
export type SlotBinding =
  | { kind: "text"; value: string }
  | { kind: "image"; token: string };

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * 값을 원래 빈칸 너비만큼 가운데 패딩 — 양식의 칸 너비/레이아웃 보존.
 *   (공백 17칸 자리에 "2026"만 넣으면 줄이 무너지므로)
 */
function padToWidth(v: string, width: number): string {
  if (width <= 0 || v.length >= width) return v;
  const total = width - v.length;
  const left = Math.floor(total / 2);
  return " ".repeat(left) + v + " ".repeat(total - left);
}

/**
 * 인라인 마커 자리에 이미지 토큰을 **자기만의 런**으로 분리해 심는다.
 *
 * image module 은 토큰이 든 **런 전체를 교체**한다. 그래서 "지원자 :⟦S3⟧(인)" 처럼
 * 한 런 안에 주변 텍스트가 같이 있으면 "지원자 :"·"(인)" 까지 날아간다.
 * → 런을 [앞텍스트][토큰][뒤텍스트] 3개로 쪼개서 토큰 런만 교체되게 한다. (서식 rPr 승계)
 */
function splitRunForImageToken(
  xml: string,
  mk: string,
  token: string
): string {
  const i = xml.indexOf(mk);
  if (i < 0) return xml;

  // 마커를 감싼 <w:r> 범위
  const rOpen = xml.lastIndexOf("<w:r", i);
  if (rOpen < 0) return xml.split(mk).join(token);
  const rClose = xml.indexOf("</w:r>", i);
  if (rClose < 0) return xml.split(mk).join(token);
  const rEnd = rClose + "</w:r>".length;

  const runXml = xml.slice(rOpen, rEnd);
  const rPr = runXml.match(/<w:rPr>[\s\S]*?<\/w:rPr>/)?.[0] ?? "";
  const tMatch = runXml.match(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/);
  if (!tMatch) return xml.split(mk).join(token);

  const text = tMatch[1];
  const at = text.indexOf(mk);
  if (at < 0) return xml.split(mk).join(token);
  const before = text.slice(0, at);
  const after = text.slice(at + mk.length);

  const runOf = (t: string) =>
    t ? `<w:r>${rPr}<w:t xml:space="preserve">${t}</w:t></w:r>` : "";
  const replacement =
    runOf(before) + `<w:r>${rPr}<w:t>${token}</w:t></w:r>` + runOf(after);

  return xml.slice(0, rOpen) + replacement + xml.slice(rEnd);
}

/**
 * 마커 → 값/이미지토큰/원복.
 *   resolve(slot) 이 null 이면 original 로 되돌린다(레이아웃 보존).
 *   텍스트 값은 XML 이스케이프 + 원래 빈칸 너비로 패딩해서 **그 자리에만** 심는다.
 */
export function fillSlots(
  markedXml: string,
  slots: InlineSlot[],
  resolve: (slot: InlineSlot) => SlotBinding | null
): string {
  let out = markedXml;
  for (const s of slots) {
    const b = resolve(s);
    const mk = marker(s.index);

    if (!b) {
      // 미매핑 — 원복 (빈 셀은 마커 런 자체를 제거)
      if (s.kind === "empty_cell") out = out.replace(MARKER_RUN(s.index), "");
      else out = out.split(mk).join(s.original);
      continue;
    }

    if (b.kind === "image") {
      // 빈 셀 마커는 이미 단독 런 → 그대로 치환. 인라인은 런 분리 필요.
      if (s.kind === "empty_cell") out = out.split(mk).join(b.token);
      else out = splitRunForImageToken(out, mk, b.token);
      continue;
    }

    const padded =
      s.kind === "empty_cell"
        ? b.value
        : padToWidth(b.value, s.original.length);
    out = out.split(mk).join(escapeXml(padded));
  }
  return out;
}

/** docx 버퍼 → 마커 박힌 버퍼 + 슬롯 (브라우저 미리보기용) */
export function scanDocxSlots(buf: Buffer): {
  markedBuf: Buffer;
  slots: InlineSlot[];
} {
  const zip = new PizZip(buf);
  const f = zip.file("word/document.xml");
  if (!f) throw new Error("올바른 .docx 가 아닙니다 (word/document.xml 없음).");
  const { markedXml, slots } = markInlineSlots(f.asText());
  zip.file("word/document.xml", markedXml);
  return { markedBuf: zip.generate({ type: "nodebuffer" }) as Buffer, slots };
}

/**
 * docx 버퍼 + 슬롯 해석 → 값이 채워진(이미지는 토큰만 심긴) 버퍼.
 *   반환 zip 은 이미지 토큰이 남아 있을 수 있으므로, 호출측이 필요 시 docxtemplater 로 마무리.
 */
export function fillDocxSlots(
  buf: Buffer,
  resolve: (slot: InlineSlot) => SlotBinding | null
): { zip: PizZip; slots: InlineSlot[]; usedImage: boolean } {
  const zip = new PizZip(buf);
  const f = zip.file("word/document.xml");
  if (!f) throw new Error("올바른 .docx 가 아닙니다 (word/document.xml 없음).");
  const { markedXml, slots } = markInlineSlots(f.asText());
  let usedImage = false;
  const wrapped = (s: InlineSlot) => {
    const b = resolve(s);
    if (b?.kind === "image") usedImage = true;
    return b;
  };
  zip.file("word/document.xml", fillSlots(markedXml, slots, wrapped));
  return { zip, slots, usedImage };
}
