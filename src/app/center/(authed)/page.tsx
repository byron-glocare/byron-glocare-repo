/**
 * /center — 유학센터 대시보드 (B1 placeholder).
 *   후속 라운드에 학생 통계·마감 임박·검토 대기 카드들 추가.
 */

import { verifyCenterSession, isCenterAdmin } from "@/lib/center/dal";

export default async function CenterDashboardPage() {
  const session = await verifyCenterSession();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">
          Chào mừng, {session.member.name}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {session.org.name_vi} · Vai trò:{" "}
          {isCenterAdmin(session) ? "Quản trị viên" : "Người dùng"}
        </p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-3 text-base font-semibold text-slate-900">
          Đang trong giai đoạn phát triển
        </h2>
        <p className="text-sm text-slate-600">
          Các tính năng tiếp theo (B1 — đang triển khai):
        </p>
        <ul className="mt-3 space-y-1 text-sm text-slate-700">
          <li>· Quản lý danh sách sinh viên (đăng ký riêng lẻ + tải Excel)</li>
          <li>· Tra cứu hồ sơ tuyển sinh các trường</li>
          <li>· Thông tin trung tâm & người dùng</li>
        </ul>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-3 text-base font-semibold text-slate-900">
          Thông tin phiên đăng nhập (debug)
        </h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-slate-500">Email</dt>
          <dd className="text-slate-900">{session.email}</dd>
          <dt className="text-slate-500">Trung tâm ID</dt>
          <dd className="font-mono text-xs text-slate-700">{session.org.id}</dd>
          <dt className="text-slate-500">Trạng thái trung tâm</dt>
          <dd className="text-slate-900">{session.org.status}</dd>
          <dt className="text-slate-500">Vai trò người dùng</dt>
          <dd className="text-slate-900">{session.member.role}</dd>
        </dl>
      </section>
    </div>
  );
}
