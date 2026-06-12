/**
 * /center/students/[id] — 학생 상세.
 *   현재: 학생 정보(read-only) + 지원 의향 list(빈 자리).
 *   후속: 학생 정보 편집 / 지원 의향 등록·관리 (모집요강 페이지 본격 후).
 */

import Link from "next/link";
import { notFound } from "next/navigation";

import { verifyCenterSession } from "@/lib/center/dal";
import { createCenterClient } from "@/lib/supabase/center";
import { getLocale, tr, type Locale } from "@/lib/i18n";

function visaLabel(locale: Locale, visa: string): string {
  switch (visa) {
    case "D-4":
      return tr(locale, "D-4 (어학연수)", "D-4 (Khóa tiếng)");
    case "D-2":
      return tr(locale, "D-2 (정규유학)", "D-2 (Du học)");
    case "none":
      return tr(locale, "없음", "Không có");
    case "other":
      return tr(locale, "기타", "Khác");
    default:
      return visa;
  }
}

function locationLabel(locale: Locale, loc: string): string {
  switch (loc) {
    case "VN":
      return tr(locale, "베트남", "Việt Nam");
    case "KR":
      return tr(locale, "한국", "Hàn Quốc");
    case "other":
      return tr(locale, "기타", "Khác");
    default:
      return loc;
  }
}

function appStatusLabel(locale: Locale, status: string): string {
  switch (status) {
    case "preparing":
      return tr(locale, "준비 중", "Đang chuẩn bị");
    case "ready_for_review":
      return tr(locale, "검토 대기", "Sẵn sàng kiểm tra");
    case "reviewing":
      return tr(locale, "검토 중", "Đang kiểm tra");
    case "revisions_required":
      return tr(locale, "수정 필요", "Cần chỉnh sửa");
    case "submitted":
      return tr(locale, "대학 제출 완료", "Đã nộp trường");
    case "accepted":
      return tr(locale, "합격", "Đã trúng tuyển");
    case "rejected":
      return tr(locale, "불합격", "Bị từ chối");
    case "enrolled":
      return tr(locale, "입학 완료", "Đã nhập học");
    case "cancelled":
      return tr(locale, "취소됨", "Đã hủy");
    default:
      return status;
  }
}

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await verifyCenterSession();
  const locale = await getLocale();
  const supabase = await createCenterClient();
  const dateLocale = locale === "ko" ? "ko-KR" : "vi-VN";

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
    <div className="space-y-6">
      {/* 학생 기본 정보 */}
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            {tr(locale, "기본 정보", "Thông tin cơ bản")}
          </h2>
          <Link
            href={`/center/students/${id}/edit`}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            {tr(locale, "편집", "Sửa")}
          </Link>
        </div>
        <p className="mb-4 text-xs text-slate-500">
          {tr(locale, "등록일", "Đăng ký")}:{" "}
          {new Date(student.created_at).toLocaleDateString(dateLocale)}
        </p>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
          <Field label={tr(locale, "생년월일", "Ngày sinh")} value={student.dob} />
          <Field
            label={tr(locale, "여권번호", "Số hộ chiếu")}
            value={student.passport_no_encrypted}
          />
          <Field
            label={tr(locale, "전화번호", "Số điện thoại")}
            value={student.phone}
          />
          <Field label="Email" value={student.email} />
          <Field
            label="TOPIK"
            value={
              student.topik_level
                ? tr(locale, `${student.topik_level}급`, `Cấp ${student.topik_level}`)
                : null
            }
          />
          <Field
            label={tr(locale, "현재 비자", "Visa hiện tại")}
            value={
              student.current_visa
                ? visaLabel(locale, student.current_visa)
                : null
            }
          />
          <Field
            label={tr(locale, "위치", "Vị trí")}
            value={
              student.location
                ? locationLabel(locale, student.location)
                : null
            }
          />
        </dl>
        {student.notes ? (
          <div className="mt-4 border-t border-slate-200 pt-4">
            <dt className="text-xs uppercase tracking-wide text-slate-500">
              {tr(locale, "메모", "Ghi chú")}
            </dt>
            <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-800">
              {student.notes}
            </dd>
          </div>
        ) : null}
      </section>

      {/* 대학 정보 (요약) — 관리는 '대학 선택' 탭 */}
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <header className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            {tr(locale, "대학 정보", "Thông tin trường")}
          </h2>
          <Link
            href={`/center/students/${id}/select`}
            className="shrink-0 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            {tr(locale, "대학 선택 →", "Chọn trường →")}
          </Link>
        </header>

        {!applications || applications.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
            {tr(
              locale,
              "아직 선택한 대학이 없습니다. '대학 선택'에서 모집 중인 대학·학과를 선택하세요.",
              "Chưa chọn trường. Hãy chọn trường·ngành đang tuyển ở 'Chọn trường'."
            )}
          </div>
        ) : (
          <ul className="divide-y divide-slate-200">
            {applications.map((app) => (
              <li
                key={app.id}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium text-slate-900">
                    {app.target_department_label ?? "—"}
                  </div>
                  {app.next_deadline ? (
                    <div className="text-xs text-slate-500">
                      {tr(
                        locale,
                        `마감 ${new Date(app.next_deadline).toLocaleDateString(dateLocale)}`,
                        `Hạn ${new Date(app.next_deadline).toLocaleDateString(dateLocale)}`
                      )}
                    </div>
                  ) : null}
                </div>
                <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                  {appStatusLabel(locale, app.status)}
                </span>
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

