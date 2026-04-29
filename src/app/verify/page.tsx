import { redirect } from "next/navigation";

import { VerifyForm } from "@/components/verify-form";
import { getAuthState } from "@/lib/auth";
import { getLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function VerifyPage() {
  const auth = await getAuthState();
  if (auth.kind === "guest") redirect("/login?next=/verify");
  if (auth.kind === "mapped") redirect("/");

  const locale = await getLocale();
  const isVi = locale === "vi";

  return (
    <div className="page-wrap fade-up" style={{ maxWidth: 480 }}>
      <div className="eyebrow">{isVi ? "Xác thực danh tính" : "본인 확인"}</div>
      <h1 className="page-title">
        {isVi ? "Liên kết tài khoản" : "계정 연동"}
      </h1>
      <p className="page-desc">
        {isVi
          ? "Vui lòng nhập tên và số điện thoại đã đăng ký với GLOCARE để liên kết tài khoản đăng nhập."
          : "글로케어에 등록된 이름과 전화번호를 입력하면 SNS 계정과 연동됩니다."}
      </p>

      <VerifyForm
        labels={{
          name: isVi ? "Họ và tên" : "이름",
          namePh: isVi ? "Nguyễn Văn A 또는 응우옌 반 안" : "홍길동 또는 NGUYEN VAN A",
          phone: isVi ? "Số điện thoại" : "전화번호",
          phonePh: "010-xxxx-xxxx",
          submit: isVi ? "Xác minh và liên kết" : "확인하고 연동하기",
          successMatched: isVi
            ? "Liên kết thành công!"
            : "연동되었습니다.",
          errorNoMatch: isVi
            ? "Không tìm thấy thông tin trùng khớp. Vui lòng liên hệ với chúng tôi."
            : "일치하는 정보를 찾지 못했습니다. 관리자에게 문의해주세요.",
          skipLabel: isVi
            ? "Bỏ qua bây giờ →"
            : "지금은 건너뛰기 →",
        }}
      />

      <div
        style={{
          marginTop: "2rem",
          padding: "1rem 1.2rem",
          background: "var(--peach)",
          border: "1.5px solid var(--coral-soft)",
          borderRadius: 10,
          fontSize: "0.83rem",
          color: "var(--ink-light)",
          lineHeight: 1.7,
        }}
      >
        💡{" "}
        {isVi ? (
          <>
            Nếu chưa từng liên hệ với GLOCARE, hãy đăng ký từ trang chủ thông qua{" "}
            <strong>"Đăng ký khóa đào tạo"</strong>.
          </>
        ) : (
          <>
            글로케어와 처음이라면 메인의{" "}
            <strong>"요양보호사 교육 신청"</strong> 으로 등록해주세요.
          </>
        )}
      </div>
    </div>
  );
}
