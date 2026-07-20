/**
 * 유학센터 담당자용 가이드 docx 빌더.
 *   화면 = 베트남어(현지 담당자가 보는 그대로) / 설명 = 한국어(추후 베트남어로 교체)
 *
 * 주의(과거 확립):
 *   - ImageRun 에 outline 넣으면 MS Word 가 파일을 못 엶 → 절대 금지
 *   - Table 은 width + columnWidths + FIXED + 셀 width 전부 지정 (아니면 Word 에서 접힘)
 *   - 번호목록은 절차마다 새 reference (아니면 문서 전체 누적)
 *   - 세로가 콘텐츠폭의 1.2배 초과 시 분할 삽입 (축소하면 글씨가 안 보임)
 */
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");
const {
  Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, TableLayoutType, AlignmentType,
  BorderStyle, ShadingType, PageBreak, TableOfContents, Header, Footer, PageNumber,
} = require("docx");

const SHOTS = path.join(__dirname, "shots");
const FONT = "맑은 고딕";

// A4 11906 twips - 좌우여백 640*2 = 콘텐츠 10626 twips ≈ 708 px(96dpi)
const MARGIN = 640;
const CONTENT_TWIP = 11906 - MARGIN * 2;
const CONTENT_PX = Math.round(CONTENT_TWIP / 15);   // ≈708
const SPLIT_RATIO = 1.2;                             // 이 비율 넘으면 분할
const PIECE_RATIO = 1.05;                            // 조각당 최대 비율
const OVERLAP = 0.04;                                // 조각 간 4% 겹침

let numCounter = 0;
const numbering = { config: [] };
function newNum() {
  const ref = `list${++numCounter}`;
  numbering.config.push({
    reference: ref,
    levels: [{
      level: 0, format: "decimal", text: "%1.", alignment: AlignmentType.START,
      style: { paragraph: { indent: { left: 360, hanging: 260 } } },
    }],
  });
  return ref;
}

// ── 언어 스위치 ────────────────────────────────────────────────
//   LANG_OUT=vi 로 실행하면 vi.json 사전으로 표시 텍스트를 베트남어로 바꾼다.
//   모든 표시 문자열이 T() 를 거치므로 여기 한 곳에서 번역하면 문서 전체가 바뀐다.
//   (스크린샷은 원래 베트남어 화면이라 그대로 사용)
const LANG = process.env.LANG_OUT === "vi" ? "vi" : "ko";
const DICT =
  LANG === "vi" && fs.existsSync(path.join(__dirname, "vi.json"))
    ? JSON.parse(fs.readFileSync(path.join(__dirname, "vi.json"), "utf8"))
    : null;
const missing = new Set();
function tr(s) {
  if (!DICT || typeof s !== "string" || !s.trim()) return s;
  if (DICT[s]) return DICT[s];
  if (/[가-힣]/.test(s)) missing.add(s);
  return s;
}

