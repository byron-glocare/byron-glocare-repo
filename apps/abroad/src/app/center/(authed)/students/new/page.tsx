/**
 * /center/students/new — 학생 개별 등록.
 *   서버 컴포넌트 → NewStudentForm (client).
 */

import Link from "next/link";

import { verifyCenterSession } from "@/lib/center/dal";
import { createServiceClient } from "@/lib/supabase/service";
import { getLocale, tr } from "@/lib/i18n";

import { NewStudentForm } from "./new-student-form";

export default async function NewStudentPage() {
  const session = await verifyCenterSession(); // 인증 + org 검증
  const locale = await getLocale();

  // 글로케어(본사) 계정: 학생을 배정할 유학센터 마스터 목록(study_centers).
  //   org(계정) 이 아직 없는 센터도 노출 — 배정 시 org 를 찾거나 생성한다.
  //   맨 앞에 "글로케어(본사 직접 관리)" 옵션을 둔다 — 자기 org 로 직접 등록.
  let centers: { id: number; name: string }[] | null = null;
  if (session.isGlocare) {
    const svc = createServiceClient();
    const { data } = await svc
      .from("study_centers")
      .select("id, name_ko, name_vi, active")
      .eq("active", true)
      .order("name_vi");
    const ownScId = session.org.study_center_id;
    const others = (data ?? [])
      .filter((c) => c.id !== ownScId)
      .map((c) => ({
        id: c.id,
        name:
          locale === "ko"
            ? c.name_ko || c.name_vi
            : c.name_vi || c.name_ko || "",
      }));
    // 글로케어 본사 직접 관리 옵션 (자기 study_center id 로 배정 → 자기 org 로 귀속)
    const glocareSelf =
      ownScId != null
        ? [
            {
              id: ownScId,
              name: tr(
                locale,
                "글로케어 (본사 직접 관리)",
                "Glocare (Trụ sở trực tiếp quản lý)"
              ),
            },
          ]
        : [];
    centers = [...glocareSelf, ...others];
  }

  return (
    <div className="max-w-3xl">
      <header className="mb-6">
        <Link
          href="/center/students"
          className="text-sm text-slate-500 hover:underline"
        >
          {tr(locale, "← 목록으로 돌아가기", "← Quay lại danh sách")}
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          {tr(locale, "신규 학생 등록", "Đăng ký sinh viên mới")}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {tr(
            locale,
            "기본 정보를 입력하세요. 구체적인 지원 내역(대학·학과)은 상세 페이지에서 나중에 추가할 수 있습니다.",
            "Nhập thông tin cơ bản. Đơn tuyển sinh cụ thể (trường, ngành) có thể thêm sau ở trang chi tiết."
          )}
        </p>
      </header>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <NewStudentForm locale={locale} centers={centers} />
      </div>
    </div>
  );
}
