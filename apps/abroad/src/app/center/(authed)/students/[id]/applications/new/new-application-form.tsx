"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";

import { tr, type Locale } from "@/lib/i18n";

import {
  createApplicationAction,
  type CreateApplicationState,
} from "./actions";

export type SpecOption = {
  id: string;
  universityNameKo: string | null;
  term: string;
  admissionCategory: string | null;
  programType: string;
  departments: Array<{
    name: string;
    faculty?: string | null;
    track?: string | null;
  }>;
};

/** 모집 중(published) offering — 지원 가능 = 모집요강(source_spec_id) 연결됨 */
export type OfferingOption = {
  id: string;
  sourceSpecId: string;
  universityNameKo: string | null;
  departmentId: number;
  departmentNameKo: string;
  term: string;
  intakeQuota: number | null;
  availableLanguages: string[];
};

function programTypeLabel(locale: Locale, programType: string): string {
  switch (programType) {
    case "language_program":
      return tr(locale, "어학연수 (D-4)", "Khóa tiếng (D-4)");
    case "associate_2yr":
      return tr(locale, "전문학사 2년", "Cao đẳng 2 năm");
    case "bachelor_3yr_extension":
      return tr(locale, "학사 편입 2+2", "Liên thông 2+2");
    case "bachelor_4yr":
      return tr(locale, "학사 4년", "Cử nhân 4 năm");
    default:
      return programType;
  }
}

function languageLabel(locale: Locale, lang: string): string {
  switch (lang) {
    case "korean":
      return tr(locale, "한국어", "Tiếng Hàn");
    case "english":
      return tr(locale, "영어", "Tiếng Anh");
    case "other":
      return tr(locale, "기타", "Khác");
    default:
      return lang;
  }
}


const inputClass =
  "rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200";
const labelClass = "flex flex-col gap-1.5";
const labelTextClass = "text-sm font-medium text-slate-700";
const requiredMarkClass = "ml-0.5 text-red-500";
const errorTextClass = "text-xs text-red-600";
const helpTextClass = "text-xs text-slate-500";

function departmentLabel(d: SpecOption["departments"][number]): string {
  if (!d) return "";
  const parts: string[] = [];
  if (d.faculty) parts.push(d.faculty);
  parts.push(d.name);
  return d.track ? `${parts.join(" · ")} (${d.track})` : parts.join(" · ");
}

