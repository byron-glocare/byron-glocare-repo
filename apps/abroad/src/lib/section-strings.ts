/**
 * 섹션별 정적 텍스트 — Apply 폼, Recruiting, Insurance 섹션 등
 * 원본 index.html data-vi/data-ko 1:1 매핑
 */
import type { Locale } from "@/lib/i18n";

const apply = {
  ko: {
    eyebrow: "유학 신청",
    titlePrefix: "지금 바로 ",
    titleEm: "시작하세요",
    titleSuffix: "",
    desc: "직접 준비하거나, 상담을 받고 함께 준비하세요. 두 가지 방법 모두 열려 있습니다.",
    selfTitle: "셀프 유학 지원하기",
    selfDesc:
      "대학 찾기부터 지원·서류 작성까지 직접 진행합니다. 발급 서류는 대행 신청할 수 있습니다.",
    selfCta: "셀프 유학 지원하기",
    consultTitle: "상담받고 유학하기",
    consultDesc: "담당자와 상담하고 유학센터와 함께 준비합니다.",
    formTitle: "무료 상담 신청",
    formSub: "아래 정보를 입력하시면 담당자가 빠르게 연락드립니다.",
    fName: "이름",
    fNamePh: "홍길동",
    fPhone: "연락처",
    fPhonePh: "010-xxxx-xxxx",
    fEmail: "이메일",
    fEmailPh: "이메일",
    fAge: "나이",
    fDept: "관심 학과",
    fDeptPh: "선택해주세요",
    deptOptions: [
      { value: "요양보호학과", label: "요양보호학과 / Chăm sóc người cao tuổi" },
      { value: "자동차학과", label: "자동차학과 / Kỹ thuật ô tô" },
      { value: "간호조무과", label: "간호조무과 / Y tá điều dưỡng" },
      { value: "호텔관광학과", label: "호텔관광학과 / Du lịch - Khách sạn" },
      { value: "식품조리학과", label: "식품조리학과 / Chế biến thực phẩm" },
      { value: "컴퓨터학과", label: "컴퓨터학과 / CNTT" },
      { value: "기타", label: "기타 / Khác" },
    ],
    fCenter: "거주 지역",
    fCenterPh: "거주 지역 선택",
    fMessage: "문의 사항 (선택사항)",
    fMessagePh: "궁금한 점을 자유롭게 적어주세요...",
    fRecruit: "리크루팅 프로그램도 참여하고 싶습니다 (친구 소개 혜택 받기)",
    fAgree: "개인정보 수집 및 이용에 동의합니다",
    submit: "상담 신청하기 →",
    fnote:
      "입력하신 정보는 상담 목적으로만 사용되며 외부에 공개되지 않습니다.",
    successEyebrow: "접수 완료",
    successTitle: "상담 신청이 정상 접수됐습니다",
    successDesc: "곧 담당자가 연락드리겠습니다.",
  },
  vi: {
    eyebrow: "Đăng ký du học",
    titlePrefix: "Bắt đầu hành trình của bạn ",
    titleEm: "ngay hôm nay",
    titleSuffix: "",
    desc:
      "Tự mình chuẩn bị, hoặc được tư vấn và chuẩn bị cùng chúng tôi — cả hai cách đều sẵn sàng.",
    selfTitle: "Tự đăng ký du học",
    selfDesc:
      "Bạn tự tìm trường, đăng ký và soạn hồ sơ. Giấy tờ cần xin cấp có thể đặt dịch vụ.",
    selfCta: "Tự đăng ký du học",
    consultTitle: "Du học cùng tư vấn viên",
    consultDesc: "Trao đổi với nhân viên tư vấn và chuẩn bị cùng trung tâm du học.",
    formTitle: "Đăng ký tư vấn miễn phí",
    formSub:
      "Điền thông tin bên dưới — nhân viên tư vấn sẽ liên hệ bạn sớm nhất.",
    fName: "Họ và tên",
    fNamePh: "Nguyễn Văn A",
    fPhone: "Số điện thoại",
    fPhonePh: "xx xxxx xxxx",
    fEmail: "Email hoặc SĐT",
    fEmailPh: "Email hoặc SĐT",
    fAge: "Tuổi",
    fDept: "Ngành học quan tâm",
    fDeptPh: "Vui lòng chọn",
    deptOptions: [
      {
        value: "요양보호학과",
        label: "Chăm sóc người cao tuổi / 요양보호학과",
      },
      { value: "자동차학과", label: "Kỹ thuật ô tô / 자동차학과" },
      { value: "간호조무과", label: "Y tá điều dưỡng / 간호조무과" },
      { value: "호텔관광학과", label: "Du lịch - Khách sạn / 호텔관광학과" },
      { value: "식품조리학과", label: "Chế biến thực phẩm / 식품조리학과" },
      { value: "컴퓨터학과", label: "CNTT / 컴퓨터학과" },
      { value: "기타", label: "Khác / 기타" },
    ],
    fCenter: "Tỉnh / Thành phố cư trú",
    fCenterPh: "Chọn tỉnh / thành phố",
    fMessage: "Câu hỏi / Yêu cầu (không bắt buộc)",
    fMessagePh: "Nhập câu hỏi hoặc yêu cầu của bạn...",
    fRecruit:
      "Tôi muốn tham gia chương trình giới thiệu bạn bè (nhận ưu đãi khi giới thiệu)",
    fAgree: "Tôi đồng ý với việc thu thập và sử dụng thông tin cá nhân",
    submit: "Đăng ký tư vấn →",
    fnote:
      "Thông tin của bạn chỉ được dùng cho mục đích tư vấn và sẽ không được chia sẻ với bên thứ ba.",
    successEyebrow: "ĐÃ GỬI",
    successTitle: "Đăng ký đã được tiếp nhận",
    successDesc: "Chúng tôi sẽ sớm liên hệ với bạn.",
  },
};

