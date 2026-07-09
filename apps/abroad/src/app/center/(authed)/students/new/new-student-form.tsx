"use client";

import Link from "next/link";
import { useActionState } from "react";

import { tr, type Locale } from "@/lib/i18n";

import { createStudentAction, type CreateStudentState } from "./actions";

const inputClass =
  "rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200";
const labelClass = "flex flex-col gap-1.5";
const labelTextClass = "text-sm font-medium text-slate-700";
const requiredMarkClass = "ml-0.5 text-red-500";
const errorTextClass = "text-xs text-red-600";
const helpTextClass = "text-xs text-slate-500";

export function NewStudentForm({
  locale,
  centers,
}: {
  locale: Locale;
  /** 글로케어(본사) 계정일 때만 전달됨 — 학생을 배정할 유학센터 마스터 목록. */
  centers?: { id: number; name: string }[] | null;
}) {
  const [state, action, pending] = useActionState<CreateStudentState, FormData>(
    createStudentAction,
    undefined
  );

  const fieldError = (name: string) => state?.fieldErrors?.[name]?.[0];
  const isGlocare = centers != null;

  return (
    <form action={action} className="flex flex-col gap-5">
      {/* 글로케어(본사) 전용 — 소속 유학센터 선택 (필수) */}
      {isGlocare ? (
        <label className={`${labelClass} rounded-md border border-amber-300 bg-amber-50 p-3`}>
          <span className={labelTextClass}>
            {tr(locale, "소속 유학센터", "Trung tâm du học phụ trách")}
            <span className={requiredMarkClass}>*</span>
          </span>
          <select
            name="target_study_center_id"
            required
            defaultValue=""
            className={inputClass}
          >
            <option value="" disabled>
              {tr(locale, "— 유학센터 선택 —", "— Chọn trung tâm —")}
            </option>
            {centers!.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name}
              </option>
            ))}
          </select>
          {fieldError("target_study_center_id") ? (
            <span className={errorTextClass}>
              {fieldError("target_study_center_id")}
            </span>
          ) : (
            <span className={helpTextClass}>
              {tr(
                locale,
                "글로케어가 섭외한 학생을 어느 유학센터로 연결할지 선택하세요. 이후 관리는 해당 센터가 맡습니다.",
                "Chọn trung tâm sẽ phụ trách sinh viên do Glocare giới thiệu. Sau đó trung tâm đó sẽ quản lý."
              )}
            </span>
          )}
          {centers!.length === 0 ? (
            <span className={errorTextClass}>
              {tr(
                locale,
                "배정 가능한 유학센터가 없습니다.",
                "Chưa có trung tâm nào."
              )}
            </span>
          ) : null}
        </label>
      ) : null}

      {/* 이름 — 필수 */}
      <label className={labelClass}>
        <span className={labelTextClass}>
          {tr(locale, "이름", "Họ và tên")}
          <span className={requiredMarkClass}>*</span>
        </span>
        <input
          type="text"
          name="name"
          required
          maxLength={100}
          className={inputClass}
          placeholder="Nguyễn Văn A"
        />
        {fieldError("name") ? (
          <span className={errorTextClass}>{fieldError("name")}</span>
        ) : null}
      </label>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {/* 생년월일 */}
        <label className={labelClass}>
          <span className={labelTextClass}>{tr(locale, "생년월일", "Ngày sinh")}</span>
          <input
            type="date"
            name="dob"
            className={inputClass}
          />
          {fieldError("dob") ? (
            <span className={errorTextClass}>{fieldError("dob")}</span>
          ) : null}
        </label>

        {/* 여권번호 */}
        <label className={labelClass}>
          <span className={labelTextClass}>{tr(locale, "여권번호", "Số hộ chiếu")}</span>
          <input
            type="text"
            name="passport_no"
            className={inputClass}
            placeholder="B12345678"
          />
          {fieldError("passport_no") ? (
            <span className={errorTextClass}>{fieldError("passport_no")}</span>
          ) : (
            <span className={helpTextClass}>
              {tr(locale, "4–20자, 영문·숫자", "4–20 ký tự, chữ và số")}
            </span>
          )}
        </label>

        {/* 전화 */}
        <label className={labelClass}>
          <span className={labelTextClass}>{tr(locale, "전화번호", "Số điện thoại")}</span>
          <input
            type="tel"
            name="phone"
            className={inputClass}
            placeholder="+84 90 ..."
          />
          {fieldError("phone") ? (
            <span className={errorTextClass}>{fieldError("phone")}</span>
          ) : null}
        </label>

        {/* 이메일 */}
        <label className={labelClass}>
          <span className={labelTextClass}>
            {tr(locale, "이메일 (학생)", "Email (sinh viên)")}
          </span>
          <input
            type="email"
            name="email"
            className={inputClass}
            placeholder="sinhvien@example.com"
          />
          {fieldError("email") ? (
            <span className={errorTextClass}>{fieldError("email")}</span>
          ) : (
            <span className={helpTextClass}>
              {tr(
                locale,
                "학생에게 메일을 보내지 않습니다 — 정보 저장용",
                "Hệ thống không gửi thư cho sinh viên — chỉ lưu thông tin"
              )}
            </span>
          )}
        </label>

        {/* TOPIK */}
        <label className={labelClass}>
          <span className={labelTextClass}>{tr(locale, "TOPIK (급수)", "TOPIK (cấp độ)")}</span>
          <select name="topik_level" className={inputClass} defaultValue="">
            <option value="">{tr(locale, "없음", "Chưa có")}</option>
            <option value="1">{tr(locale, "1급", "Cấp 1")}</option>
            <option value="2">{tr(locale, "2급", "Cấp 2")}</option>
            <option value="3">{tr(locale, "3급", "Cấp 3")}</option>
            <option value="4">{tr(locale, "4급", "Cấp 4")}</option>
            <option value="5">{tr(locale, "5급", "Cấp 5")}</option>
            <option value="6">{tr(locale, "6급", "Cấp 6")}</option>
          </select>
        </label>

        {/* Visa */}
        <label className={labelClass}>
          <span className={labelTextClass}>{tr(locale, "현재 비자", "Visa hiện tại")}</span>
          <select name="current_visa" className={inputClass} defaultValue="">
            <option value="">{tr(locale, "없음", "Chưa có")}</option>
            <option value="D-4">{tr(locale, "D-4 (어학연수)", "D-4 (Khóa tiếng)")}</option>
            <option value="D-2">{tr(locale, "D-2 (정규유학)", "D-2 (Du học)")}</option>
            <option value="none">{tr(locale, "비자 없음", "Không có")}</option>
            <option value="other">{tr(locale, "기타", "Khác")}</option>
          </select>
        </label>

        {/* Location */}
        <label className={labelClass}>
          <span className={labelTextClass}>{tr(locale, "현재 위치", "Vị trí hiện tại")}</span>
          <select name="location" className={inputClass} defaultValue="">
            <option value="">{tr(locale, "없음", "Chưa có")}</option>
            <option value="VN">{tr(locale, "베트남", "Việt Nam")}</option>
            <option value="KR">{tr(locale, "한국", "Hàn Quốc")}</option>
            <option value="other">{tr(locale, "기타", "Khác")}</option>
          </select>
        </label>
      </div>

      {/* 메모 */}
      <label className={labelClass}>
        <span className={labelTextClass}>{tr(locale, "메모", "Ghi chú")}</span>
        <textarea
          name="notes"
          maxLength={500}
          rows={3}
          className={inputClass}
          placeholder={tr(
            locale,
            "유학 목표, 특이사항 등",
            "Mục tiêu du học, lưu ý đặc biệt, v.v."
          )}
        />
        {fieldError("notes") ? (
          <span className={errorTextClass}>{fieldError("notes")}</span>
        ) : (
          <span className={helpTextClass}>{tr(locale, "최대 500자", "Tối đa 500 ký tự")}</span>
        )}
      </label>

      {state?.error ? (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}

      <div className="mt-2 flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending
            ? tr(locale, "저장 중...", "Đang lưu...")
            : tr(locale, "학생 등록", "Đăng ký sinh viên")}
        </button>
        <Link
          href="/center/students"
          className="rounded-md border border-slate-300 px-5 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          {tr(locale, "취소", "Hủy")}
        </Link>
      </div>
    </form>
  );
}
