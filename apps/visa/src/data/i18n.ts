/**
 * 한국어 → 베트남어 UI·내용 공통 번역 사전.
 *
 * - 병기 표시(Bi)와 UI 텍스트(T)가 이 사전을 폴백으로 사용한다.
 *   우선순위: 사용자 편집(overrides.vi / localStorage) > 이 사전 > (없으면 한국어만).
 * - 베트남 공식 서류의 식별자/코드(CCCD·CT07·CT08 등)는 "번역"하지 않고 실제 명칭·코드를 그대로 둔다.
 * - 값은 조회 화면에 실제로 노출되는 한국어 문자열(사용자 오버라이드 반영본)을 키로 한다.
 */
export const VI: Record<string, string> = {
  /* ── 헤더 ── */
  "한국 유학비자 발급요건 조회": "Tra cứu điều kiện cấp visa du học Hàn Quốc",
  "신청 상황을 고르면 제출 서류와 발급 조건을 정리해 드립니다.": "Chọn tình huống của bạn để xem danh sách giấy tờ và điều kiện cấp visa.",
  "기준일": "Ngày cập nhật",

  /* ── 입력 폼 ── */
  "지원 기관": "Cơ quan đăng ký",
  "대학교": "Trường đại học",
  "어학당": "Trung tâm tiếng Hàn",
  "학위과정 (D-2)": "Chương trình học vị (D-2)",
  "어학연수 (D-4)": "Học tiếng (D-4)",
  "이미 한국에서 어학연수(D-4) 중 → D-2로 국내 변경": "Đang học tiếng (D-4) tại Hàn Quốc → chuyển sang D-2 trong nước",
  "본인의 국적 및 거주지": "Quốc tịch và nơi cư trú của bạn",
  "대학교 이름으로": "Theo tên trường đại học",
  "어학당 이름으로": "Theo tên trung tâm tiếng Hàn",
  "등급·지역 자동": "Tự động theo hạng · khu vực",
  "조건으로": "Theo điều kiện",
  "등급 + 지역 직접": "Chọn hạng + khu vực trực tiếp",
  "학위과정 등급": "Hạng chương trình học vị",
  "어학연수 등급": "Hạng học tiếng",
  "신청할 비자": "Loại visa đăng ký",
  "발급요건 조회": "Tra cứu điều kiện",
  "기관을 선택하면 조회할 수 있습니다.": "Chọn cơ quan để tra cứu.",

  /* ── 대학 등급 선택지 ── */
  "우수 인증대학": "Trường được chứng nhận xuất sắc",
  "인증대학": "Trường được chứng nhận",
  "미인증(일반) 대학": "Trường chưa chứng nhận (thường)",
  "컨설팅대학 (비자심사 강화)": "Trường tư vấn (thẩm định visa tăng cường)",
  "비자정밀 심사대학": "Trường thẩm định visa nghiêm ngặt",
  "어학연수 인증": "Học tiếng được chứng nhận",
  "어학연수 일반(미인증)": "Học tiếng thường (chưa chứng nhận)",
  "어학연수 정밀심사": "Học tiếng thẩm định nghiêm ngặt",
  "수도권 (서울·인천·경기)": "Khu vực thủ đô (Seoul · Incheon · Gyeonggi)",
  "비수도권 (그 외)": "Ngoài thủ đô (khác)",

  /* ── 등급/지역 배지 ── */
  "우수인증": "Chứng nhận xuất sắc",
  "인증": "Chứng nhận",
  "미인증(일반)": "Chưa chứng nhận (thường)",
  "수도권": "Thủ đô",
  "비수도권": "Ngoài thủ đô",
  "어학-정밀": "Tiếng · nghiêm ngặt",
  "어학-인증": "Tiếng · chứng nhận",
  "어학-일반": "Tiếng · thường",
  // 인증 등급 학교유형 세분
  "인증-대학": "Chứng nhận - Đại học",
  "인증-전문대학": "Chứng nhận - Cao đẳng",
  "인증-대학원": "Chứng nhận - Sau đại học",
  "우수인증-대학": "Chứng nhận xuất sắc - Đại học",
  "우수인증-전문대학": "Chứng nhận xuất sắc - Cao đẳng",
  "우수인증-대학원": "Chứng nhận xuất sắc - Sau đại học",

  /* ── 국가(법무부 고시 21개국 + 그 외) ── */
  "베트남": "Việt Nam",
  "중국": "Trung Quốc",
  "몽골": "Mông Cổ",
  "우즈베키스탄": "Uzbekistan",
  "필리핀": "Philippines",
  "인도네시아": "Indonesia",
  "방글라데시": "Bangladesh",
  "태국": "Thái Lan",
  "파키스탄": "Pakistan",
  "스리랑카": "Sri Lanka",
  "인도": "Ấn Độ",
  "미얀마": "Myanmar",
  "네팔": "Nepal",
  "이란": "Iran",
  "카자흐스탄": "Kazakhstan",
  "키르기스스탄": "Kyrgyzstan",
  "우크라이나": "Ukraine",
  "나이지리아": "Nigeria",
  "가나": "Ghana",
  "이집트": "Ai Cập",
  "페루": "Peru",
  "그 외 일반 국가": "Quốc gia khác (thường)",
  "고시 21개국": "21 quốc gia được chỉ định",
  "그 외": "Khác",

  /* ── 비자 종류(statusCode) ── */
  "D-2-1 전문학사": "D-2-1 Cao đẳng",
  "D-2-2 학사(전공심화)": "D-2-2 Đại học (chuyên sâu)",
  "D-2-3 석사(학·석 통합)": "D-2-3 Thạc sĩ (liên thông cử nhân–thạc sĩ)",
  "D-2-4 박사(석·박 통합)": "D-2-4 Tiến sĩ (liên thông thạc sĩ–tiến sĩ)",
  "D-2-5 연구과정": "D-2-5 Nghiên cứu sinh",
  "D-2-6 교환학생": "D-2-6 Sinh viên trao đổi",
  "D-2-7 일·학습연계": "D-2-7 Vừa học vừa làm",
  "D-2-8 방문학생": "D-2-8 Sinh viên thăm quan",
  "D-4-1 한국어연수": "D-4-1 Học tiếng Hàn",
  "D-4-7 외국어연수": "D-4-7 Học ngoại ngữ",

  /* ── 요약 바 ── */
  "어학당 (D-4)": "Trung tâm tiếng Hàn (D-4)",
  "대학교 (D-2)": "Trường đại học (D-2)",
  "대학교 · D-4→D-2 변경": "Trường đại học · chuyển D-4→D-2",
  "수정": "Chỉnh sửa",
  "서류 내용 편집": "Chỉnh sửa nội dung giấy tờ",

  /* ── 결과 섹션 ── */
  "신분·공통": "Nhân thân · chung",
  "학력": "Học vấn",
  "재정": "Tài chính",
  "건강": "Sức khỏe",
  "어학": "Ngoại ngữ",
  "건": "mục",
  "자세히": "Chi tiết",
  "접기": "Thu gọn",
  "확인 필요": "Cần xác nhận",

  /* ── 지원 프로세스 ── */
  "지원 프로세스": "Quy trình đăng ký",
  "흐름": "Luồng",
  "사전 준비": "Chuẩn bị trước",
  "원서 접수": "Nộp hồ sơ nhập học",
  "평가·합격": "Đánh giá · trúng tuyển",
  "등록금 납부": "Đóng học phí",
  "표준입학허가서": "Giấy nhập học tiêu chuẩn",
  "사증발급인정서": "Giấy xác nhận cấp visa (CoA)",
  "비자 신청": "Nộp đơn xin visa",
  "비자 수령": "Nhận visa",
  "사전 준비 없음": "Không cần chuẩn bị trước",
  "해당 없음": "Không áp dụng",
  "간소화 트랙 · 사증발급인정서 경로": "Luồng đơn giản hóa · qua Giấy xác nhận cấp visa (CoA)",
  "표준 트랙 · 일부 간소화": "Luồng tiêu chuẩn · đơn giản hóa một phần",
  "풀세트 트랙 · 예치금 준비": "Luồng đầy đủ · chuẩn bị tiền ký quỹ",
  "발급 제한": "Hạn chế cấp",
  // 액터
  "학생": "Sinh viên",
  "대학": "Trường",
  "출입국": "Cục XNC",
  "대사관": "Đại sứ quán",
  // 단계 셀
  "입학 서류 PDF 제출": "Nộp hồ sơ nhập học (PDF)",
  "서류 및 면접 평가": "Đánh giá hồ sơ và phỏng vấn",
  "Invoice 발행": "Xuất hóa đơn (Invoice)",
  "표준입학허가서 발급 (이 흐름에선 비자에 사용 안 함)": "Cấp Giấy nhập học tiêu chuẩn (luồng này không dùng cho visa)",
  "표준입학허가서 발급": "Cấp Giấy nhập học tiêu chuẩn",
  "원본 서류 발송": "Gửi giấy tờ bản gốc",
  "사증발급인정서 신청": "Xin Giấy xác nhận cấp visa (CoA)",
  "사증발급인정서 발급": "Cấp Giấy xác nhận cấp visa (CoA)",
  "간소화 서류": "Hồ sơ đơn giản hóa",
  "서류 중심 · 면접 없음": "Xét hồ sơ · không phỏng vấn",
  "일부 간소화 서류": "Hồ sơ đơn giản hóa một phần",
  "서류 및 면접": "Hồ sơ và phỏng vấn",
  "전체 서류": "Hồ sơ đầy đủ",
  "예치금 준비 (원서 접수 전 · 최소 1개월 리드타임)": "Chuẩn bị tiền ký quỹ (trước khi nộp hồ sơ · tối thiểu 1 tháng)",
  "개학 1주일 전": "1 tuần trước khai giảng",

  /* ── 발급 제한 카드 ── */
  "어학연수 정밀심사 대학은 어학연수 비자 발급이 제한됩니다.": "Trường học tiếng thẩm định nghiêm ngặt bị hạn chế cấp visa học tiếng.",
  "학위 정밀심사 대학은 학사·석사 신규 비자가 제한됩니다.": "Trường học vị thẩm định nghiêm ngặt bị hạn chế cấp visa mới bậc cử nhân·thạc sĩ.",
  "제도상 발생하지 않는 조합입니다(어학연수 인증은 학위과정 인증이 전제). 등급을 다시 확인해 주세요.": "Đây là tổ hợp không tồn tại theo quy định (học tiếng được chứng nhận yêu cầu chương trình học vị đã được chứng nhận). Vui lòng kiểm tra lại hạng.",

  /* ── 콜아웃(안내) ── */
  "국내 변경(D-4→D-2)은 관할 출입국·외국인청에 접수합니다(하이코리아). 결핵진단서·영사확인·번역공증은 면제됩니다.":
    "Chuyển đổi trong nước (D-4→D-2) nộp tại Cục XNC quản lý (HiKorea). Được miễn giấy khám lao · xác nhận lãnh sự · dịch thuật công chứng.",
  "베트남은 우수 인증대학이어도 재정 심사를 합니다 → 재정서류를 준비하세요.":
    "Với Việt Nam, dù là trường chứng nhận xuất sắc vẫn thẩm định tài chính → hãy chuẩn bị giấy tờ tài chính.",
  "컨설팅대학(비자심사 강화): 재정 예치기간 6개월·어학 성적 필수.":
    "Trường tư vấn (thẩm định visa tăng cường): ký quỹ tài chính 6 tháng · bắt buộc chứng chỉ ngoại ngữ.",

  /* ── 속성(태그) 라벨 ── */
  "명의": "Chủ sở hữu",
  "발급기관": "Cơ quan cấp",
  "형식": "Hình thức",
  "유효기간": "Thời hạn hiệu lực",
  "번역": "Dịch thuật",
  "공증": "Công chứng",
  "영사확인": "Xác nhận lãnh sự",
  "서명": "Chữ ký",
  "발급 예상 소요일": "Thời gian cấp dự kiến",

  /* ── 공통 속성 값 ── */
  "본인": "Bản thân",
  "재정보증인": "Người bảo lãnh tài chính",
  "대학 발급": "Do trường cấp",
  "원본": "Bản gốc",
  "사본": "Bản sao",
  "원본 및 사본": "Bản gốc và bản sao",
  "은행": "Ngân hàng",
  "번역 및 공증": "Dịch thuật và công chứng",
  "★확인불가": "★ Chưa xác định",
  "당일": "Trong ngày",
  "7일": "7 ngày",
  "3개월": "3 tháng",
  "1일 ~ 3일": "1 ~ 3 ngày",
  "1일 ~ 10일": "1 ~ 10 ngày",
  "다양함": "Đa dạng",
  "학교": "Nhà trường",
  "친필 서명": "Chữ ký tay",
  "번역 및 공증된 원본": "Bản gốc đã dịch và công chứng",
  "한글 또는 영어가 아닐 경우 번역 및 공증 필요": "Nếu không phải tiếng Hàn/Anh thì cần dịch và công chứng",
  "한글 또는 영어가 아닐 경우 번역 및 공증 필요 (사업자등록증·부가세 납부증명은 제외)": "Nếu không phải tiếng Hàn/Anh thì cần dịch và công chứng (trừ giấy phép kinh doanh · chứng từ nộp thuế GTGT)",
  "필수, 외무성 → 총영사관": "Bắt buộc, Bộ Ngoại giao → Tổng lãnh sự quán",
  "8일 ~ 20일(발급 3 ~ 7일 + 번역 및 공증 1일 ~ 3일 + 영사확인 4 ~ 8일)  ": "8 ~ 20 ngày (cấp 3 ~ 7 ngày + dịch·công chứng 1 ~ 3 ngày + xác nhận lãnh sự 4 ~ 8 ngày)  ",
};
