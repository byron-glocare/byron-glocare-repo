import type { VisaType } from "./types";

/**
 * ⚠️ 아래는 UI 확인용 "예시(샘플) 데이터" 입니다 — 실제 발급 요건과 다를 수 있습니다.
 *
 * 정본(진짜 데이터)은 사용자가 docs/visa requirement 폴더에 넣는 자료를 파싱해
 * 이 배열을 통째로 교체하는 방식으로 채웁니다. (scripts/import-visas.mjs 참고)
 *
 * 화면에는 이 상태를 알리는 배너가 노출됩니다 (IS_SAMPLE_DATA).
 */
export const IS_SAMPLE_DATA = true;

export const VISAS: VisaType[] = [
  {
    code: "D-2",
    nameKo: "유학",
    nameEn: "Student",
    category: "유학·연수",
    summary: "전문대·대학·대학원 등 정규 교육과정 유학",
    purpose:
      "국내 전문대학 이상의 교육기관 또는 학술연구기관에서 정규과정(학위) 교육을 받거나 특정 연구를 하려는 사람.",
    eligibility: [
      "국내 대학(원)의 정식 입학허가를 받은 사람",
      "학비 및 체류비 조달 능력 증빙 가능",
      "학업을 수행할 수 있는 어학 능력(TOPIK 등, 학교 기준에 따름)",
    ],
    requiredDocuments: [
      "사증발급인정신청서 / 여권 / 표준규격 사진",
      "입학허가서(표준입학허가서)",
      "최종학력 증명서",
      "재정능력 입증서류(은행 잔고증명 등)",
      "가족관계 증빙서류(국가별 상이)",
    ],
    duration: "2년(1회 부여, 학과 과정에 따라 상이)",
    extendable: true,
    procedure: [
      "대학으로부터 표준입학허가서 발급",
      "본국 소재 대한민국 공관에 사증(비자) 신청 또는 국내 대학이 사증발급인정서 대리 신청",
      "입국 후 90일 이내 외국인등록",
    ],
    workAllowed: "시간제취업(체류자격 외 활동 허가) 요건 충족 시 제한적 아르바이트 가능",
    fee: "사증 수수료·외국인등록 수수료 별도(공관/체류자격별 상이)",
    notes: [
      "출석률·학점 미달 시 연장 제한",
      "학교 변경·과정 변경 시 별도 신고 필요",
    ],
    source: "예시 데이터 — Hi Korea / 법무부 출입국·외국인정책본부 기준으로 교체 예정",
    updatedAt: "샘플",
  },
  {
    code: "D-4",
    nameKo: "일반연수",
    nameEn: "General Training",
    category: "유학·연수",
    summary: "어학연수·기술연수 등 비학위 연수",
    purpose:
      "대학 부설 어학원의 연수, 초·중·고 유학, 기타 기관에서의 연수 등 학위과정이 아닌 교육·연수.",
    eligibility: [
      "연수기관의 입학/등록 허가",
      "연수비 및 체류비 조달 능력",
    ],
    requiredDocuments: [
      "사증발급인정신청서 / 여권 / 사진",
      "연수기관 등록증명·입학허가서",
      "재정능력 입증서류",
    ],
    duration: "6개월~1년(1회 부여, 연수과정에 따라 상이)",
    extendable: true,
    procedure: [
      "연수기관 등록 및 허가서 수령",
      "공관 사증 신청 또는 사증발급인정서 대리 신청",
      "입국 후 외국인등록",
    ],
    workAllowed: "원칙적으로 취업 불가(요건 충족 시 제한적 시간제취업)",
    notes: ["어학연수는 출석률 관리가 연장 심사에 중요"],
    source: "예시 데이터 — 교체 예정",
    updatedAt: "샘플",
  },
  {
    code: "E-7-2",
    nameKo: "특정활동(준전문·서비스 등)",
    nameEn: "Designated Activities",
    category: "취업",
    summary: "지정된 준전문·숙련 직종 취업(요양·간병 관련 직종 포함)",
    purpose:
      "법무부장관이 지정한 특정 직종에 종사하기 위한 체류자격. 직종별로 요구 학력·경력·자격이 다르다.",
    eligibility: [
      "고용주(국내 기관)와의 고용계약",
      "해당 직종의 학력/경력/자격 요건 충족",
      "직종별 도입 쿼터 및 국민고용 보호 요건 충족",
    ],
    requiredDocuments: [
      "사증발급인정신청서 / 여권 / 사진",
      "고용계약서",
      "학위·경력·자격 증빙서류",
      "고용주 사업자등록증 등 사업체 증빙",
    ],
    duration: "직종·계약에 따라 상이(통상 1~3년, 연장 가능)",
    extendable: true,
    procedure: [
      "국내 고용주가 사증발급인정서 신청",
      "인정서 발급 후 본국 공관에서 사증 발급",
      "입국 후 외국인등록",
    ],
    workAllowed: "허가된 직종·근무처에 한함(근무처 변경 시 허가 필요)",
    notes: [
      "요양보호·간병 관련 취업 경로는 직종 코드·자격요건 확인 필수",
      "직종별 세부 요건은 매년 개정되므로 최신 고시 확인",
    ],
    nationalityNotes: [
      { nationality: "전체", note: "직종별 도입 허용 국가·쿼터가 별도로 지정될 수 있음" },
    ],
    source: "예시 데이터 — 교체 예정",
    updatedAt: "샘플",
  },
  {
    code: "E-9",
    nameKo: "비전문취업",
    nameEn: "Non-professional Employment",
    category: "취업",
    summary: "고용허가제(EPS)를 통한 비전문 인력 취업",
    purpose:
      "고용허가제 대상 업종(제조·농축산·어업 등)에 종사하기 위한 체류자격. 송출국가와의 MOU 및 EPS 절차를 따른다.",
    eligibility: [
      "한국어능력시험(EPS-TOPIK) 등 EPS 요건 통과",
      "송출국가 절차에 따른 구직 등록 및 사업주 선발",
    ],
    requiredDocuments: [
      "표준근로계약서",
      "고용허가서",
      "여권 / 사진 / 사증발급인정 관련 서류",
    ],
    duration: "최초 취업활동 기간 내(연장·재입국 특례 별도)",
    extendable: true,
    procedure: [
      "송출국가에서 EPS 절차(시험·구직등록) 진행",
      "국내 사업주 고용허가 및 근로계약",
      "사증발급인정 → 입국 → 외국인등록",
    ],
    workAllowed: "허가된 사업장에 한함",
    nationalityNotes: [
      { nationality: "베트남", note: "EPS 송출대상 국가 — 한국산업인력공단 절차 적용" },
    ],
    source: "예시 데이터 — 교체 예정",
    updatedAt: "샘플",
  },
  {
    code: "F-4",
    nameKo: "재외동포",
    nameEn: "Overseas Korean",
    category: "거주·동포",
    summary: "외국국적동포에 대한 체류자격",
    purpose: "대한민국 국적을 보유했던 사람 또는 그 직계비속으로서 외국국적을 취득한 동포.",
    eligibility: [
      "재외동포 자격 증빙(과거 국적/직계존비속 관계 등)",
      "단순노무 등 제한 직종에 종사하지 않을 것",
    ],
    requiredDocuments: [
      "여권 / 사진 / 신청서",
      "동포 입증서류(제적등본·가족관계 등)",
      "범죄경력증명서 등(요건에 따라)",
    ],
    duration: "3년(1회 부여, 연장 가능)",
    extendable: true,
    procedure: ["공관 사증 신청 또는 국내 자격변경", "입국 후 외국인등록"],
    workAllowed: "일부 제한 직종을 제외하고 비교적 자유로운 취업 활동",
    source: "예시 데이터 — 교체 예정",
    updatedAt: "샘플",
  },
  {
    code: "F-6",
    nameKo: "결혼이민",
    nameEn: "Marriage Migrant",
    category: "결혼이민",
    summary: "국민의 배우자 등 결혼이민자",
    purpose: "대한민국 국민과 혼인한 배우자 또는 그에 준하는 사람.",
    eligibility: [
      "국민과의 유효한 혼인관계 증빙",
      "소득요건 등 초청자 요건 충족",
      "기초 한국어 능력(요건에 따라)",
    ],
    requiredDocuments: [
      "혼인관계 증명서류",
      "초청자 소득·재정 증빙",
      "여권 / 사진 / 신청서",
    ],
    duration: "1~3년(1회 부여, 연장 가능)",
    extendable: true,
    procedure: ["공관 사증 신청(결혼이민 사전 절차 포함)", "입국 후 외국인등록"],
    workAllowed: "취업활동 제한 없음",
    source: "예시 데이터 — 교체 예정",
    updatedAt: "샘플",
  },
  {
    code: "D-10",
    nameKo: "구직",
    nameEn: "Job Seeking",
    category: "구직·기타",
    summary: "국내 취업(E계열 등)을 위한 구직·연수 활동",
    purpose: "전문 인력 취업을 준비하기 위한 구직활동 또는 기업 인턴 등.",
    eligibility: [
      "일정 학력·경력 또는 점수제 요건 충족",
      "구직활동 계획 및 체류비 조달 능력",
    ],
    requiredDocuments: [
      "여권 / 사진 / 신청서",
      "학위·경력 증빙",
      "구직활동 계획서 / 재정능력 입증서류",
    ],
    duration: "6개월(연장 시 최대 기간 제한)",
    extendable: true,
    procedure: ["공관 사증 신청 또는 국내 자격변경", "입국 후 외국인등록"],
    workAllowed: "원칙적으로 취업 불가(인턴 등 허가된 활동 제외)",
    source: "예시 데이터 — 교체 예정",
    updatedAt: "샘플",
  },
  {
    code: "C-3",
    nameKo: "단기방문",
    nameEn: "Short-term Visit",
    category: "방문·단기",
    summary: "관광·방문·단기상용 등 90일 이하 단기 체류",
    purpose: "관광, 친지 방문, 단기 상용(회의·시장조사 등), 단기 일반 목적의 방문.",
    eligibility: [
      "방문 목적 및 일정의 명확성",
      "체류비 조달 능력 및 귀국 의사 증빙",
    ],
    requiredDocuments: [
      "여권 / 사진 / 신청서",
      "재직/재정 증빙",
      "초청장·일정표(해당 시)",
    ],
    duration: "90일 이하(연장 원칙적으로 불가)",
    extendable: false,
    procedure: ["본국 공관 사증 신청(또는 무사증/전자여행허가 대상 확인)"],
    workAllowed: "취업활동 불가",
    nationalityNotes: [
      { nationality: "전체", note: "무사증 입국 또는 K-ETA 대상 여부는 국적별로 상이" },
    ],
    source: "예시 데이터 — 교체 예정",
    updatedAt: "샘플",
  },
];