const universities = {
  ko: {
    eyebrow: "제휴 대학 / 학과",
    titlePrefix: "취업 특화 ",
    titleEm: "제휴 대학",
    titleSuffix: "",
    desc:
      "취업 비자 지원, 현장실습, 취업 연계 프로그램이 검증된 대학·학과만 선별했습니다.",
    tabDirectDesc: "23세 ~ 35세, 토픽 2급 이상",
    tabDirectTitle: "바로 진학",
    tabDirectSub: "어학당을 건너뛰는 최단 취업 코스!",
    tabLangDesc: "23세 이하, 토픽 1급 이상",
    tabLangTitle: "어학당 경유",
    tabLangSub: "유학 전과정과 취업까지 경험하는 최고의 코스!",
    badgeHot: "인기",
    badgeGood: "추천",
    modalTitle: "학과 안내",
    modalTuition: "등록금",
    modalScholarship: "장학금",
    modalDegree: "수학 기간",
    modalYearUnit: "년",
    modalDeptLink: "학과 홈페이지",
    modalStrengths: "특징",
  },
  vi: {
    eyebrow: "Trường ĐH & Ngành học",
    titlePrefix: "Trường đại học ",
    titleEm: "chuyên về việc làm",
    titleSuffix: "",
    desc:
      "Chỉ những trường có hỗ trợ visa lao động, thực tập thực tế và chương trình kết nối việc làm đã được kiểm chứng.",
    tabDirectDesc: "23–35 tuổi, TOPIK cấp 2 trở lên",
    tabDirectTitle: "Nhập học trực tiếp",
    tabDirectSub: "Khóa học nhanh nhất — bỏ qua trường ngôn ngữ!",
    tabLangDesc: "Dưới 23 tuổi, TOPIK cấp 1 trở lên",
    tabLangTitle: "Qua trường ngôn ngữ",
    tabLangSub: "Trải nghiệm toàn bộ du học và việc làm!",
    badgeHot: "HOT",
    badgeGood: "Tốt",
    modalTitle: "Chi tiết ngành học",
    modalTuition: "Học phí",
    modalScholarship: "Học bổng",
    modalDegree: "Thời gian học",
    modalYearUnit: " năm",
    modalDeptLink: "Trang ngành học",
    modalStrengths: "Đặc điểm",
  },
};

