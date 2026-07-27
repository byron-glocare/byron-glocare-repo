/**
 * 구조적 빈칸(슬롯) 탐지 v2 — "데이터"가 아니라 "문서의 빈칸"을 기준으로 전수 열거.
 *
 * 기존 inline-slots(v1) 는 정규식으로 밑줄·연속공백·빈 셀만 잡아 **탭 빈칸·체크박스·
 * 주민번호 격자·표 구조(gridSpan/vMerge)** 를 놓쳤다(70% 천장).
 *
 * v2 는 표를 gridSpan/vMerge 를 반영해 격자로 재구성하고, 5종 슬롯을 구조적으로 잡는다.
 * AI(또는 운영자)는 각 슬롯에 "어떤 필드가 들어가는가"만 고르면 된다(분류 문제).
 *   - text          : 빈 셀 하나
 *   - char_grid     : 연속 빈 셀 4칸+ (주민번호 등 글자칸 격자)
 *   - checkbox_group: □ 가 든 셀 (각 □ 옵션이 선택지)
 *   - underline_blank: 밑줄+탭으로 만든 문단 안 빈칸  ← v1 이 못 잡던 것
 *   - anchor_split  : 년/월/일/관계:/(은행명) 등 앵커가 섞인 셀
 *
 * 참고 원본: docs/application_ocr/slot_detect.py (Python 프로토타입) 를 그대로 이식.
 * 좌표 addr(t{ti}.r{ri}.c{ci}) 는 **최상위 표 순서 / 직속 tr / 직속 tc** 인덱스 —
 * 결정적(deterministic) 이라 마커 주입·채움에서 동일 좌표로 재탐색한다.
 */

import PizZip from "pizzip";
import { DOMParser } from "@xmldom/xmldom";

export type SlotV2Kind =
  | "text"
  | "char_grid"
  | "checkbox_group"
  | "underline_blank"
  | "anchor_split"
  | "date_part";

export type DateUnit = "year" | "month" | "day";

export type SlotV2 = {
  /** "S001" 형태 표시용 id */
  id: string;
  /** 0-based 마커 번호 (⟦S{index}⟧) */
  index: number;
  kind: SlotV2Kind;
  /** 좌표. char_grid 는 셀 배열, 그 외 단일 */
  addr: string | string[];
  /** char_grid: 칸 수 */
  boxes?: number;
  /** checkbox_group: □ 옵션들 */
  options?: string[];
  /** underline_blank: 밑줄 탭 개수 */
  blanks?: number;
  /** underline_blank: 문단 원문(라벨 추정) */
  line_text?: string;
  /** anchor_split: 원문 템플릿 */
  template?: string;
  /** date_part: 이 슬롯이 채우는 날짜 단위 (년/월/일 앞에 값 삽입) */
  unit?: DateUnit;
  /** 같은 행 왼쪽 라벨 후보 */
  label_left?: string | null;
  /** 같은 열 위쪽 헤더 후보 */
  label_above?: string | null;
};

const W = "w";
const tag = (n: string) => `${W}:${n}`;

// ── DOM 헬퍼 (lxml findall/iter 대응) ────────────────────────────────
type El = Element;

/** 직속 자식 엘리먼트 중 nodeName 이 w:{name} 인 것 (lxml findall('w:name')) */
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

/** 첫 직속 자식 (lxml find('w:name')) */
function childElem(el: El, name: string): El | null {
  return childElems(el, name)[0] ?? null;
}

/** 모든 후손 엘리먼트 w:{name} (lxml .//w:name / iter) — 자기 자신 제외 */
function descElems(el: El, name: string): El[] {
  const list = el.getElementsByTagName(tag(name));
  const out: El[] = [];
  for (let i = 0; i < list.length; i++) out.push(list[i] as unknown as El);
  return out;
}

function attrW(el: El | null, name: string): string | null {
  if (!el) return null;
  return el.getAttribute(`${W}:${name}`);
}

// ── 셀 텍스트 / 라벨 ─────────────────────────────────────────────────
/** 셀의 보이는 텍스트: 직속 문단별 후손 t 를 이어붙이고, 문단들을 공백으로 join */
function cellText(tc: El): string {
  const out: string[] = [];
  for (const p of childElems(tc, "p")) {
    let s = "";
    for (const t of descElems(p, "t")) s += t.textContent ?? "";
    out.push(s);
  }
  return out
    .map((x) => x.trim())
    .filter((x) => x)
    .join(" ");
}

