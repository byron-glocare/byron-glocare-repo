/**
 * v2 슬롯 마커 주입(미리보기) + 채움 엔진.
 *
 * 탐지(slot-detect-v2)는 좌표 addr(t{ti}.r{ri}.c{ci}[.p{pi}])만 준다.
 * 여기서는 그 좌표로 원본 DOM 을 재탐색해:
 *   - markSlotsV2: 각 슬롯 위치에 ⟦S{index}⟧ 마커 런을 심어 브라우저(docx-preview)에서
 *     클릭 칩으로 만든다(기존 v1 UI 재사용).
 *   - fillSlotsV2: 종류별로 정확히 채운다.
 *       text/underline_blank/anchor_split → 값(또는 이미지 토큰)
 *       char_grid                          → 한 글자씩 칸칸이 분배
 *       checkbox_group                     → 선택한 옵션의 □ → ☑
 *   이미지는 그 자리에 {{%token}} 을 심고(호출측이 docxtemplater image module 로 마무리).
 */

import PizZip from "pizzip";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";

import type { SlotV2 } from "./slot-detect-v2";
import { detectSlotsXml } from "./slot-detect-v2";

const W = "w";
const tag = (n: string) => `${W}:${n}`;
// xmldom 의 DOM 타입(전역 lib.dom 의 Document/Element 와 nominal 로 다름)을 값에서 파생
type Doc = ReturnType<InstanceType<typeof DOMParser>["parseFromString"]>;
type El = ReturnType<Doc["createElement"]>;
type XText = ReturnType<Doc["createTextNode"]>;

export const marker = (i: number): string => `⟦S${i}⟧`;

export type SlotV2Binding =
  | { kind: "text"; value: string }
  | { kind: "image"; token: string }
  | { kind: "checkbox"; optionIndex: number };

// ── DOM 헬퍼 ─────────────────────────────────────────────────────────
function childElems(el: El, name: string): El[] {
  const want = tag(name);
  const out: El[] = [];
  const kids = el.childNodes;
  for (let i = 0; i < kids.length; i++) {
    const n = kids[i];
    if (n.nodeType === 1 && (n as El).nodeName === want) out.push(n as El);
  }
  return out;
}
function childElem(el: El, name: string): El | null {
  return childElems(el, name)[0] ?? null;
}
function descElems(el: El, name: string): El[] {
  const list = el.getElementsByTagName(tag(name));
  const out: El[] = [];
  for (let i = 0; i < list.length; i++) out.push(list[i] as unknown as El);
  return out;
}

/** addr 파싱: "t{ti}.r{ri}.c{ci}" 또는 "...p{pi}" */
function parseAddr(addr: string): {
  ti: number;
  ri: number;
  ci: number;
  pi: number | null;
} {
  const m = addr.match(/^t(\d+)\.r(\d+)\.c(\d+)(?:\.p(\d+))?$/);
  if (!m) throw new Error(`잘못된 addr: ${addr}`);
  return {
    ti: +m[1],
    ri: +m[2],
    ci: +m[3],
    pi: m[4] != null ? +m[4] : null,
  };
}

function topTables(doc: Doc): El[] {
  const body = doc.getElementsByTagName(tag("body"))[0] as unknown as
    | El
    | undefined;
  if (!body) return [];
  return childElems(body, "tbl");
}

/** addr → 셀 (+선택적 문단) */
function locate(
  doc: Doc,
  addr: string
): { tc: El; p: El | null } | null {
  const { ti, ri, ci, pi } = parseAddr(addr);
  const tbl = topTables(doc)[ti];
  if (!tbl) return null;
  const tr = childElems(tbl, "tr")[ri];
  if (!tr) return null;
  const tc = childElems(tr, "tc")[ci];
  if (!tc) return null;
  const p = pi != null ? (childElems(tc, "p")[pi] ?? null) : null;
  return { tc, p };
}

/** 셀의 첫 문단(없으면 생성) */
function firstPara(doc: Doc, tc: El): El {
  const ps = childElems(tc, "p");
  if (ps.length) return ps[0];
  const p = doc.createElement(tag("p"));
  tc.appendChild(p);
  return p;
}

function makeTextRun(doc: Doc, text: string, rPr?: El | null): El {
  const r = doc.createElement(tag("r"));
  if (rPr) r.appendChild(rPr.cloneNode(true));
  const t = doc.createElement(tag("t"));
  t.setAttribute("xml:space", "preserve");
  t.appendChild(doc.createTextNode(text));
  r.appendChild(t);
  return r;
}

// ── 마커 주입 (미리보기용) ───────────────────────────────────────────
/** 각 슬롯 위치에 ⟦S{index}⟧ 런을 심는다. char_grid 는 첫 칸에만 1개. */
function injectMarkers(doc: Doc, slots: SlotV2[]): void {
  for (const s of slots) {
    const addr = Array.isArray(s.addr) ? s.addr[0] : s.addr;
    const loc = locate(doc, addr);
    if (!loc) continue;
    const target =
      s.kind === "underline_blank" && loc.p ? loc.p : firstPara(doc, loc.tc);
    target.appendChild(makeTextRun(doc, marker(s.index)));
  }
}

