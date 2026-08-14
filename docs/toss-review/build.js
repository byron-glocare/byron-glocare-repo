/**
 * 카드사 심사용 "결제경로" PPT 조립.
 *
 *   node docs/toss-review/build.js
 *
 * shots/<key>.png 가 있으면 그 캡처를 넣고, 없으면 "무엇을 어떻게 찍어야 하는지"를
 * 적은 자리표시자를 넣는다. 캡처를 채워 넣고 다시 돌리면 최종본이 나온다.
 *
 * 토스 가이드(홈페이지 결제경로 제작 가이드, 2024-07-01) 기준:
 *   ① 가맹점 정보 표지  ② 하단정보  ③ 환불규정  ④ 로그인/회원가입
 *   ⑤ 상품선택·구매과정  ⑥ 카드 결제경로
 * 캡처 규칙: 북마크바 없이 · 도메인 보이게 · PC 시계 함께.
 */

const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");
const { buildPptx, EMU_PER_IN, SLIDE_W } = require("./pptx");

const IN = (v) => Math.round(v * EMU_PER_IN);
const SHOTS = path.join(__dirname, "shots");
const OUT = path.join(__dirname, "결제경로_글로케어.pptx");

const BLUE = "3D6BFF";
const INK = "1A1D21";
const GRAY = "5B6472";
const RED = "D93B3B";
const BOX = "F3F5F8";

// 사업자 정보 — apps/abroad/src/lib/company.ts 와 같은 값이어야 한다.
const COMPANY = {
  name: "주식회사 글로케어 (Glocare Corp.)",
  ceo: "홍강식",
  businessNo: "239-87-03310",
  mailOrderNo: "", // 신고 진행 중 — 채워야 심사 통과
  address: "서울특별시 광진구 능동로 120, 2층 202호 창의관(화양동, 건국대학교)",
  tel: "02-456-0724",
  url: "https://www.youstudyinkorea.com",
  mid: "youstunjcw",
};

// 테스트 계정 — 만들고 나면 여기 채운다(표지에 반드시 들어가야 함).
const TEST_ACCOUNT = {
  id: process.env.TOSS_TEST_ID || "",
  pw: process.env.TOSS_TEST_PW || "",
};

