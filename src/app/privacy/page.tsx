import { getDict, getLocale } from "@/lib/i18n";

export default async function PrivacyPage() {
  const t = await getDict();
  const locale = await getLocale();
  const isVi = locale === "vi";

  return (
    <div className="page-wrap" style={{ maxWidth: 760 }}>
      <div className="eyebrow">{t["privacy.title"]}</div>
      <h1 className="page-title">{t["privacy.title"]}</h1>
      <p
        className="page-desc"
        style={{ fontSize: "0.82rem", color: "var(--ink-xlight)" }}
      >
        {t["legal.last_updated"]}: 2026-04-29
      </p>

      <div
        style={{
          fontSize: "0.92rem",
          color: "var(--ink-mid)",
          lineHeight: 1.85,
          marginTop: "2rem",
        }}
      >
        <Section
          title={
            isVi
              ? "1. Mục đích thu thập thông tin"
              : "1. 개인정보 수집 목적"
          }
        >
          {isVi
            ? "Công ty thu thập thông tin cá nhân để cung cấp dịch vụ tư vấn đào tạo, ghép nối việc làm và hỗ trợ visa cho điều dưỡng viên người nước ngoài."
            : "회사는 외국인 요양보호사를 위한 교육 상담·취업 매칭·비자 지원 서비스 제공을 목적으로 개인정보를 수집합니다."}
        </Section>

        <Section
          title={isVi ? "2. Thông tin thu thập" : "2. 수집 항목"}
        >
          {isVi
            ? "- Thông tin SNS (Google/Facebook): tên, email\n- Thông tin do thành viên cung cấp: số điện thoại, địa chỉ, cấp độ TOPIK, loại visa, ảnh CV (tùy chọn)\n- Thông tin sử dụng: lịch sử xem video, kết quả CBT, CV"
            : "- SNS 인증 정보: 이름, 이메일\n- 회원이 제공한 정보: 전화번호, 주소, TOPIK 등급, 비자 종류, 이력서 사진 (선택)\n- 서비스 이용 기록: 영상 시청, CBT 결과, 이력서"}
        </Section>

        <Section
          title={
            isVi
              ? "3. Thời gian lưu giữ"
              : "3. 개인정보 보유 및 이용 기간"
          }
        >
          {isVi
            ? "Thông tin sẽ được lưu giữ trong khi tài khoản hoạt động và xóa trong vòng 30 ngày sau khi yêu cầu hủy tài khoản. Một số thông tin có thể được lưu giữ lâu hơn theo quy định của pháp luật."
            : "회원 자격 유지 기간 동안 보유하며, 탈퇴 요청 시 30일 이내 파기합니다. 단, 관련 법령에 따라 일정 기간 보존되는 정보가 있을 수 있습니다."}
        </Section>

        <Section
          title={
            isVi
              ? "4. Cung cấp cho bên thứ ba"
              : "4. 개인정보 제3자 제공"
          }
        >
          {isVi
            ? "Công ty không cung cấp thông tin cho bên thứ ba mà không có sự đồng ý của thành viên, ngoại trừ trường hợp bắt buộc theo pháp luật."
            : "회사는 회원 동의 없이 제3자에게 정보를 제공하지 않습니다. 단, 법령에 의한 경우는 예외입니다."}
        </Section>

        <Section
          title={
            isVi
              ? "5. Quyền của thành viên"
              : "5. 회원의 권리"
          }
        >
          {isVi
            ? "Thành viên có quyền xem, chỉnh sửa, xóa thông tin cá nhân và yêu cầu hủy tài khoản. Vui lòng liên hệ help@glocare.co.kr."
            : "회원은 개인정보 열람·수정·삭제·탈퇴를 요청할 수 있습니다. help@glocare.co.kr 으로 문의해주세요."}
        </Section>

        <Section
          title={
            isVi
              ? "6. Bảo mật"
              : "6. 보안"
          }
        >
          {isVi
            ? "Thông tin được mã hóa và lưu trữ trên Supabase (Vercel hosting). Mật khẩu không được lưu trữ — chỉ sử dụng đăng nhập SNS."
            : "정보는 Supabase 에 저장되며, 비밀번호는 저장하지 않습니다 (SNS 로그인 전용)."}
        </Section>

        <Section
          title={
            isVi
              ? "7. Liên hệ"
              : "7. 개인정보 보호 책임자"
          }
        >
          {isVi
            ? "Email: help@glocare.co.kr\nĐiện thoại: 02-456-0724"
            : "이메일: help@glocare.co.kr\n전화: 02-456-0724"}
        </Section>

        <p
          style={{
            marginTop: "2.5rem",
            padding: "1rem",
            background: "var(--peach)",
            borderRadius: 10,
            fontSize: "0.82rem",
            color: "var(--ink-light)",
          }}
        >
          {isVi
            ? "* Chính sách chi tiết hơn sẽ được cập nhật. Vui lòng liên hệ help@glocare.co.kr nếu có câu hỏi."
            : "* 더 상세한 처리방침은 추후 업데이트 됩니다. 문의는 help@glocare.co.kr 으로 부탁드립니다."}
        </p>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: "2rem" }}>
      <h3
        style={{
          fontFamily: "var(--font-noto-serif-kr), serif",
          fontSize: "1.05rem",
          fontWeight: 800,
          color: "var(--ink)",
          marginBottom: "0.6rem",
        }}
      >
        {title}
      </h3>
      <div style={{ whiteSpace: "pre-line" }}>{children}</div>
    </div>
  );
}
