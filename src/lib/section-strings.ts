/**
 * 섹션별 정적 텍스트 — Apply 폼, Recruiting, Insurance 섹션 등
 * 원본 index.html data-vi/data-ko 1:1 매핑
 */
import type { Locale } from "@/lib/i18n";

const apply = {
  ko: {
    eyebrow: "신청 안내",
    titlePrefix: "지금 바로 ",
    titleEm: "시작하세요",
    titleSuffix: "",
    desc: "상담부터 한국 취업 정착까지 글로케어가 단계별로 안내합니다.",
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
    successTitle: "상담 신청이 정상 접수됐습니다",
    successDesc: "곧 담당자가 연락드리겠습니다.",
    proc: [
      { ico: "💬", lbl: "상담 신청", sub: "온라인 또는<br>유학센터 방문" },
      { ico: "🏫", lbl: "유학센터 등록", sub: "협력 센터에서<br>공식 등록" },
      { ico: "🎓", lbl: "한국 유학", sub: "제휴 대학<br>입학 및 수학" },
      { ico: "💼", lbl: "취업 연계", sub: "졸업 전<br>취업처 매칭" },
      { ico: "🇰🇷", lbl: "한국 취업", sub: "안정적인<br>한국 생활 시작" },
    ],
  },
  vi: {
    eyebrow: "Quy trình đăng ký",
    titlePrefix: "Bắt đầu hành trình của bạn ",
    titleEm: "ngay hôm nay",
    titleSuffix: "",
    desc:
      "GLOCARE hướng dẫn bạn từng bước — từ tư vấn đến khi ổn định tại Hàn Quốc.",
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
    successTitle: "Đăng ký đã được tiếp nhận",
    successDesc: "Chúng tôi sẽ sớm liên hệ với bạn.",
    proc: [
      { ico: "💬", lbl: "Tư vấn", sub: "Online hoặc<br>đến trung tâm" },
      {
        ico: "🏫",
        lbl: "Đăng ký",
        sub: "Đăng ký chính thức<br>tại trung tâm",
      },
      {
        ico: "🎓",
        lbl: "Du học",
        sub: "Nhập học và học tập<br>tại trường liên kết",
      },
      {
        ico: "💼",
        lbl: "Kết nối việc làm",
        sub: "Kết nối nhà tuyển dụng<br>trước khi tốt nghiệp",
      },
      {
        ico: "🇰🇷",
        lbl: "Có việc làm",
        sub: "Bắt đầu cuộc sống<br>ổn định tại Hàn Quốc",
      },
    ],
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
  },
};

const recruiting = {
  ko: {
    eyebrow: "내 친구 소개하기 프로그램",
    title: "나도 돈 벌고,<br><span style='opacity:0.85'>친구도 할인 받고!</span>",
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
        ico: "🔗",
        title: "리쿠르팅 프로그램",
        desc: "글로케어에 지인을 소개하면, 등록 완료 시 소개자와 등록자 모두 리워드를 받습니다.",
      },
      {
        ico: "👫",
        title: "버디 프로그램",
        desc: "같은 기수·같은 프로그램에 지인과 함께 등록하면 버디 리워드가 추가 지급됩니다.",
      },
    ],
    rewards: [
      { ico: "🎓", val: "최대 ₩200,000", lbl: "유학 리워드<br>소개자" },
      { ico: "👫", val: "각 ₩100,000", lbl: "버디 리워드<br>양쪽 모두" },
      { ico: "⭐", val: "각 ₩50,000", lbl: "스페셜<br>D4→D2 입학" },
    ],
    giftHeader: "🎁 원하는 상품권을 직접 선택",
    giftList:
      "쿠팡 · 네이버 · 신세계 · 이마트 · 올리브영 · GS25 · CU · 스타벅스 · 메가커피 · 배달의민족",
    ctaJoin: "지금 친구 소개하기",
    ctaDetails: "상세보기",
    footnote:
      "※ 리워드는 등록일로부터 2개월 이내 지급됩니다.<br>※ 입학 리워드는 제휴 대학교에 한해 적용됩니다.<br>★ 엠버서더 프로그램 — 곧 출시 예정!",
  },
  vi: {
    eyebrow: "Chương trình giới thiệu bạn bè",
    title:
      "Tôi kiếm tiền,<br><span style='opacity:0.85'>bạn tôi được giảm giá!</span>",
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
        ico: "🔗",
        title: "Recruiting Program",
        desc: "Giới thiệu bạn bè cho GLOCARE — cả hai đều nhận thưởng khi đăng ký thành công.",
      },
      {
        ico: "👫",
        title: "Buddy Program",
        desc: "Đăng ký cùng bạn bè trong cùng khóa — cả hai nhận thêm thưởng Buddy.",
      },
    ],
    rewards: [
      { ico: "🎓", val: "200.000 ₩", lbl: "Du học<br>Recruiting" },
      { ico: "👫", val: "100.000 ₩", lbl: "Buddy<br>cả hai người" },
      { ico: "⭐", val: "50.000 ₩", lbl: "Special<br>D4 → D2" },
    ],
    giftHeader: "🎁 Chọn phiếu quà tặng bạn muốn",
    giftList:
      "Coupang · Naver · Shinsegae · Emart · Olive Young · GS25 · CU · Starbucks · Mega Coffee · Baedal Minjok",
    ctaJoin: "Tham gia ngay",
    ctaDetails: "Xem chi tiết",
    footnote:
      "※ Thưởng được gửi trong vòng 2 tháng kể từ ngày đăng ký.<br>※ Thưởng nhập học chỉ áp dụng cho trường đại học liên kết.<br>★ Chương trình Đại sứ — sắp ra mắt!",
  },
};

