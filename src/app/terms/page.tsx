import { getDict, getLocale } from "@/lib/i18n";

export default async function TermsPage() {
  const t = await getDict();
  const locale = await getLocale();
  const isVi = locale === "vi";

  return (
    <div className="page-wrap" style={{ maxWidth: 760 }}>
      <div className="eyebrow">{t["terms.title"]}</div>
      <h1 className="page-title">{t["terms.title"]}</h1>
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
        <Section title={isVi ? "Điều 1. Mục đích" : "제1조 (목적)"}>
          {isVi
            ? "Điều khoản này quy định các điều kiện sử dụng dịch vụ web (sau đây gọi là 'Dịch vụ') do GLOCARE (sau đây gọi là 'Công ty') cung cấp."
            : "본 약관은 글로케어(이하 '회사')가 제공하는 웹 서비스(이하 '서비스')의 이용 조건을 규정합니다."}
        </Section>

        <Section
          title={isVi ? "Điều 2. Định nghĩa" : "제2조 (용어의 정의)"}
        >
          {isVi
            ? "1. 'Thành viên' là người đã đăng ký tài khoản và sử dụng Dịch vụ.\n2. 'Tài khoản SNS' là tài khoản đăng nhập qua Google, Facebook và các nhà cung cấp khác."
            : "1. '회원'은 본 서비스에 가입하여 이용하는 자입니다.\n2. 'SNS 계정'은 Google, Facebook 등 외부 인증 제공자를 통한 로그인 계정을 말합니다."}
        </Section>

        <Section
          title={
            isVi
              ? "Điều 3. Đăng ký và quản lý thành viên"
              : "제3조 (회원 가입 및 관리)"
          }
        >
          {isVi
            ? "Thành viên đăng ký bằng cách đăng nhập SNS. Thành viên có nghĩa vụ cung cấp thông tin chính xác và cập nhật khi có thay đổi."
            : "회원은 SNS 로그인 방식으로 가입할 수 있으며, 정확한 정보를 제공할 의무가 있습니다."}
        </Section>

        <Section
          title={isVi ? "Điều 4. Quyền và nghĩa vụ" : "제4조 (회원의 의무)"}
        >
          {isVi
            ? "Thành viên không được sử dụng Dịch vụ vào mục đích trái pháp luật, không được giả mạo thông tin, không được xâm phạm quyền của người khác."
            : "회원은 본 서비스를 불법적인 목적으로 사용하거나, 타인의 정보를 도용하거나, 타인의 권리를 침해해서는 안 됩니다."}
        </Section>

        <Section
          title={
            isVi
              ? "Điều 5. Hủy bỏ và chấm dứt"
              : "제5조 (서비스 이용 중지 및 해지)"
          }
        >
          {isVi
            ? "Công ty có thể tạm dừng hoặc chấm dứt dịch vụ đối với thành viên vi phạm điều khoản. Thành viên có thể yêu cầu xóa tài khoản bất cứ lúc nào."
            : "회사는 약관을 위반한 회원에 대해 서비스 이용을 중지하거나 해지할 수 있습니다. 회원은 언제든 탈퇴를 요청할 수 있습니다."}
        </Section>

        <Section
          title={
            isVi ? "Điều 6. Miễn trừ trách nhiệm" : "제6조 (책임 제한)"
          }
        >
          {isVi
            ? "Công ty không chịu trách nhiệm về các thiệt hại do sự cố kỹ thuật, lỗi dữ liệu hoặc nguyên nhân bất khả kháng."
            : "회사는 천재지변, 시스템 장애 등 불가항력적 사유로 인한 피해에 대해 책임을 지지 않습니다."}
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
            ? "* Điều khoản chi tiết hơn sẽ được cập nhật. Vui lòng liên hệ help@glocare.co.kr nếu có câu hỏi."
            : "* 더 상세한 약관은 추후 업데이트 됩니다. 문의는 help@glocare.co.kr 으로 부탁드립니다."}
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