const recruiting = {
  ko: {
    eyebrow: "엠버서더",
    title: "나도 돈 벌고, <em>친구도 할인 받고!</em>",
    desc: "글로케어에 친구를 소개하면, 소개자와 친구 모두 상품권(쿠팡, 스타벅스 등)으로 리워드를 받습니다.",
    steps: [
      {
        num: 1,
        title: "친구를 글로케어에 소개",
        desc: "글로케어 경험자라면 누구나 참여 가능합니다.",
      },
      {
        num: 2,
        title: "친구가 원하는 코스에 등록",
        desc: "친구가 원하는 코스에 자유롭게 등록합니다.",
      },
      {
        num: 3,
        title: "상품권으로 즉시 리워드 수령",
        desc: "쿠팡, 스타벅스, GS25 등 원하는 상품권을 직접 선택하세요.",
      },
    ],
    programs: [
      {
        title: "리쿠르팅 프로그램",
        desc: "글로케어에 지인을 소개하면, 등록 완료 시 소개자와 등록자 모두 리워드를 받습니다.",
      },
      {
        title: "버디 프로그램",
        desc: "같은 기수·같은 프로그램에 지인과 함께 등록하면 버디 리워드가 추가 지급됩니다.",
      },
    ],
    rewards: [
      { val: "최대 ₩200,000", lbl: "유학 리워드 · 소개자" },
      { val: "각 ₩100,000", lbl: "버디 리워드 · 양쪽 모두" },
      { val: "각 ₩50,000", lbl: "스페셜 · D4→D2 입학" },
    ],
    giftHeader: "원하는 상품권을 직접 선택",
    giftList:
      "쿠팡 · 네이버 · 신세계 · 이마트 · 올리브영 · GS25 · CU · 스타벅스 · 메가커피 · 배달의민족",
    ctaJoin: "지금 친구 소개하기",
    ctaDetails: "상세보기",
    footnote:
      "※ 리워드는 등록일로부터 2개월 이내 지급됩니다.<br>※ 입학 리워드는 제휴 대학교에 한해 적용됩니다.<br>※ 엠버서더 프로그램 — 곧 출시 예정!",
  },
  vi: {
    eyebrow: "Đại sứ",
    title:
      "Tôi kiếm tiền, <em>bạn tôi được giảm giá!</em>",
    desc: "Giới thiệu bạn bè cho GLOCARE — cả hai cùng nhận thưởng bằng phiếu quà tặng (Coupang, Starbucks, v.v.).",
    steps: [
      {
        num: 1,
        title: "Giới thiệu bạn bè cho GLOCARE",
        desc: "Ai đã từng dùng GLOCARE đều có thể tham gia.",
      },
      {
        num: 2,
        title: "Bạn bè đăng ký khóa học",
        desc: "Bạn bè tự do chọn và đăng ký khóa học phù hợp.",
      },
      {
        num: 3,
        title: "Nhận phiếu quà tặng ngay",
        desc: "Chọn phiếu quà tặng bạn muốn — Coupang, Starbucks, GS25, v.v.",
      },
    ],
    programs: [
      {
        title: "Recruiting Program",
        desc: "Giới thiệu bạn bè cho GLOCARE — cả hai đều nhận thưởng khi đăng ký thành công.",
      },
      {
        title: "Buddy Program",
        desc: "Đăng ký cùng bạn bè trong cùng khóa — cả hai nhận thêm thưởng Buddy.",
      },
    ],
    rewards: [
      { val: "200.000 ₩", lbl: "Du học · Recruiting" },
      { val: "100.000 ₩", lbl: "Buddy · cả hai người" },
      { val: "50.000 ₩", lbl: "Special · D4 → D2" },
    ],
    giftHeader: "Chọn phiếu quà tặng bạn muốn",
    giftList:
      "Coupang · Naver · Shinsegae · Emart · Olive Young · GS25 · CU · Starbucks · Mega Coffee · Baedal Minjok",
    ctaJoin: "Tham gia ngay",
    ctaDetails: "Xem chi tiết",
    footnote:
      "※ Thưởng được gửi trong vòng 2 tháng kể từ ngày đăng ký.<br>※ Thưởng nhập học chỉ áp dụng cho trường đại học liên kết.<br>※ Chương trình Đại sứ — sắp ra mắt!",
  },
};

const floating = {
  ko: {
    zaloTitle: "Zalo GLOCARE",
    zaloDesc: "QR코드를 스캔하여 Zalo로 연결하세요",
    close: "닫기",
  },
  vi: {
    zaloTitle: "Zalo GLOCARE",
    zaloDesc: "Quét mã QR để kết nối Zalo",
    close: "Đóng",
  },
};

export function getSectionStrings(locale: Locale) {
  return {
    apply: apply[locale],
    universities: universities[locale],
    recruiting: recruiting[locale],
    floating: floating[locale],
  };
}
