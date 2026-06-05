/**
 * /center/students/[id] — 학생 상세.
 *   현재: 학생 정보(read-only) + 지원 의향 list(빈 자리).
 *   후속: 학생 정보 편집 / 지원 의향 등록·관리 (모집요강 페이지 본격 후).
 */

import Link from "next/link";
import { notFound } from "next/navigation";

import { verifyCenterSession } from "@/lib/center/dal";
import { createCenterClient } from "@/lib/supabase/center";

import { updateApplicationStatusAction } from "./applications/actions";
import { APP_STATUS_VALUES } from "./applications/status";
import { DeleteApplicationButton } from "./applications/delete-application-button";
import { DeleteStudentButton } from "./delete-student-button";

const VISA_LABELS: Record<string, string> = {
  "D-4": "D-4 (Khóa tiếng)",
  "D-2": "D-2 (Du học)",
  none: "Không có",
  other: "Khác",
};

const LOCATION_LABELS: Record<string, string> = {
  VN: "Việt Nam",
  KR: "Hàn Quốc",
  other: "Khác",
};

const APP_STATUS_LABELS: Record<string, string> = {
  preparing: "Đang chuẩn bị",
  ready_for_review: "Sẵn sàng kiểm tra",
  reviewing: "Đang kiểm tra",
  revisions_required: "Cần chỉnh sửa",
  submitted: "Đã nộp trường",
  accepted: "Đã trúng tuyển",
  rejected: "Bị từ chối",
  enrolled: "Đã nhập học",
  cancelled: "Đã hủy",
};

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await verifyCenterSession();
  const supabase = await createCenterClient();

  // RLS 가 본인 org 학생만 허용 → 다른 org 학생 id 라도 not found
  const { data: student, error: stErr } = await supabase
    .from("study_managed_students")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (stErr || !student) {
    notFound();
  }

  // 지원 목록 (현재는 빈 자리, 모집요강 페이지 후 본격)
  const { data: applications } = await supabase
    .from("study_applications")
    .select("id, status, next_action, next_deadline, target_department_label, created_at")
    .eq("student_id", id)
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-4xl">
      <header className="mb-6">
        <Link
          href="/center/students"
          className="text-sm text-slate-500 hover:underline"
        >
          ← Quay lại danh sách
        </Link>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {student.name}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Đăng ký:{" "}
              {new Date(student.created_at).toLocaleDateString("vi-VN")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/center/students/${id}/data`}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Dữ liệu chuẩn
            </Link>
            <Link
              href={`/center/students/${id}/essays`}
              className="rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
            >
              Bài luận AI
            </Link>
            <Link
              href={`/center/students/${id}/forms`}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Phiếu điền mẫu
            </Link>
            <Link
              href={`/center/students/${id}/edit`}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Chỉnh sửa
            </Link>
            <DeleteStudentButton
              studentId={id}
              studentName={student.name}
              applicationCount={applications?.length ?? 0}
            />
          </div>
        </div>
      </header>

      {/* 학생 기본 정보 */}
      <section className="mb-6 rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">
          Thông tin cơ bản
        </h2>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
          <Field label="Ngày sinh" value={student.dob} />
          <Field label="Số hộ chiếu" value={student.passport_no_encrypted} />
          <Field label="Số điện thoại" value={student.phone} />
          <Field label="Email" value={student.email} />
          <Field
            label="TOPIK"
            value={student.topik_level ? `Cấp ${student.topik_level}` : null}
          />
          <Field
            label="Visa hiện tại"
            value={
              student.current_visa
                ? (VISA_LABELS[student.current_visa] ?? student.current_visa)
                : null
            }
          />
          <Field
            label="Vị trí"
            value={
              student.location
                ? (LOCATION_LABELS[student.location] ?? student.location)
                : null
            }
          />
        </dl>
        {student.notes ? (
          <div className="mt-4 border-t border-slate-200 pt-4">
            <dt className="text-xs uppercase tracking-wide text-slate-500">
              Ghi chú
            </dt>
            <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-800">
              {student.notes}
            </dd>
          </div>
        ) : null}
      </section>

      {/* 지원 의향 list */}
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <header className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            Đơn tuyển sinh
          </h2>
          <Link
            href={`/center/students/${id}/applications/new`}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
          >
            + Thêm đơn
          </Link>
        </header>

        {!applications || applications.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
            Chưa có đơn tuyển sinh nào.
            <br />
            Nhấn &quot;+ Thêm đơn&quot; để liên kết sinh viên với hồ sơ tuyển
            sinh đã được duyệt.
          </div>
        ) : (
          <ul className="divide-y divide-slate-200">
            {applications.map((app) => (
              <li key={app.id} className="py-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="font-medium text-slate-900">
                      {app.target_department_label ?? "—"}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {app.next_action ? `${app.next_action}` : null}
                      {app.next_action && app.next_deadline ? " · " : null}
                      {app.next_deadline
                        ? `Hạn ${new Date(app.next_deadline).toLocaleDateString("vi-VN")}`
                        : null}
                      {!app.next_action && !app.next_deadline ? (
                        <span className="text-slate-400">
                          Chưa có ghi chú tiến độ
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* inline status form */}
                    <form
                      action={updateApplicationStatusAction.bind(
                        null,
                        app.id,
                        id
                      )}
                      className="flex items-center gap-1.5"
                    >
                      <select
                        name="status"
                        defaultValue={app.status}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-300"
                      >
                        {APP_STATUS_VALUES.map((s) => (
                          <option key={s} value={s}>
                            {APP_STATUS_LABELS[s] ?? s}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                        title="Lưu thay đổi"
                      >
                        Lưu
                      </button>
                    </form>
                    <Link
                      href={`/center/students/${id}/applications/${app.id}/edit`}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                      title="Chỉnh sửa ngành / tiến độ"
                    >
                      Sửa
                    </Link>
                    <DeleteApplicationButton
                      applicationId={app.id}
                      studentId={id}
                      departmentLabel={app.target_department_label}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-slate-800">{value ?? "—"}</dd>
    </div>
  );
}