/** 셀 원문(strip 안 함) — 빈칸 판정용 */
function cellRawText(tc: El): string {
  let s = "";
  for (const p of childElems(tc, "p")) {
    for (const t of descElems(p, "t")) s += t.textContent ?? "";
    s += "\n";
  }
  return s;
}

/** 셀에 '채울 빈칸'이 있는가 = 탭 / 밑줄 2+ / 공백 2+ (프로즈·라벨 오탐 제거용) */
function cellHasBlank(tc: El): boolean {
  if (descElems(tc, "tab").length > 0) return true;
  return /_{2,}|[ 　 ]{2,}/.test(cellRawText(tc));
}

type Cell = { ci: number; gc: number; span: number; ghost: boolean; el: El };

/** gridSpan/vMerge 를 반영해 셀의 실제 시각 열 위치(gc)를 계산 */
function buildGrid(tbl: El): Cell[][] {
  const grid: Cell[][] = [];
  for (const tr of childElems(tbl, "tr")) {
    let gc = 0;
    const row: Cell[] = [];
    const cells = childElems(tr, "tc");
    for (let ci = 0; ci < cells.length; ci++) {
      const tc = cells[ci];
      const tcPr = childElem(tc, "tcPr");
      const gs = tcPr ? childElem(tcPr, "gridSpan") : null;
      const vm = tcPr ? childElem(tcPr, "vMerge") : null;
      const span = gs ? parseInt(attrW(gs, "val") ?? "1", 10) || 1 : 1;
      // vMerge 에 val="restart" 가 없으면 '이어지는 껍데기 셀'(화면에 안 보임)
      const cont = vm !== null && attrW(vm, "val") !== "restart";
      row.push({ ci, gc, span, ghost: cont, el: tc });
      gc += span;
    }
    grid.push(row);
  }
  return grid;
}

/** 같은 행에서 왼쪽으로 가장 가까운 '글자 있는' 셀 = 라벨 후보 */
function leftLabel(grid: Cell[][], ri: number, cell: Cell): string | null {
  let best: string | null = null;
  for (const c of grid[ri]) {
    if (c.gc < cell.gc && !c.ghost) {
      const t = cellText(c.el);
      if (t) best = t;
    }
  }
  return best;
}

/** 같은 시각 열의 위쪽에서 가장 가까운 글자 있는 셀 = 헤더 후보 */
function aboveLabel(grid: Cell[][], ri: number, cell: Cell): string | null {
  for (let r = ri - 1; r >= 0; r--) {
    for (const c of grid[r]) {
      if (c.gc <= cell.gc && cell.gc < c.gc + c.span && !c.ghost) {
        const t = cellText(c.el);
        if (t) return t;
      }
    }
  }
  return null;
}