/** ②~⑥ 슬라이드 정의. key = shots/<key>.png */
const SLIDES = [
  {
    key: "02_footer",
    label: "② 하단 정보 캡처",
    desc: "필수 구성 항목 : (1) 상호명 / (2) 대표자명 / (3) 사업자등록번호 / (4) 통신판매업신고번호 / (5) 사업장주소 / (6) 유선전화번호",
    url: `${COMPANY.url}/  (페이지 맨 아래 사업자 정보 영역)`,
    checks: [
      "사업자등록증과 같은 값이 모두 보일 것",
      "통신판매업신고번호는 '준비 중'으로 표시 — 구매안전서비스 이용확인증 발급 후 신고 예정",
    ],
  },
  {
    key: "03_refund",
    label: "③ 환불규정 캡처 (무형상품)",
    desc: "취소·환불 규정 전문이 보이도록 캡처합니다. 서비스 진행 단계별 환불 비율이 명시되어야 합니다.",
    url: `${COMPANY.url}/refund`,
    checks: ["환불 기준·비율·청약철회 조항이 화면에 보일 것"],
  },
  {
    key: "04_login",
    label: "④ 로그인 / 회원가입 캡처",
    desc: "구매에 사용하는 로그인 경로를 캡처합니다. 이메일·비밀번호 로그인과 회원가입 진입이 함께 보이면 됩니다.",
    url: `${COMPANY.url}/student/login`,
    checks: ["표지에 적은 테스트 계정으로 실제 로그인되는 화면일 것"],
  },
  {
    key: "05a_products",
    label: "⑤ 상품 선택 / 구매과정 캡처 (1/3)",
    desc: "판매 상품 목록. 상품명·금액·서비스 제공기간이 함께 보여야 합니다.",
    url: `${COMPANY.url}/service`,
    checks: [
      "금액이 '금액 준비 중'이 아니라 실제 숫자로 보일 것 (SQL 0050 실행 필요)",
    ],
  },
  {
    key: "05b_detail",
    label: "⑤ 상품 선택 / 구매과정 캡처 (2/3)",
    desc: "상품 상세. 명칭·상세설명·금액·제공기간·환불 안내가 한 화면에 보여야 합니다.",
    url: `${COMPANY.url}/service/full-consulting`,
    checks: ["단건 최고가 상품(유학 준비 종합 컨설팅, 600,000원) 기준으로 캡처"],
  },
  {
    key: "05c_order",
    label: "⑤ 상품 선택 / 구매과정 캡처 (3/3)",
    desc: "주문서. 주문 상품·결제 금액·주문자 정보·판매자 정보·결제수단 선택·약관 동의가 한 화면에 보여야 합니다.",
    url: `${COMPANY.url}/student/order/full-consulting`,
    checks: ["로그인 상태에서 접근", "결제수단(신용/체크카드) 선택 영역이 보일 것"],
  },
  {
    key: "06_payment",
    label: "⑥ 카드 결제경로 캡처",
    desc: "[결제하기]를 눌러 뜬 카드 결제창. 결제 금액과 상품명이 창 안에 함께 보여야 합니다. 테스트용 결제창으로 캡처해도 심사가 가능합니다.",
    url: "주문서 → [결제하기] → 토스 결제창",
    checks: [
      "결제창 안에 금액·상품명이 보일 것",
      "카드사 선택 + 약관 전체 동의 화면까지 캡처",
    ],
  },
];

/** 상단 라벨 띠 + 설명문. */
function header(label, desc) {
  return [
    {
      x: IN(3.9),
      y: IN(0.2),
      w: IN(5.53),
      h: IN(0.46),
      fill: BLUE,
      align: "ctr",
      anchor: "ctr",
      text: [{ t: label, size: 1600, bold: true, color: "FFFFFF" }],
    },
    {
      x: IN(0.6),
      y: IN(0.74),
      w: IN(12.13),
      h: IN(0.62),
      align: "ctr",
      anchor: "ctr",
      text: [{ t: desc, size: 1100, color: GRAY }],
    },
  ];
}

/** 캡처가 아직 없을 때의 자리표시자. */
function placeholder(s) {
  const lines = [
    { t: "캡처 필요", size: 2000, bold: true, color: RED },
    { t: "", size: 800 },
    { t: `주소 : ${s.url}`, size: 1300, color: INK },
    { t: "", size: 600 },
    ...s.checks.map((c) => ({ t: `· ${c}`, size: 1200, color: GRAY })),
    { t: "", size: 800 },
    {
      t: "공통 규칙 : 북마크바 숨김 · 주소창에 도메인 노출 · 작업표시줄 시계 함께",
      size: 1100,
      color: GRAY,
    },
    {
      t: `파일 저장 위치 : docs/toss-review/shots/${s.key}.png`,
      size: 1100,
      color: GRAY,
    },
  ];
  return {
    x: IN(0.7),
    y: IN(1.42),
    w: IN(11.93),
    h: IN(5.7),
    fill: BOX,
    line: "C9CED6",
    align: "ctr",
    anchor: "ctr",
    text: lines.map((l) => ({ ...l, align: "ctr" })),
  };
}

/** 이미지를 콘텐츠 영역에 contain 으로 앉힌다. */
async function fitImage(file) {
  const buf = fs.readFileSync(file);
  const m = await sharp(buf).metadata();
  const boxX = IN(0.7);
  const boxY = IN(1.42);
  const boxW = IN(11.93);
  const boxH = IN(5.7);
  const scale = Math.min(boxW / m.width, boxH / m.height);
  const w = Math.round(m.width * scale);
  const h = Math.round(m.height * scale);
  return {
    buf,
    w,
    h,
    x: boxX + Math.round((boxW - w) / 2),
    y: boxY + Math.round((boxH - h) / 2),
  };
}