const T = (text, o = {}) => new TextRun({ text: tr(text), font: FONT, size: o.size ?? 20, bold: o.bold, italics: o.italics, color: o.color });
const P = (text, o = {}) => new Paragraph({
  children: Array.isArray(text) ? text : [T(text, o)],
  spacing: { before: o.before ?? 60, after: o.after ?? 60, line: 300 },
  alignment: o.align,
});
const H = (text, level) => new Paragraph({
  children: [T(text, { bold: true, size: level === 1 ? 32 : level === 2 ? 26 : 22 })],
  heading: level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
  spacing: { before: level === 1 ? 320 : 240, after: 120 },
  pageBreakBefore: level === 1,
});
function steps(items) {
  const ref = newNum();
  return items.map((t) => new Paragraph({
    children: [T(t)], numbering: { reference: ref, level: 0 },
    spacing: { before: 40, after: 40, line: 300 },
  }));
}
/** 안내/주의 박스 */
function note(title, body, color) {
  return new Table({
    width: { size: CONTENT_TWIP, type: WidthType.DXA },
    columnWidths: [CONTENT_TWIP],
    layout: TableLayoutType.FIXED,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 6, color },
      bottom: { style: BorderStyle.SINGLE, size: 6, color },
      left: { style: BorderStyle.SINGLE, size: 18, color },
      right: { style: BorderStyle.SINGLE, size: 6, color },
      insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE },
    },
    rows: [new TableRow({
      children: [new TableCell({
        width: { size: CONTENT_TWIP, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: "F8FAFC" },
        margins: { top: 120, bottom: 120, left: 160, right: 160 },
        children: [
          new Paragraph({ children: [T(title, { bold: true, size: 19, color })], spacing: { after: 40 } }),
          ...body.map((b) => new Paragraph({ children: [T(b, { size: 19 })], spacing: { after: 30, line: 280 } })),
        ],
      })],
    })],
  });
}
/** 표 (반드시 너비 명시 — Word 접힘 방지) */
function table(headers, rows, widths) {
  const total = widths.reduce((a, b) => a + b, 0);
  const cols = widths.map((w) => Math.round((w / total) * CONTENT_TWIP));
  return new Table({
    width: { size: CONTENT_TWIP, type: WidthType.DXA },
    columnWidths: cols,
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map((h, i) => new TableCell({
          width: { size: cols[i], type: WidthType.DXA },
          shading: { type: ShadingType.CLEAR, fill: "EEF2F7" },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({ children: [T(String(h), { size: 19, bold: true })], spacing: { line: 260 } })],
        })),
      }),
      ...rows.map((r) => new TableRow({
        children: r.map((v, i) => new TableCell({
          width: { size: cols[i], type: WidthType.DXA },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({ children: [T(String(v), { size: 19 })], spacing: { line: 260 } })],
        })),
      })),
    ],
  });
}

/** 이미지 삽입 — 폭 맞춤 + 1.2배 초과 시 분할 (outline 금지) */
async function image(name, caption) {
  const file = path.join(SHOTS, `${name}.png`);
  if (!fs.existsSync(file)) return [P(`[스크린샷 없음: ${name}]`, { color: "CC0000" })];
  const meta = await sharp(file).metadata();
  const ratio = meta.height / meta.width;
  const out = [];

  if (ratio <= SPLIT_RATIO) {
    const buf = fs.readFileSync(file);
    out.push(new Paragraph({
      children: [new ImageRun({ data: buf, type: "png",
        transformation: { width: CONTENT_PX, height: Math.round(CONTENT_PX * ratio) } })],
      spacing: { before: 80, after: 40 }, alignment: AlignmentType.CENTER,
    }));
  } else {
    // 여러 조각으로 분할 (겹침 포함)
    const pieceH = Math.round(meta.width * PIECE_RATIO);
    const step = Math.round(pieceH * (1 - OVERLAP));
    const n = Math.ceil((meta.height - pieceH) / step) + 1;
    for (let i = 0; i < n; i++) {
      const top = Math.min(i * step, Math.max(0, meta.height - pieceH));
      const h = Math.min(pieceH, meta.height - top);
      const buf = await sharp(file).extract({ left: 0, top, width: meta.width, height: h }).png().toBuffer();
      out.push(new Paragraph({
        children: [new ImageRun({ data: buf, type: "png",
          transformation: { width: CONTENT_PX, height: Math.round(CONTENT_PX * (h / meta.width)) } })],
        spacing: { before: 80, after: 20 }, alignment: AlignmentType.CENTER,
      }));
      if (i < n - 1) out.push(new Paragraph({
        children: [T("⌄ " + tr("아래로 이어짐"), { size: 17, color: "8A94A6", italics: true })],
        alignment: AlignmentType.CENTER, spacing: { after: 60 },
      }));
    }
  }
  // 캡션은 접두사(▲) 를 붙이기 전에 번역해야 사전 키와 일치한다
  if (caption) out.push(new Paragraph({
    children: [T(`▲ ${tr(caption)}`, { size: 17, color: "6B7280" })],
    alignment: AlignmentType.CENTER, spacing: { after: 160 },
  }));
  return out;
}