export function NewApplicationForm({
  locale,
  studentId,
  studentName,
  specs,
  offerings,
}: {
  locale: Locale;
  studentId: string;
  studentName: string;
  specs: SpecOption[];
  offerings: OfferingOption[];
}) {
  const boundAction = createApplicationAction.bind(null, studentId);
  const [state, action, pending] = useActionState<
    CreateApplicationState,
    FormData
  >(boundAction, undefined);

  const hasOfferings = offerings.length > 0;
  // 모집(offering)이 있으면 그것을 기본 경로로. 없으면 모집요강 직접 선택으로 폴백.
  const [mode, setMode] = useState<"offering" | "spec">(
    hasOfferings ? "offering" : "spec"
  );

  // --- offering 모드 상태 ---
  const [offeringId, setOfferingId] = useState<string>("");
  const selectedOffering = useMemo(
    () => offerings.find((o) => o.id === offeringId),
    [offeringId, offerings]
  );
  const [selectedLanguage, setSelectedLanguage] = useState<string>("");
  const onOfferingChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setOfferingId(id);
    const o = offerings.find((x) => x.id === id);
    // 언어 1개면 자동 선택, 여러 개면 미선택
    setSelectedLanguage(
      o && o.availableLanguages.length === 1 ? o.availableLanguages[0] : ""
    );
  };

  // --- spec 모드 상태 ---
  const [specId, setSpecId] = useState<string>("");
  const selectedSpec = useMemo(
    () => specs.find((s) => s.id === specId),
    [specId, specs]
  );
  const [deptLabel, setDeptLabel] = useState<string>("");
  const onSpecChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSpecId(id);
    const spec = specs.find((s) => s.id === id);
    setDeptLabel(spec && spec.departments.length > 0 ? departmentLabel(spec.departments[0]) : "");
  };

  const fieldError = (name: string) => state?.fieldErrors?.[name]?.[0];

  // 선택 결과 → insert 에 들어갈 값
  const submitSpecId =
    mode === "offering" ? selectedOffering?.sourceSpecId ?? "" : specId;
  const submitDeptLabel =
    mode === "offering" ? selectedOffering?.departmentNameKo ?? "" : deptLabel;
  const submitDeptId =
    mode === "offering" && selectedOffering
      ? String(selectedOffering.departmentId)
      : "";
  const submitOfferingId = mode === "offering" ? offeringId : "";

  const canSubmit =
    mode === "offering"
      ? !!offeringId && !!selectedLanguage
      : !!specId && !!deptLabel;

  // 아무 데이터도 없음
  if (!hasOfferings && specs.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 p-8 text-center">
        <p className="text-sm text-slate-600">
          {tr(
            locale,
            "현재 모집 중인 학과가 없습니다.",
            "Hiện chưa có ngành nào đang tuyển sinh."
          )}
        </p>
        <p className="mt-2 text-xs text-slate-500">
          {tr(
            locale,
            "GLOCARE에서 모집을 준비 중입니다. 잠시 후 다시 시도해 주세요.",
            "GLOCARE đang chuẩn bị. Vui lòng thử lại sau."
          )}
        </p>
        <Link
          href={`/center/students/${studentId}`}
          className="mt-4 inline-block text-sm text-slate-700 underline"
        >
          {tr(locale, "← 돌아가기", "← Quay lại")}
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="admission_spec_id" value={submitSpecId} />
      <input type="hidden" name="offering_id" value={submitOfferingId} />
      <input type="hidden" name="target_department_id" value={submitDeptId} />
      <input
        type="hidden"
        name="target_department_label"
        value={submitDeptLabel}
      />
      <input
        type="hidden"
        name="selected_language"
        value={mode === "offering" ? selectedLanguage : ""}
      />

      {mode === "offering" ? (
        <>
        <label className={labelClass}>
          <span className={labelTextClass}>
            {tr(locale, "희망 학과 (모집 중)", "Ngành nguyện vọng (đang tuyển)")}
            <span className={requiredMarkClass}>*</span>
          </span>
          <select
            required
            className={inputClass}
            value={offeringId}
            onChange={onOfferingChange}
          >
            <option value="">
              {tr(locale, "— 대학 · 학과 · 학기 선택 —", "— Chọn trường · ngành · học kỳ —")}
            </option>
            {offerings.map((o) => (
              <option key={o.id} value={o.id}>
                {o.universityNameKo ?? "?"} · {o.departmentNameKo} · {o.term}
                {o.intakeQuota != null
                  ? ` · ${tr(locale, "모집", "tuyển")} ${o.intakeQuota}${tr(locale, "명", " SV")}`
                  : ""}
              </option>
            ))}
          </select>
          {specs.length > 0 ? (
            <button
              type="button"
              onClick={() => setMode("spec")}
              className="self-start text-xs text-slate-500 underline hover:text-slate-700"
            >
              {tr(
                locale,
                "원하는 학과가 없나요? 모집요강에서 직접 선택",
                "Không thấy ngành mong muốn? Chọn trực tiếp từ hồ sơ tuyển sinh"
              )}
            </button>
          ) : null}
          {fieldError("admission_spec_id") ? (
            <span className={errorTextClass}>
              {fieldError("admission_spec_id")}
            </span>
          ) : null}
        </label>

        {selectedOffering ? (
          <label className={labelClass}>
            <span className={labelTextClass}>
              {tr(locale, "어학 능력", "Năng lực ngoại ngữ")}
              <span className={requiredMarkClass}>*</span>
            </span>
            {selectedOffering.availableLanguages.length > 1 ? (
              <select
                required
                className={inputClass}
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
              >
                <option value="">{tr(locale, "— 선택 —", "— Chọn —")}</option>
                {selectedOffering.availableLanguages.map((l) => (
                  <option key={l} value={l}>
                    {languageLabel(locale, l)}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                className={inputClass + " bg-slate-50"}
                value={
                  selectedLanguage ? languageLabel(locale, selectedLanguage) : ""
                }
                readOnly
              />
            )}
          </label>
        ) : null}

        </>
      ) : (
        <>
          <label className={labelClass}>
            <span className={labelTextClass}>
              {tr(locale, "모집요강", "Hồ sơ tuyển sinh")}
              <span className={requiredMarkClass}>*</span>
            </span>
            <select
              required
              className={inputClass}
              value={specId}
              onChange={onSpecChange}
            >
              <option value="">
                {tr(locale, "— 대학 · 과정 선택 —", "— Chọn trường · chương trình —")}
              </option>
              {specs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.universityNameKo ?? "?"} · {programTypeLabel(locale, s.programType)} · {s.term}
                </option>
              ))}
            </select>
            {hasOfferings ? (
              <button
                type="button"
                onClick={() => setMode("offering")}
                className="self-start text-xs text-slate-500 underline hover:text-slate-700"
              >
                {tr(locale, "← 모집 중 학과에서 선택", "← Chọn từ ngành đang tuyển")}
              </button>
            ) : null}
            {fieldError("admission_spec_id") ? (
              <span className={errorTextClass}>
                {fieldError("admission_spec_id")}
              </span>
            ) : null}
          </label>

          {selectedSpec ? (
            <label className={labelClass}>
              <span className={labelTextClass}>
                {tr(locale, "학과 · 전공", "Ngành · chuyên ngành")}
                <span className={requiredMarkClass}>*</span>
              </span>
              {selectedSpec.departments.length > 1 ? (
                <select
                  required
                  className={inputClass}
                  value={deptLabel}
                  onChange={(e) => setDeptLabel(e.target.value)}
                >
                  <option value="">{tr(locale, "— 학과 선택 —", "— Chọn ngành —")}</option>
                  {selectedSpec.departments.map((d) => {
                    const label = departmentLabel(d);
                    return (
                      <option key={label} value={label}>
                        {label}
                      </option>
                    );
                  })}
                </select>
              ) : (
                <input
                  type="text"
                  className={inputClass + " bg-slate-50"}
                  value={deptLabel}
                  readOnly
                />
              )}
              {fieldError("target_department_label") ? (
                <span className={errorTextClass}>
                  {fieldError("target_department_label")}
                </span>
              ) : null}
            </label>
          ) : null}
        </>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <label className={labelClass}>
          <span className={labelTextClass}>{tr(locale, "다음 할 일", "Việc tiếp theo")}</span>
          <input
            type="text"
            name="next_action"
            maxLength={200}
            className={inputClass}
            placeholder={tr(locale, "예: 추천서 받기", "VD: Nhận thư giới thiệu")}
          />
          <span className={helpTextClass}>{tr(locale, "선택", "Tùy chọn")}</span>
        </label>

        <label className={labelClass}>
          <span className={labelTextClass}>{tr(locale, "마감일", "Hạn chót")}</span>
          <input
            type="date"
            name="next_deadline"
            className={inputClass}
          />
          <span className={helpTextClass}>{tr(locale, "선택", "Tùy chọn")}</span>
        </label>
      </div>

      <div className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
        {tr(locale, "초기 상태", "Trạng thái ban đầu")}:{" "}
        <strong>{tr(locale, "준비 중", "Đang chuẩn bị")}</strong>{" "}
        {tr(
          locale,
          "(서류 검토 시 업데이트됩니다)",
          "(sẽ cập nhật khi kiểm tra hồ sơ)"
        )}
      </div>

      {state?.error ? (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}

      <div className="mt-2 flex items-center gap-2">
        <button
          type="submit"
          disabled={pending || !canSubmit}
          className="rounded-md bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending
            ? tr(locale, "저장 중...", "Đang lưu...")
            : tr(
                locale,
                `${studentName} 지원 등록`,
                `Đăng ký nguyện vọng cho ${studentName}`
              )}
        </button>
        <Link
          href={`/center/students/${studentId}`}
          className="rounded-md border border-slate-300 px-5 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          {tr(locale, "취소", "Hủy")}
        </Link>
      </div>
    </form>
  );
}