/** 최상위 표들 → 슬롯 목록 (slot_detect.py detect 이식) */
function detect(tbls: El[]): SlotV2[] {
  const slots: SlotV2[] = [];
  let sid = 0;
  const nid = () => {
    sid += 1;
    return `S${String(sid).padStart(3, "0")}`;
  };
  const push = (s: Omit<SlotV2, "index">) =>
    slots.push({ ...s, index: slots.length });

  for (let ti = 0; ti < tbls.length; ti++) {
    const grid = buildGrid(tbls[ti]);
    for (let ri = 0; ri < grid.length; ri++) {
      const row = grid[ri];
      let run: Cell[] = [];

      // 연속 빈 셀 격자 flush → char_grid(4칸+) 이면 emit True
      const flushRun = (): boolean => {
        if (run.length >= 4) {
          push({
            id: nid(),
            kind: "char_grid",
            addr: run.map((c) => `t${ti}.r${ri}.c${c.ci}`),
            boxes: run.length,
            label_left: leftLabel(grid, ri, run[0]),
            label_above: aboveLabel(grid, ri, run[0]),
          });
          return true;
        }
        return false;
      };

      for (const c of row) {
        if (c.ghost) continue;
        const txt = cellText(c.el);

        if (txt === "") {
          run.push(c);
          continue;
        }
        if (txt === "-" && run.length) {
          // 주민번호 하이픈: 격자를 앞/뒤로 끊음
          flushRun();
          run = [];
          continue;
        }
        if (run.length && !flushRun()) {
          for (const x of run) {
            push({
              id: nid(),
              kind: "text",
              addr: `t${ti}.r${ri}.c${x.ci}`,
              label_left: leftLabel(grid, ri, x),
              label_above: aboveLabel(grid, ri, x),
            });
          }
        }
        run = [];

        // (b) 체크박스: 셀 안의 □ 각각을 옵션으로
        if (txt.includes("□")) {
          const opts = txt
            .split("□")
            .slice(1)
            .map((o) => o.trim().slice(0, 24));
          push({
            id: nid(),
            kind: "checkbox_group",
            addr: `t${ti}.r${ri}.c${c.ci}`,
            options: opts,
            label_left: leftLabel(grid, ri, c),
            label_above: aboveLabel(grid, ri, c),
          });
        }
        // (c) 밑줄 탭 빈칸
        let cellHadUnderline = false;
        const paras = childElems(c.el, "p");
        for (let pi = 0; pi < paras.length; pi++) {
          const p = paras[pi];
          let ublanks = 0;
          for (const r of descElems(p, "r")) {
            const rpr = childElem(r, "rPr");
            const hasU = rpr ? childElem(rpr, "u") !== null : false;
            const hasTab = childElem(r, "tab") !== null;
            if (rpr && hasU && hasTab) ublanks += 1;
          }
          if (ublanks) {
            cellHadUnderline = true;
            let ptxt = "";
            for (const t of descElems(p, "t")) ptxt += t.textContent ?? "";
            push({
              id: nid(),
              kind: "underline_blank",
              addr: `t${ti}.r${ri}.c${c.ci}.p${pi}`,
              blanks: ublanks,
              line_text: ptxt.trim().slice(0, 40),
              label_above: aboveLabel(grid, ri, c),
            });
          }
        }
        // (d) 앵커 / 날짜 — 오탐 필터 + 날짜 서브분할
        //   진짜 앵커 셀 = 강한 마커(관계:/은행명 등) 또는 '채울 빈칸 + 날짜단위'.
        //   프로즈·라벨(학년도/시작일/생년월일/…1년 보존기간 등)은 빈칸이 없어 제외.
        if (!txt.includes("□") && txt.length < 60) {
          const strong = /관계\s*:|인증번호\s*:|확인번호\s*:|\(은행명\)|@/.test(txt);
          const hasSign = /서명|\(인\)/.test(txt);
          const dateUnits = (["년", "월", "일"] as const).filter((u) =>
            txt.includes(u)
          );
          const isDate =
            dateUnits.length > 0 && cellHasBlank(c.el) && !cellHadUnderline;

          if (isDate) {
            // 날짜 서브분할: 년/월/일 각각을 독립 슬롯으로 (값은 각 단위 앞에 삽입)
            for (const u of dateUnits) {
              push({
                id: nid(),
                kind: "date_part",
                addr: `t${ti}.r${ri}.c${c.ci}`,
                unit: u === "년" ? "year" : u === "월" ? "month" : "day",
                template: txt.slice(0, 40),
                label_left: leftLabel(grid, ri, c),
                label_above: aboveLabel(grid, ri, c),
              });
            }
            if (hasSign) {
              push({
                id: nid(),
                kind: "anchor_split",
                addr: `t${ti}.r${ri}.c${c.ci}`,
                template: txt.slice(0, 60),
                label_left: leftLabel(grid, ri, c),
              });
            }
          } else if (strong || hasSign) {
            push({
              id: nid(),
              kind: "anchor_split",
              addr: `t${ti}.r${ri}.c${c.ci}`,
              template: txt.slice(0, 60),
              label_left: leftLabel(grid, ri, c),
            });
          }
        }
      }
      if (run.length && !flushRun()) {
        for (const x of run) {
          push({
            id: nid(),
            kind: "text",
            addr: `t${ti}.r${ri}.c${x.ci}`,
            label_left: leftLabel(grid, ri, x),
            label_above: aboveLabel(grid, ri, x),
          });
        }
      }
    }
  }
  return slots;
}

/** document.xml 문자열 → 슬롯 목록 */
export function detectSlotsXml(xml: string): SlotV2[] {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const body = doc.getElementsByTagName(tag("body"))[0] as unknown as
    | El
    | undefined;
  if (!body) return [];
  // 최상위 표만: body 의 직속 자식 w:tbl
  const tbls = childElems(body, "tbl");
  return detect(tbls);
}

/** docx 버퍼 → 슬롯 목록 */
export function detectDocxSlots(buf: Buffer): SlotV2[] {
  const zip = new PizZip(buf);
  const f = zip.file("word/document.xml");
  if (!f) throw new Error("올바른 .docx 가 아닙니다 (word/document.xml 없음).");
  return detectSlotsXml(f.asText());
}