export function markSlotsV2(buf: Buffer): {
  markedBuf: Buffer;
  slots: SlotV2[];
} {
  const zip = new PizZip(buf);
  const f = zip.file("word/document.xml");
  if (!f) throw new Error("올바른 .docx 가 아닙니다 (word/document.xml 없음).");
  const xml = f.asText();
  const slots = detectSlotsXml(xml);
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  injectMarkers(doc, slots);
  const out = new XMLSerializer().serializeToString(doc);
  zip.file("word/document.xml", out);
  return {
    markedBuf: zip.generate({ type: "nodebuffer" }) as Buffer,
    slots,
  };
}

// ── 채움 ─────────────────────────────────────────────────────────────
/** 셀 안 t 노드들을 순서대로 (텍스트 편집용) */
function cellTextNodes(tc: El): XText[] {
  const out: XText[] = [];
  for (const p of childElems(tc, "p")) {
    for (const t of descElems(p, "t")) {
      for (let i = 0; i < t.childNodes.length; i++) {
        const n = t.childNodes[i];
        if (n.nodeType === 3) out.push(n as unknown as XText);
      }
    }
  }
  return out;
}

/** k번째(0-based) □ 를 ☑ 로 교체 */
function checkOption(tc: El, optionIndex: number): boolean {
  let seen = -1;
  for (const tn of cellTextNodes(tc)) {
    const s = tn.data ?? "";
    let idx = -1;
    for (let i = 0; i < s.length; i++) {
      if (s[i] === "□") {
        seen += 1;
        if (seen === optionIndex) idx = i;
      }
    }
    if (idx >= 0) {
      // xmldom 직렬화기는 텍스트 노드의 .data 를 읽는다 (.nodeValue 세터는 반영 안 됨)
      tn.data = s.slice(0, idx) + "☑" + s.slice(idx + 1);
      return true;
    }
  }
  return false;
}

/** underline_blank: 문단 안 첫 (밑줄+탭) 런의 탭을 값 텍스트로 교체(밑줄 서식 승계) */
function fillUnderlineBlank(doc: Doc, p: El, value: string): boolean {
  for (const r of descElems(p, "r")) {
    const rpr = childElem(r, "rPr");
    const hasU = rpr ? childElem(rpr, "u") !== null : false;
    const tab = childElem(r, "tab");
    if (rpr && hasU && tab) {
      const t = doc.createElement(tag("t"));
      t.setAttribute("xml:space", "preserve");
      t.appendChild(doc.createTextNode(value));
      r.replaceChild(t, tab);
      return true;
    }
  }
  return false;
}

/** anchor_split: 셀 안 첫 빈틈(공백 2+/밑줄 2+)에 값, 없으면 문단 끝에 덧붙임 */
function fillAnchorSplit(doc: Doc, tc: El, value: string): void {
  const BLANK = /[ 　 ]{2,}|_{2,}/;
  for (const tn of cellTextNodes(tc)) {
    const s = tn.data ?? "";
    const m = s.match(BLANK);
    if (m && m.index != null) {
      tn.data = s.slice(0, m.index) + value + s.slice(m.index + m[0].length);
      return;
    }
  }
  firstPara(doc, tc).appendChild(makeTextRun(doc, value));
}

export function fillSlotsV2(
  buf: Buffer,
  resolve: (slot: SlotV2) => SlotV2Binding | null
): { zip: PizZip; slots: SlotV2[]; usedImage: boolean } {
  const zip = new PizZip(buf);
  const f = zip.file("word/document.xml");
  if (!f) throw new Error("올바른 .docx 가 아닙니다 (word/document.xml 없음).");
  const xml = f.asText();
  const slots = detectSlotsXml(xml);
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  let usedImage = false;

  for (const s of slots) {
    const b = resolve(s);
    if (!b) continue;
    const addr0 = Array.isArray(s.addr) ? s.addr[0] : s.addr;

    // 이미지: 슬롯 위치에 {{%token}} 런 삽입 (docxtemplater 가 마무리)
    if (b.kind === "image") {
      const loc = locate(doc, addr0);
      if (!loc) continue;
      const p =
        s.kind === "underline_blank" && loc.p ? loc.p : firstPara(doc, loc.tc);
      p.appendChild(makeTextRun(doc, b.token));
      usedImage = true;
      continue;
    }

    if (b.kind === "checkbox" && s.kind === "checkbox_group") {
      const loc = locate(doc, addr0);
      if (loc) checkOption(loc.tc, b.optionIndex);
      continue;
    }

    if (b.kind === "text") {
      if (s.kind === "char_grid" && Array.isArray(s.addr)) {
        // 한 글자씩 칸칸이 분배
        const chars = [...b.value];
        for (let i = 0; i < s.addr.length; i++) {
          const loc = locate(doc, s.addr[i]);
          if (!loc) continue;
          const ch = chars[i] ?? "";
          if (ch) firstPara(doc, loc.tc).appendChild(makeTextRun(doc, ch));
        }
        continue;
      }
      if (s.kind === "underline_blank") {
        const loc = locate(doc, addr0);
        if (loc?.p && fillUnderlineBlank(doc, loc.p, b.value)) continue;
        if (loc) firstPara(doc, loc.tc).appendChild(makeTextRun(doc, b.value));
        continue;
      }
      if (s.kind === "anchor_split") {
        const loc = locate(doc, addr0);
        if (loc) fillAnchorSplit(doc, loc.tc, b.value);
        continue;
      }
      // text (빈 셀)
      const loc = locate(doc, addr0);
      if (loc) firstPara(doc, loc.tc).appendChild(makeTextRun(doc, b.value));
      continue;
    }
  }

  const out = new XMLSerializer().serializeToString(doc);
  zip.file("word/document.xml", out);
  return { zip, slots, usedImage };
}
