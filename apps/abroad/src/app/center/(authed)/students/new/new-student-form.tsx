"use client";

import Link from "next/link";
import { useActionState, useState, useTransition, type FormEvent, type ReactNode } from "react";

import { tr, type Locale } from "@/lib/i18n";
import {
  BACHELOR_FIELD_IDS,
  REG_FIELDS,
  REG_SECTIONS,
  optionsFor,
  type RegOption,
} from "@/lib/center/students/registration";
import { sumOrNull } from "@/lib/center/student-roster-columns";

import { createStudentAction, type CreateStudentState } from "./actions";

const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200";
const labelClass = "flex flex-col gap-1.5";
const labelTextClass = "text-sm font-medium text-slate-700";
const requiredMarkClass = "ml-0.5 text-red-500";
const errorTextClass = "text-xs text-red-600";
const helpTextClass = "text-xs text-slate-500";

/** 칸별 placeholder */
const PLACEHOLDER: Record<string, string> = {
  name: "Nguyễn Văn A",
  full_name_en: "NGUYEN VAN A",
  passport_no: "B12345678",
  student_phone: "0901 234 567",
  student_email: "sinhvien@example.com",
  national_id_no: "0xx xxx xxx xxx",
};

/** 화면에서 계산만 하는 값 (저장 안 함) */
const WATCHED = [
  "final_education_level",
  "hs_absence_1",
  "hs_absence_2",
  "hs_absence_3",
  "father_monthly_income",
  "mother_monthly_income",
];