(async () => {
  const c = [];

  // ── 표지 ─────────────────────────────────────────────
  c.push(new Paragraph({ children: [T("GLOCARE", { bold: true, size: 56, color: "0F766E" })], alignment: AlignmentType.CENTER, spacing: { before: 2400, after: 80 } }));
  c.push(new Paragraph({ children: [T("유학센터 담당자 가이드", { bold: true, size: 40 })], alignment: AlignmentType.CENTER, spacing: { after: 120 } }));
  c.push(new Paragraph({ children: [T("youstudyinkorea.com/center", { size: 22, color: "6B7280" })], alignment: AlignmentType.CENTER, spacing: { after: 800 } }));
  c.push(new Paragraph({ children: [T("학생 등록부터 대학 지원·서류 작성·최종 제출까지", { size: 22 })], alignment: AlignmentType.CENTER, spacing: { after: 40 } }));
  c.push(new Paragraph({ children: [T("화면은 베트남어 · 설명은 한국어", { size: 20, color: "6B7280" })], alignment: AlignmentType.CENTER }));
  c.push(new Paragraph({ children: [new PageBreak()] }));

  // 목차: TableOfContents 필드는 Word 가 열 때 '필드 업데이트' 대화상자를 띄워
  //   자동 변환(COM)이 멈춘다 → 정적 목록으로 대체.
  c.push(H("목차", 2));
  for (const [t, sub] of [
    ["1. 시작하기", ["1.1 로그인", "1.2 화면 언어 바꾸기"]],
    ["2. 대시보드 (첫 화면)", []],
    ["3. 학생 관리", ["3.1 학생 목록", "3.2 신규 학생 등록"]],
    ["4. 학생 상세 — 5단계로 진행합니다", [
      "4.1 ① 개요 — 진행 상황 확인",
      "4.2 ② 대학 선택 — 지원할 대학 등록",
      "4.3 ③ 서류 등록 — 발급 서류 업로드",
      "4.4 ④ 정보 입력 — 학생 정보 (가장 중요)",
      "      4.4.1 입력값과 최종값 — 베트남어 자동 번역",
      "      4.4.2 도구 — 학생에게 직접 입력 링크 보내기",
      "4.5 ⑤ 최종 서류 — 생성하고 제출하기",
      "4.6 AI 자기소개서",
    ]],
    ["5. 부록", ["5.1 권장 작업 순서", "5.2 자주 하는 실수", "5.3 문의"]],
  ]) {
    c.push(new Paragraph({ children: [T(t, { bold: true, size: 21 })], spacing: { before: 100, after: 20 } }));
    for (const s of sub) {
      c.push(new Paragraph({
        children: [T(s, { size: 19, color: "4B5563" })],
        indent: { left: 300 }, spacing: { after: 10, line: 260 },
      }));
    }
  }

  // ── 1. 시작하기 ──────────────────────────────────────
  c.push(H("1. 시작하기", 1));
  c.push(P("이 가이드는 유학센터 담당자가 학생을 등록하고, 한국 대학에 지원하고, 제출 서류를 완성하기까지의 전 과정을 다룹니다."));
  c.push(note("이 시스템으로 할 수 있는 일", [
    "· 학생 정보를 한 번만 입력하면 여러 대학 지원서에 자동으로 채워집니다.",
    "· 대학이 요구하는 서류를 자동으로 알려주고, 빠진 것을 표시합니다.",
    "· 입학원서·자기소개서 등 작성 서류를 시스템이 초안으로 만들어 줍니다.",
  ], "0F766E"));

  c.push(H("1.1 로그인", 2));
  c.push(P("글로케어에서 발급받은 유학센터 계정으로 로그인합니다."));
  c.push(...steps([
    "브라우저에서 youstudyinkorea.com/center 로 접속합니다.",
    "이메일과 비밀번호를 입력하고 [로그인]을 누릅니다.",
    "계정이 없거나 로그인이 안 되면 글로케어 담당자에게 문의하세요.",
  ]));
  c.push(...await image("c00_login", "로그인 화면"));

  c.push(H("1.2 화면 언어 바꾸기", 2));
  c.push(P("화면 오른쪽 위에서 베트남어(Tiếng Việt)와 한국어를 전환할 수 있습니다. 이 가이드의 화면은 모두 베트남어 기준입니다."));

  // ── 2. 대시보드 ──────────────────────────────────────
  c.push(H("2. 대시보드 (첫 화면)", 1));
  c.push(P("로그인하면 가장 먼저 보이는 화면입니다. 우리 센터의 전체 현황을 한눈에 확인합니다."));
  c.push(...await image("c10_dashboard", "대시보드 — 학생 수 · 진행 중인 지원 · 마감 임박"));
  c.push(table(
    ["항목", "의미", "해야 할 일"],
    [
      ["Sinh viên (학생)", "우리 센터가 등록한 전체 학생 수", "—"],
      ["Đơn đang xử lý (진행 중)", "현재 진행 중인 대학 지원 건수", "—"],
      ["Sắp đến hạn (마감 임박)", "7일 안에 마감이 있는 지원", "해당 학생을 우선 처리"],
      ["Cần bắt đầu chuẩn bị hồ sơ", "지금 서류 발급을 시작해야 하는 건", "학생에게 서류 발급 안내"],
    ],
    [26, 40, 34]
  ));
  c.push(note("마감 임박 · 서류 준비 알림이 가장 중요합니다", [
    "발급 서류(졸업증명서 등)는 기관에서 받는 데 시간이 걸립니다. '지금 시작해야 하는 건'에 숫자가 뜨면 바로 학생에게 연락하세요.",
  ], "B45309"));

  // ── 3. 학생 관리 ─────────────────────────────────────
  c.push(H("3. 학생 관리", 1));
  c.push(H("3.1 학생 목록", 2));
  c.push(P("왼쪽 메뉴 또는 대시보드의 [Sinh viên] 카드에서 들어갑니다. 같은 유학센터 소속이면 다른 담당자가 등록한 학생도 함께 보고 관리할 수 있습니다."));
  c.push(...await image("c20_students", "학생 목록"));

  c.push(H("3.2 신규 학생 등록", 2));
  c.push(...steps([
    "학생 목록 화면에서 [신규 학생 등록] 버튼을 누릅니다.",
    "이름은 필수입니다. 나머지(생년월일·여권번호·연락처 등)는 나중에 채워도 됩니다.",
    "[등록]을 누르면 학생 상세 화면으로 이동합니다.",
  ]));
  c.push(...await image("c21_student_new", "신규 학생 등록 화면"));
  c.push(note("이름은 여권과 똑같이", [
    "여권에 적힌 영문 이름과 다르면 대학 제출 서류에서 문제가 될 수 있습니다.",
  ], "B45309"));

  // ── 4. 학생 상세 5단계 ───────────────────────────────
  c.push(H("4. 학생 상세 — 5단계로 진행합니다", 1));
  c.push(P("학생을 클릭하면 상세 화면이 열립니다. 위쪽에 5개의 단계 탭이 있고, 왼쪽부터 순서대로 진행하면 됩니다."));
  c.push(table(
    ["단계", "탭 이름 (베트남어)", "하는 일"],
    [
      ["1", "Tổng quan (개요)", "진행 상황 확인"],
      ["2", "Chọn trường (대학 선택)", "지원할 대학·학과·학기 등록"],
      ["3", "Tải giấy tờ (서류 등록)", "발급받은 서류 파일 업로드"],
      ["4", "Nhập thông tin (정보 입력)", "학생 정보 입력 (한 번만)"],
      ["5", "Hồ sơ cuối (최종 서류)", "작성 서류 생성 → 제출"],
    ],
    [10, 40, 50]
  ));

  c.push(H("4.1 ① 개요 — 진행 상황 확인", 2));
  c.push(P("학생의 현재 상태를 한눈에 봅니다. 기본 정보, 지원한 대학 목록, 정보 입력 완성도, 서류 준비 상태가 모두 표시됩니다."));
  c.push(...await image("c30_overview", "개요 — 지원 대학 2건 · 정보 입력 완성도 · 서류 상태"));
  c.push(note("여기서 무엇을 봐야 하나요?", [
    "· Thông tin trường (학교 정보): 지원한 대학과 다가오는 일정(마감일·면접일)",
    "· Thông tin chi tiết (상세 정보): 정보 입력이 몇 개 남았는지 (예: 34/38)",
    "· Hồ sơ (서류): 완료된 서류와 아직 정보가 부족한 서류",
  ], "0F766E"));

  c.push(H("4.2 ② 대학 선택 — 지원할 대학 등록", 2));
  c.push(P("학생이 지원할 대학·학과·학기를 등록합니다. 한 학생이 여러 대학에 지원할 수 있습니다."));
  c.push(...await image("c40_select", "대학 선택 — 등록된 지원 목록"));
  c.push(...steps([
    "[지원 추가] 버튼을 누릅니다.",
    "대학교와 학과, 모집 학기를 선택합니다.",
    "저장하면 그 대학이 요구하는 서류 목록이 자동으로 반영됩니다.",
  ]));
  c.push(...await image("c41_select_new", "지원 추가 — 대학·학과·학기 선택"));
  c.push(note("대학을 등록해야 서류 목록이 나옵니다", [
    "지원 대학을 먼저 등록해야 '어떤 서류가 필요한지'가 결정됩니다. 대학을 등록하지 않으면 서류 등록·정보 입력에서 무엇이 필요한지 알 수 없습니다.",
  ], "B45309"));

  c.push(H("4.3 ③ 서류 등록 — 발급 서류 업로드", 2));
  c.push(P("졸업증명서·성적증명서·가족관계증명서처럼 기관에서 발급받아야 하는 서류를 업로드합니다. 지원한 대학별로 섹션이 나뉘어 표시됩니다."));
  c.push(P("형식: PDF 또는 사진(JPG·PNG·HEIC) / 최대 20MB"));
  c.push(...await image("c50_documents", "서류 등록 — 대학별 필요 서류 목록과 업로드 상태"));
  c.push(note("같은 서류는 1번만 올리면 됩니다", [
    "여러 대학이 같은 서류를 요구하면 '공용 — 한 번만 업로드' 표시가 붙습니다. 한 번만 올리면 다른 대학에도 자동으로 등록됩니다.",
    "인증(공증·아포스티유) 조건이 다른 경우에만 따로 올리며, 이때는 [다른 대학 파일 가져오기] 버튼으로 복사할 수 있습니다.",
  ], "0F766E"));
  c.push(note("미리 발급 받은 서류가 있다면 올려주세요. 없다면 넘어가도 됩니다.", [
    "업로드한 서류에서 AI가 값을 추출해 정보를 자동으로 채워줍니다.",
  ], "0F766E"));

  c.push(H("4.4 ④ 정보 입력 — 학생 정보 (가장 중요)", 2));
  c.push(P("대학 지원서에 들어갈 학생 정보를 입력합니다. 한 번 입력하면 지원한 모든 대학의 서류에 재사용됩니다."));
  c.push(...await image("c60_data", "정보 입력 — 필수 항목 표시와 카테고리별 입력"));
  c.push(note("'필수(cần)' 표시부터 채우세요", [
    "지원한 대학의 서류가 실제로 요구하는 항목에 노란색 '필수(cần)' 표시가 붙습니다. 화면 위쪽에 몇 개가 남았는지 표시됩니다.",
    "[필요한 항목만 보기] / [전체 항목 보기] 로 목록을 좁히거나 넓힐 수 있습니다.",
  ], "0F766E"));

  c.push(H("4.4.1 번역 — [KR 번역] / [EN 번역] 버튼", 3));
  c.push(P("베트남어로 입력한 값을 한국어나 영문 표기로 바꿀 때 사용합니다. 입력칸 오른쪽의 버튼으로 처리되며, 칸의 값이 번역 결과로 바로 교체됩니다."));
    c.push(...await image("c62_translate", "입력칸 오른쪽의 [KR 번역] · [EN 번역] 버튼"));
  c.push(...steps([
    "입력칸에 값을 입력합니다. (베트남어·영어·한국어 모두 가능)",
    "한국어가 필요한 칸이면 [KR 번역], 영문 표기가 필요한 칸이면 [EN 번역]을 누릅니다.",
    "칸의 값이 번역 결과로 바뀌고, 아래에 번역 전 값이 작게 표시됩니다.",
    "마음에 들지 않으면 [되돌리기]로 원래 값으로 돌아갑니다.",
  ]));
  c.push(table(
    ["버튼", "용도", "예시"],
    [
      ["KR 번역", "한국어가 들어가야 하는 칸 (관계·직업·한국식 이름 등)", "father → 아버지 / nông dân → 농부 / Nguyễn Văn A → 응우옌 반 아"],
      ["EN 번역", "영문 표기가 필요한 칸 (학교·기관명, 영문 이름·주소)", "Trường THPT Chuyên Hà Nội → Hanoi High School for the Gifted"],
      ["되돌리기", "번역 전 원래 입력값으로 복구", "번역한 뒤에만 나타납니다"],
    ],
    [18, 36, 46]
  ));
  c.push(note("칸의 성격에 맞는 버튼을 고르세요", [
    "· '한국식 이름', '아버지 직업'처럼 한국어가 들어가야 하는 칸 → [KR 번역]",
    "· '출신 고등학교', '영문 이름'처럼 영문이 들어가야 하는 칸 → [EN 번역]",
    "· 한 번 번역한 뒤 다른 언어 버튼을 눌러 바꿀 수도 있고, [되돌리기]로 처음 입력값으로 돌아갈 수도 있습니다.",
  ], "0F766E"));
  c.push(note("번역한 값은 반드시 확인하세요", [
    "칸에 보이는 값이 그대로 서류에 들어갑니다. 번역 결과가 어색하면 칸을 직접 수정하면 됩니다.",
    "여권번호·전화번호·날짜 같은 숫자는 번역하지 않고 그대로 유지됩니다.",
  ], "B45309"));

  c.push(H("4.4.2 도구 — 학생에게 직접 입력 링크 보내기", 3));
  c.push(P("'도구(Công cụ)'를 펼치면 두 가지 기능이 있습니다."));
  c.push(...await image("c61_data_tools", "도구 — 외부 입력 링크 · 업로드 서류로 자동 채우기"));
  c.push(table(
    ["기능", "설명"],
    [
      ["외부 입력 링크", "학생에게 보낼 수 있는 링크를 만듭니다. 학생이 직접 자기 정보를 입력하고 서명까지 할 수 있습니다. (유효기간 지정)"],
      ["업로드 서류로 자동 채우기", "이미 올린 서류를 AI가 읽어 정보 입력 항목을 채웁니다. 적용 전에 확인할 수 있습니다."],
    ],
    [30, 70]
  ));

  c.push(H("4.5 ⑤ 최종 서류 — 생성하고 제출하기", 2));
  c.push(P("입학원서·자기소개서처럼 직접 작성해야 하는 서류를 시스템이 초안으로 만들어 줍니다."));
  c.push(...await image("c70_final", "최종 서류 — 작성 서류 생성 · 완성본 업로드 · 제출"));
  c.push(...steps([
    "[초안 생성·다운로드]를 눌러 정보가 채워진 파일을 받습니다.",
    "받은 파일에 서명하거나 손으로 보완합니다.",
    "[완성본 업로드]로 수정한 파일을 올립니다.",
    "[제출]을 누릅니다. 제출한 서류만 글로케어에서 확인할 수 있습니다.",
  ]));
  c.push(note("[제출]까지 눌러야 완료입니다", [
    "완성본을 올리기만 하고 [제출]을 누르지 않으면 글로케어 담당자에게 보이지 않습니다.",
  ], "B45309"));

  c.push(H("4.6 AI 자기소개서", 2));
  c.push(P("자기소개서·학업계획서처럼 글을 써야 하는 서류는 AI가 초안을 만들어 줍니다. 최종 서류 탭의 해당 서류 행에서 [AI 자기소개서 작성] 버튼으로 들어갑니다."));
  c.push(...await image("c80_essays", "AI 자기소개서 — 문항별 초안 생성·편집"));
  c.push(note("AI 초안은 반드시 검토하세요", [
    "학생의 실제 경험과 다른 내용이 들어갈 수 있습니다. 생성된 글을 학생과 함께 확인하고 수정하세요.",
    "'정보 입력'이 잘 채워져 있을수록 초안 품질이 좋아집니다.",
  ], "B45309"));

  // ── 5. 부록 ──────────────────────────────────────────
  c.push(H("5. 부록", 1));
  c.push(H("5.1 권장 작업 순서", 2));
  c.push(...steps([
    "학생 등록 (이름은 여권과 동일하게)",
    "대학 선택 — 지원할 대학·학과·학기 등록",
    "서류 등록 — 이미 발급받은 서류가 있으면 업로드",
    "정보 입력 — '필수' 항목부터 채우기",
    "최종 서류 — 초안 생성 → 서명 → 완성본 업로드 → 제출",
  ]));
  c.push(note("서류가 없으면 3번을 건너뛰고 4번부터 하세요", [
    "3번(서류 등록)은 이미 발급받은 서류가 있을 때만 하면 됩니다. 아직 없다면 건너뛰고 바로 4번(정보 입력)부터 채우는 것이 좋습니다.",
    "서류를 먼저 올리면 AI가 값을 추출해 4번을 자동으로 채워주므로, 서류가 있는 경우에는 3번을 먼저 하는 것이 빠릅니다.",
  ], "0F766E"));

  c.push(H("5.2 자주 하는 실수", 2));
  c.push(table(
    ["상황", "원인", "해결"],
    [
      ["필요한 서류가 안 보임", "지원 대학을 등록하지 않음", "② 대학 선택에서 먼저 지원을 등록"],
      ["같은 서류를 여러 번 올림", "'공용' 표시를 못 봄", "한 번만 올리면 자동 공유됨"],
      ["글로케어에서 서류가 안 보임", "[제출]을 누르지 않음", "⑤ 최종 서류에서 [제출] 클릭"],
      ["서류에 베트남어가 그대로 나옴", "최종값을 확인하지 않음", "④ 정보 입력에서 최종값 확인·수정"],
      ["마감이 임박했는데 서류가 없음", "발급 서류를 늦게 시작", "대시보드의 '준비 시작' 알림을 매일 확인"],
    ],
    [28, 30, 42]
  ));

  c.push(H("5.3 문의", 2));
  c.push(P("시스템 오류나 계정 문제는 글로케어 담당자에게 문의하세요. 화면을 캡처해 함께 보내주시면 빠르게 처리됩니다."));
  c.push(P([T("문의: ", {bold:true}), T("help@glocare.co.kr", {bold:true, color:"0F766E"})]));

  const doc = new Document({
    numbering,
    styles: {
      default: {
        document: { run: { font: FONT, size: 20 } },
        heading1: { run: { font: FONT, color: "0F766E" } },
        heading2: { run: { font: FONT, color: "134E4A" } },
        heading3: { run: { font: FONT, color: "134E4A" } },
      },
    },
    sections: [{
      properties: { page: { margin: { top: 900, bottom: 900, left: MARGIN, right: MARGIN } } },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ children: ["", PageNumber.CURRENT], font: FONT, size: 18, color: "9CA3AF" })],
          })],
        }),
      },
      children: c,
    }],
  });

  const outDir = path.join(__dirname, "out");
  fs.mkdirSync(outDir, { recursive: true });
  const buf = await Packer.toBuffer(doc);
  const dest = path.join(outDir, LANG === "vi" ? "guide_center_vi.docx" : "guide_center.docx");
  fs.writeFileSync(dest, buf);
  console.log(`✓ 생성(${LANG}):`, dest, (buf.length / 1024 / 1024).toFixed(1) + "MB");
  if (missing.size) {
    console.log(`⚠ 사전에 없어 한국어로 남은 문자열 ${missing.size}개:`);
    [...missing].slice(0, 15).forEach((s) => console.log("   -", s.slice(0, 70)));
  }
})();