const insuranceRefund = {
  ko: {
    eyebrow: "보험 환급",
    titlePrefix: "",
    titleEm: "환급",
    titleSuffix: " 신청하기",
    desc: "아래 정보를 입력해주시면 담당자가 Zalo로 직접 연락드립니다.",
    fName: "이름",
    fNamePh: "예: 이름을 입력해주세요",
    fAlien: "외국인 등록번호",
    fAlienPh: "예: 901231-1234567",
    fAlienHint: "한국에서 발급받은 외국인 등록증을 확인해주세요.",
    fZalo: "Zalo 번호",
    fZaloPh: "예: 1234-123-123",
    fZaloHint: "담당자가 Zalo로 연락드립니다",
    agreeAll: "모두 동의하기",
    agreeRequired: "[필수] 개인정보 수집 및 이용 동의",
    agreeMarketing: "[선택] 마케팅 및 홍보 목적 활용 동의",
    viewTerms: "내용 보기",
    termsRequired:
      "<strong>수집 목적:</strong> 보험 환급 신청 확인 및 처리<br><strong>수집 항목:</strong> 이름, 외국인 등록번호, Zalo 번호<br><strong>보유 기간:</strong> 처리 완료 후 3년 (관련 법령에 따름)<br>동의를 거부할 권리가 있으나, 거부 시 환급 신청이 불가합니다.",
    termsMarketing:
      "<strong>활용 목적:</strong> 신규 서비스 안내 및 홍보 콘텐츠 제공<br><strong>활용 항목:</strong> 이름, Zalo 번호<br>선택 사항이며, 동의하지 않아도 환급 신청에 영향 없습니다.",
    contactTitle: "외국인 등록번호 문의하기",
    contactIntro: "아래 연락처를 통해 확인할 수 있습니다:",
    contactKr: "(한국) 1345",
    contactVn: "(베트남) +82-2-1345",
    fnote:
      "제출하신 정보는 관련 목적으로만 사용되며 관련 법령에 따라 안전하게 보호됩니다.",
    submit: "신청하기",
    successTitle: "보험 환급 신청이 정상 접수됐습니다",
    successDesc: "담당자가 Zalo로 연락드릴 예정입니다.",
  },
  vi: {
    eyebrow: "Hoàn tiền bảo hiểm",
    titlePrefix: "Đăng ký ",
    titleEm: "hoàn tiền bảo hiểm",
    titleSuffix: "",
    desc: "Điền thông tin bên dưới — nhân viên phụ trách sẽ liên hệ bạn qua Zalo.",
    fName: "Họ và tên",
    fNamePh: "Ví dụ: Nhập tên của bạn",
    fAlien: "Số đăng ký người nước ngoài",
    fAlienPh: "Ví dụ: 901231-1234567",
    fAlienHint: "Vui lòng kiểm tra thẻ đăng ký người nước ngoài tại Hàn Quốc.",
    fZalo: "Số Zalo",
    fZaloPh: "Ví dụ: 1234-123-123",
    fZaloHint: "Nhân viên phụ trách sẽ liên hệ bạn qua Zalo.",
    agreeAll: "Đồng ý tất cả",
    agreeRequired:
      "[Bắt buộc] Đồng ý thu thập và sử dụng thông tin cá nhân",
    agreeMarketing:
      "[Tùy chọn] Đồng ý sử dụng cho mục đích tiếp thị và quảng bá",
    viewTerms: "Xem nội dung",
    termsRequired:
      "<strong>Mục đích thu thập:</strong> Xác nhận và xử lý yêu cầu hoàn tiền bảo hiểm<br><strong>Thông tin thu thập:</strong> Tên, số đăng ký người nước ngoài, số Zalo<br><strong>Thời gian lưu trữ:</strong> 3 năm kể từ ngày hoàn tất xử lý<br>Bạn có quyền từ chối đồng ý, nhưng nếu từ chối thì không thể đăng ký hoàn tiền.",
    termsMarketing:
      "<strong>Mục đích:</strong> Cung cấp thông tin dịch vụ mới và nội dung quảng bá<br><strong>Thông tin sử dụng:</strong> Tên, số Zalo<br>Đây là tùy chọn, bạn vẫn có thể đăng ký hoàn tiền nếu từ chối.",
    contactTitle: "Nơi kiểm tra số đăng ký người nước ngoài",
    contactIntro: "Bạn có thể kiểm tra số đăng ký qua:",
    contactKr: "(Hàn Quốc) 1345",
    contactVn: "(Việt Nam) +82-2-1345",
    fnote:
      "Thông tin bạn gửi chỉ được sử dụng cho mục đích liên quan và được bảo vệ an toàn theo pháp luật.",
    submit: "Đăng ký",
    successTitle: "Đăng ký bảo hiểm đã được tiếp nhận",
    successDesc: "Nhân viên phụ trách sẽ liên hệ bạn qua Zalo.",
  },
};