function coverSlide() {
  const row = (k, v, color = INK) => ({
    runs: [
      { t: `${k}  `, size: 1500, bold: true, color: BLUE },
      { t: v, size: 1500, color },
    ],
  });
  // 통신판매업신고번호는 순서상 뒤에 온다 — PG 심사 통과 → 구매안전서비스
  // 이용확인증 발급 → 구청 신고. 그래서 결격이 아니라 진행 상태로 적는다.
  const mail = COMPANY.mailOrderNo || "신고 예정 (구매안전서비스 이용확인증 발급 후 신고)";
  const mailColor = COMPANY.mailOrderNo ? INK : GRAY;
  const missing = (v, what) => (v ? [v, INK] : [`(${what} 발급 후 기재)`, RED]);
  const [tid, tidWarn] = missing(TEST_ACCOUNT.id, "테스트 계정 ID");
  const [tpw, tpwWarn] = missing(TEST_ACCOUNT.pw, "테스트 계정 PW");

  return {
    shapes: [
      {
        x: IN(0.9),
        y: IN(0.7),
        w: IN(11.5),
        h: IN(1.1),
        align: "l",
        text: [
          { t: "결제경로", size: 4000, bold: true, color: INK },
          { t: "카드사 심사 제출용 · 홈페이지 결제경로", size: 1400, color: GRAY },
        ],
      },
      { x: IN(0.9), y: IN(1.92), w: IN(11.5), h: IN(0.04), fill: BLUE },
      {
        x: IN(0.9),
        y: IN(2.25),
        w: IN(11.5),
        h: IN(3.9),
        align: "l",
        text: [
          row("(1) 상호명", COMPANY.name),
          row("(2) 사업자등록번호", COMPANY.businessNo),
          row("(3) 대표자명", COMPANY.ceo),
          row("(4) 통신판매업신고번호", mail, mailColor),
          row("(5) 사업장주소", COMPANY.address),
          row("(6) 유선전화번호", COMPANY.tel),
          row("(7) 가맹점 URL", COMPANY.url),
          row("(8) 상점아이디(MID)", COMPANY.mid),
          row("(9) Test ID", tid, tidWarn),
          row("(10) Test PW", tpw, tpwWarn),
        ].map((r) => ({ ...r, spaceBefore: 600 })),
      },
      {
        x: IN(0.9),
        y: IN(6.35),
        w: IN(11.5),
        h: IN(0.5),
        align: "l",
        text: [
          {
            t: "판매 상품 : 서류 발급 풀세트 150,000원 / 유학 준비 종합 컨설팅 600,000원 (부가세 포함, 무형 용역)",
            size: 1100,
            color: GRAY,
          },
        ],
      },
    ],
  };
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const slides = [coverSlide()];
  const missing = [];

  for (const s of SLIDES) {
    const shapes = header(s.label, s.desc);
    const file = path.join(SHOTS, `${s.key}.png`);
    if (fs.existsSync(file)) {
      slides.push({ shapes, image: await fitImage(file) });
      console.log(`  o ${s.key}`);
    } else {
      shapes.push(placeholder(s));
      slides.push({ shapes });
      missing.push(s.key);
      console.log(`  - ${s.key}  (캡처 없음 → 자리표시자)`);
    }
  }

  const buf = await buildPptx(slides, { title: "결제경로 - 주식회사 글로케어" });
  fs.writeFileSync(OUT, buf);
  console.log(`\n${OUT}  (${slides.length}장, ${(buf.length / 1024).toFixed(0)}KB)`);
  if (missing.length) console.log(`캡처 대기 : ${missing.join(", ")}`);
})();