export function NewStudentForm({
  locale,
  centers,
  terms,
}: {
  locale: Locale;
  /** 글로케어(본사) 계정일 때만 전달됨 — 학생을 배정할 유학센터 마스터 목록. */
  centers?: { id: number; name: string }[] | null;
  /** 지원 학기 선택지 ("2027-Spring" …) — 서버에서 계산해 넘긴다 */
  terms: RegOption[];
}) {
  const [state, dispatch, pending] = useActionState<CreateStudentState, FormData>(
    createStudentAction,
    undefined
  );
  const [, startTransition] = useTransition();
  const [watched, setWatched] = useState<Record<string, string>>({});

  const fieldError = (name: string) => state?.fieldErrors?.[name]?.[0];
  const isGlocare = centers != null;

  const level = watched.final_education_level ?? "";
  const usesBachelor = level === "college" || level === "university";
  const absenceTotal = sumOrNull([watched.hs_absence_1, watched.hs_absence_2, watched.hs_absence_3]);
  const incomeTotal = sumOrNull([watched.father_monthly_income, watched.mother_monthly_income]);

  // form action 대신 onSubmit → 제출 후 입력값이 지워지지 않게 (React 19 form action 은 자동 reset)
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => dispatch(fd));
  }

  function onChange(e: FormEvent<HTMLFormElement>) {
    const t = e.target as HTMLInputElement | HTMLSelectElement;
    if (t?.name && WATCHED.includes(t.name)) {
      setWatched((cur) => ({ ...cur, [t.name]: t.value }));
    }
  }

  function renderField(id: string) {
    const f = REG_FIELDS[id];
    if (!f) return null;
    if (!usesBachelor && (BACHELOR_FIELD_IDS as readonly string[]).includes(id)) return null;

    const label = tr(locale, f.ko, f.vi);
    const err = fieldError(id);
    const opts = id === "desired_term" ? terms : optionsFor(id);

    let control: ReactNode;
    if (opts) {
      control = (
        <select name={id} required={f.required} defaultValue="" className={inputClass}>
          <option value="">
            {f.required ? tr(locale, "— 선택 —", "— Chọn —") : tr(locale, "선택 안 함", "Chưa chọn")}
          </option>
          {opts.map((o) => (
            <option key={o.value} value={o.value}>
              {tr(locale, o.ko, o.vi)}
            </option>
          ))}
        </select>
      );
    } else if (f.input === "date") {
      control = (
        <input type="date" min="1900-01-01" max="2100-12-31" name={id} required={f.required} className={inputClass} />
      );
    } else if (f.input === "number") {
      control = <input type="text" inputMode="decimal" name={id} required={f.required} className={inputClass} />;
    } else {
      control = (
        <input
          type={id === "student_email" ? "email" : id.endsWith("_phone") || id.endsWith("_contact") ? "tel" : "text"}
          name={id}
          required={f.required}
          maxLength={id === "name" ? 100 : 200}
          placeholder={PLACEHOLDER[id]}
          className={inputClass}
        />
      );
    }

    return (
      <label key={id} className={labelClass}>
        <span className={labelTextClass}>
          {label}
          {f.required ? <span className={requiredMarkClass}>*</span> : null}
        </span>
        {control}
        {err ? (
          <span className={errorTextClass}>{err}</span>
        ) : id === "passport_no" ? (
          <span className={helpTextClass}>{tr(locale, "4–20자, 영문·숫자", "4–20 ký tự, chữ và số")}</span>
        ) : id === "student_email" ? (
          <span className={helpTextClass}>
            {tr(locale, "학생에게 메일을 보내지 않습니다 — 정보 저장용", "Hệ thống không gửi thư cho sinh viên — chỉ lưu thông tin")}
          </span>
        ) : null}
      </label>
    );
  }

  function computed(label: string, value: number | null) {
    return (
      <div className={labelClass}>
        <span className={labelTextClass}>{label}</span>
        <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {value === null ? "—" : value.toLocaleString()}
        </div>
        <span className={helpTextClass}>{tr(locale, "자동 계산", "Tự động tính")}</span>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} onChange={onChange} className="flex flex-col gap-6">
      {/* 글로케어(본사) 전용 — 소속 유학센터 선택 (필수) */}
      {isGlocare ? (
        <label className={`${labelClass} rounded-md border border-amber-300 bg-amber-50 p-3`}>
          <span className={labelTextClass}>
            {tr(locale, "소속 유학센터", "Trung tâm du học phụ trách")}
            <span className={requiredMarkClass}>*</span>
          </span>
          <select name="target_study_center_id" required defaultValue="" className={inputClass}>
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
            <span className={errorTextClass}>{fieldError("target_study_center_id")}</span>
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
              {tr(locale, "배정 가능한 유학센터가 없습니다.", "Chưa có trung tâm nào.")}
            </span>
          ) : null}
        </label>
      ) : null}

      <p className="text-xs text-slate-500">
        <span className={requiredMarkClass}>*</span>{" "}
        {tr(
          locale,
          "표시 항목은 필수입니다. 나머지는 나중에 '정보 입력'에서 채워도 됩니다. 여기 입력한 값은 작성서류에 그대로 쓰입니다.",
          "Mục có dấu * là bắt buộc. Các mục khác có thể điền sau ở 'Nhập thông tin'. Giá trị nhập ở đây được dùng luôn cho hồ sơ."
        )}
      </p>

      {REG_SECTIONS.map((sec) => (
        <fieldset key={sec.id} className="rounded-lg border border-slate-200 p-4">
          <legend className="px-1 text-sm font-semibold text-slate-900">{tr(locale, sec.ko, sec.vi)}</legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {sec.fields.map((id) => renderField(id))}

            {sec.id === "basic" ? (
              <>
                {/* 현재 비자 · 위치 — study_managed_students 기존 칸 */}
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
                <label className={labelClass}>
                  <span className={labelTextClass}>{tr(locale, "현재 위치", "Vị trí hiện tại")}</span>
                  <select name="location" className={inputClass} defaultValue="">
                    <option value="">{tr(locale, "없음", "Chưa có")}</option>
                    <option value="VN">{tr(locale, "베트남", "Việt Nam")}</option>
                    <option value="KR">{tr(locale, "한국", "Hàn Quốc")}</option>
                    <option value="other">{tr(locale, "기타", "Khác")}</option>
                  </select>
                </label>
              </>
            ) : null}

            {sec.id === "education"
              ? computed(tr(locale, "결석일수 합계", "Tổng số buổi nghỉ"), absenceTotal)
              : null}
            {sec.id === "finance" ? computed(tr(locale, "월수입 합계", "Tổng thu nhập hàng tháng"), incomeTotal) : null}
          </div>
          {sec.id === "education" && !usesBachelor ? (
            <p className={`${helpTextClass} mt-3`}>
              {tr(
                locale,
                "최종학력이 전문대·대학 졸업이면 대학 정보 칸이 나타납니다.",
                "Nếu học lực cao nhất là CĐ / ĐH, các ô thông tin trường CĐ / ĐH sẽ hiện ra."
              )}
            </p>
          ) : null}
        </fieldset>
      ))}

      {/* 메모 */}
      <label className={labelClass}>
        <span className={labelTextClass}>{tr(locale, "메모", "Ghi chú")}</span>
        <textarea
          name="notes"
          maxLength={500}
          rows={3}
          className={inputClass}
          placeholder={tr(locale, "유학 목표, 특이사항 등", "Mục tiêu du học, lưu ý đặc biệt, v.v.")}
        />
        {fieldError("notes") ? (
          <span className={errorTextClass}>{fieldError("notes")}</span>
        ) : (
          <span className={helpTextClass}>{tr(locale, "최대 500자", "Tối đa 500 ký tự")}</span>
        )}
      </label>

      {state?.error ? (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>
      ) : null}

      <div className="mt-2 flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? tr(locale, "저장 중...", "Đang lưu...") : tr(locale, "학생 등록", "Đăng ký sinh viên")}
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