const insuranceInfo = {
  ko: {
    banner: "한국에 적립된 내 보험금 300억원<br>꼭 찾아가세요",
    s1Title: "🛡️ 귀국비용보험이란?",
    s1Items: [
      {
        label: "목적",
        value:
          "귀국 시 항공료 등 비용 충당, 불법체류 방지 목적으로 의무 가입",
      },
      {
        label: "가입 주체",
        value: "E-9·H-2 비자로 한국에서 체류했던 외국인근로자 본인",
      },
      { label: "보험료", value: "국가별 40~60만 원 (일시납 또는 3회 분납)" },
      { label: "담당 보험사", value: "삼성화재" },
    ],
    s2Title: "✅ 보험금 받을 수 있는 경우",
    s2Cases: [
      "체류기간이 만료되어 출국하는 경우",
      "개인 사정으로 체류기간 만료 전 귀국하는 경우 (일시 출국 제외)",
      "사업장 이탈 후 자진 출국하거나 강제 퇴거되는 경우",
    ],
    s2Notice:
      "⚠️ 일시적인 출국(여행, 단기 귀국 등)에는 지급되지 않습니다. 완전한 귀국 또는 체류자격 변경 시에만 신청 가능합니다.",
    s3Title: "📋 보험금 수령 방법 (2024.12 개정)",
    s3Methods: [
      {
        h: "2024년 12월 16일 이후 가입자",
        p: "자동 지급제 — 출국 시 별도 신청 없이 자동 지급됩니다.",
      },
      {
        h: "2024년 12월 16일 이전 가입자",
        p: "직접 수령 신청 또는 자동 지급 방식으로 직접 전환 후 자동 지급됩니다.",
      },
    ],
    s4Title: "🚨 꼭 알아두세요",
    s4Warning:
      "<strong>보험금 청구 기한은 지급사유 발생일로부터 3년입니다.</strong> 3년이 지나면 보험금을 찾을 수 없게 됩니다. 현재 <strong>300억 원 이상의 미수령 보험금</strong>이 남아있는 상태입니다.",
  },
  vi: {
    banner:
      "Hơn 30 tỷ Won bảo hiểm tích lũy tại Hàn Quốc<br>(hoàn tiền bằng VNĐ), hãy nhận lại ngay!",
    s1Title: "🛡️ Bảo hiểm chi phí hồi hương là gì?",
    s1Items: [
      {
        label: "Mục đích",
        value:
          "Chi trả vé máy bay khi về nước, bảo hiểm bắt buộc nhằm ngăn cư trú bất hợp pháp",
      },
      {
        label: "Đối tượng",
        value:
          "Lao động nước ngoài đã cư trú tại Hàn Quốc bằng visa E-9 hoặc H-2",
      },
      {
        label: "Phí bảo hiểm",
        value: "400.000 ~ 600.000 KRW tùy quốc gia (trả 1 lần hoặc 3 lần)",
      },
      {
        label: "Công ty BH",
        value: "Samsung Fire & Marine Insurance",
      },
    ],
    s2Title: "✅ Trường hợp được nhận bảo hiểm",
    s2Cases: [
      "Xuất cảnh khi hết thời hạn cư trú",
      "Về nước trước hạn vì lý do cá nhân (trừ xuất cảnh tạm thời)",
      "Tự nguyện xuất cảnh hoặc bị trục xuất sau khi rời nơi làm việc",
    ],
    s2Notice:
      "⚠️ Xuất cảnh tạm thời (du lịch, về nước ngắn hạn, v.v.) không được chi trả. Chỉ có thể đăng ký khi về nước hoàn toàn hoặc thay đổi tư cách cư trú.",
    s3Title: "📋 Cách nhận bảo hiểm (sửa đổi 12/2024)",
    s3Methods: [
      {
        h: "Người đăng ký sau ngày 16/12/2024",
        p: "Hệ thống tự động chi trả — được chi trả tự động khi xuất cảnh, không cần đăng ký riêng.",
      },
      {
        h: "Người đăng ký trước ngày 16/12/2024",
        p: "Đăng ký nhận trực tiếp hoặc chuyển sang hệ thống tự động rồi nhận tự động.",
      },
    ],
    s4Title: "🚨 Lưu ý quan trọng",
    s4Warning:
      "<strong>Thời hạn yêu cầu bảo hiểm là 3 năm</strong> kể từ ngày phát sinh sự kiện chi trả. Sau 3 năm, bạn sẽ không thể nhận lại số tiền bảo hiểm. Hiện tại, <strong>hơn 30 tỷ Won bảo hiểm chưa được nhận.</strong>",
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
    insuranceRefund: insuranceRefund[locale],
    insuranceInfo: insuranceInfo[locale],
    floating: floating[locale],
  };
}
