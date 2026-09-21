"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";

import { tr, type Locale } from "@/lib/i18n";

import { formatOfferingQuota } from "@/app/center/(authed)/admissions/quota-label";

import { MAX_PRIORITY, priorityLabel, priorityTone } from "../priority";
import {
  createApplicationAction,
  type CreateApplicationState,
} from "./actions";

/** 모집요강 직접 선택용 — 요강(대학) + 학과(어학당 포함) + 학기 */
export type SpecOption = {
  id: string;
  universityNameKo: string | null;
  /** 화면 표시용 — 베트남어 화면이면 name_vi(없으면 한국어) */
  universityName: string | null;
  admissionCategory: string | null;
  terms: string[];
  departments: Array<{
    departmentId: number;
    /** 저장값(target_department_label) — 한국어 학과명, 번역 금지 */
    nameKo: string;
    /** 화면 표시용 학과명 */
    name: string;
    kind: "language" | "regular";
    availableLanguages: string[];
  }>;
};

/** 모집 중(published) offering — 지원 가능 = 모집요강(source_spec_id) 연결됨 */
export type OfferingOption = {
  id: string;
  sourceSpecId: string;
  universityNameKo: string | null;
  /** 화면 표시용 — 베트남어 화면이면 name_vi(없으면 한국어) */
  universityName: string | null;
  departmentId: number;
  /** 저장값(target_department_label) — 옛 코드가 한국어로 비교하므로 번역 금지 */
  departmentNameKo: string;
  /** 화면 표시용 학과명 */
  departmentName: string;
  term: string;
  /** 글로케어 모집 인원 */
  intakeQuota: number | null;
  /** 학교 전체 정원 (0069) */
  totalQuota: number | null;
  sortOrder: number;
  availableLanguages: string[];
};

/** 학기별 이 학생의 (취소 안 된) 기존 지원 — 남은 지망 수·이미 지원한 모집 */
export type ExistingByTerm = Record<string, { count: number; offeringIds: string[] }>;

type Choice = { offeringId: string; language: string };

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

function kindLabel(locale: Locale, kind: "language" | "regular"): string {
  return kind === "language"
    ? tr(locale, "어학당", "Khóa tiếng")
    : tr(locale, "정규", "Chính quy");
}

const inputClass =
  "rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200";
const smallBtnClass =
  "rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30";
const labelClass = "flex flex-col gap-1.5";
const labelTextClass = "text-sm font-medium text-slate-700";
const requiredMarkClass = "ml-0.5 text-red-500";
const errorTextClass = "text-xs text-red-600";

export function NewApplicationForm({
  locale,
  studentId,
  specs,
  offerings,
  existingByTerm,
}: {
  locale: Locale;
  studentId: string;
  specs: SpecOption[];
  offerings: OfferingOption[];
  existingByTerm: ExistingByTerm;
}) {
  const boundAction = createApplicationAction.bind(null, studentId);
  const [state, action, pending] = useActionState<
    CreateApplicationState,
    FormData
  >(boundAction, undefined);

  const hasOfferings = offerings.length > 0;
  // 언제나 모집(offering)이 기본이다. 예전엔 모집이 비면 자동으로 "모집요강 직접
  // 선택"으로 넘어갔는데, 그러면 승인된 모집요강이 전부(= 모집에 넣지 않은 대학까지)
  // 지원 가능 목록처럼 보였다. 직접 선택은 아래 버튼으로 명시적으로 들어간다.
  const [mode, setMode] = useState<"offering" | "spec">("offering");

  // --- offering 모드 상태: 학기 → 지망(최대 3, 순서 = 지망 순위) ---
  const terms = useMemo(
    () =>
      Array.from(new Set(offerings.map((o) => o.term))).sort((a, b) =>
        b.localeCompare(a)
      ),
    [offerings]
  );
  const [term, setTerm] = useState<string>(terms.length === 1 ? terms[0] : "");
  const [choices, setChoices] = useState<Choice[]>([]);
  const offeringById = useMemo(
    () => new Map(offerings.map((o) => [o.id, o])),
    [offerings]
  );
  const termOfferings = useMemo(
    () =>
      offerings
        .filter((o) => o.term === term)
        .slice()
        .sort(
          (a, b) =>
            (a.universityName ?? a.universityNameKo ?? "").localeCompare(
              b.universityName ?? b.universityNameKo ?? "",
              locale
            ) ||
            a.sortOrder - b.sortOrder ||
            a.departmentName.localeCompare(b.departmentName, locale)
        ),
    [offerings, term, locale]
  );
  const existing = existingByTerm[term] ?? { count: 0, offeringIds: [] };
  const appliedSet = new Set(existing.offeringIds);
  const remaining = Math.max(0, MAX_PRIORITY - existing.count);

  const onTermChange = (v: string) => {
    setTerm(v);
    setChoices([]);
  };
  const addChoice = (o: OfferingOption) => {
    setChoices((prev) =>
      prev.length >= remaining || prev.some((c) => c.offeringId === o.id)
        ? prev
        : [
            ...prev,
            {
              offeringId: o.id,
              // 언어 1개면 자동 선택, 여러 개면 미선택
              language: o.availableLanguages.length === 1 ? o.availableLanguages[0] : "",
            },
          ]
    );
  };
  const removeChoice = (i: number) =>
    setChoices((prev) => prev.filter((_, j) => j !== i));
  const moveChoice = (i: number, delta: -1 | 1) =>
    setChoices((prev) => {
      const j = i + delta;
      if (j < 0 || j >= prev.length) return prev;
      const next = prev.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const setChoiceLanguage = (i: number, language: string) =>
    setChoices((prev) => prev.map((c, j) => (j === i ? { ...c, language } : c)));

  const choicesJson = JSON.stringify(
    choices.map((c) => ({
      offering_id: c.offeringId,
      selected_language: c.language,
      target_department_label: offeringById.get(c.offeringId)?.departmentNameKo ?? "",
    }))
  );

  // --- spec 모드 상태 (요강 → 학과 → 학기) ---
  const [specId, setSpecId] = useState<string>("");
  const selectedSpec = useMemo(
    () => specs.find((s) => s.id === specId),
    [specId, specs]
  );
  const [specDeptId, setSpecDeptId] = useState<string>("");
  const [specTerm, setSpecTerm] = useState<string>("");
  const [specLanguage, setSpecLanguage] = useState<string>("");
  const selectedSpecDept = useMemo(
    () => selectedSpec?.departments.find((d) => String(d.departmentId) === specDeptId),
    [selectedSpec, specDeptId]
  );
  const pickSpecDept = (spec: SpecOption | undefined, deptId: string) => {
    setSpecDeptId(deptId);
    const d = spec?.departments.find((x) => String(x.departmentId) === deptId);
    setSpecLanguage(d && d.availableLanguages.length === 1 ? d.availableLanguages[0] : "");
  };
  const onSpecChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSpecId(id);
    const spec = specs.find((s) => s.id === id);
    pickSpecDept(spec, spec && spec.departments.length === 1 ? String(spec.departments[0].departmentId) : "");
    setSpecTerm(spec && spec.terms.length === 1 ? spec.terms[0] : "");
  };

  const fieldError = (name: string) => state?.fieldErrors?.[name]?.[0];

  const canSubmit =
    mode === "offering"
      ? choices.length > 0 && choices.every((c) => !!c.language)
      : !!specId && !!specDeptId && !!specTerm && !!specLanguage;

  // 모집 중인 학과가 없음 — 승인된 모집요강이 있어도 여기서 멈춘다.
  // 모집요강 전체를 지원 가능 목록처럼 흘려보내지 않기 위해서다.
  if (mode === "offering" && !hasOfferings) {
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
        {specs.length > 0 ? (
          <button
            type="button"
            onClick={() => setMode("spec")}
            className="mt-4 block w-full text-xs text-slate-500 underline hover:text-slate-700"
          >
            {tr(
              locale,
              "모집요강에서 직접 선택 (모집 중이 아닌 학과 포함)",
              "Chọn trực tiếp từ hồ sơ tuyển sinh (gồm cả ngành chưa mở tuyển)"
            )}
          </button>
        ) : null}
        <Link
          href={`/center/students/${studentId}`}
          className="mt-4 inline-block text-sm text-slate-700 underline"
        >
          {tr(locale, "← 돌아가기", "← Quay lại")}
        </Link>
      </div>
    );
  }

  const languageField = (
    languages: string[],
    value: string,
    onChange: (v: string) => void
  ) => (
    <label className={labelClass}>
      <span className={labelTextClass}>
        {tr(locale, "어학 능력", "Năng lực ngoại ngữ")}
        <span className={requiredMarkClass}>*</span>
      </span>
      {languages.length > 1 ? (
        <select
          required
          className={inputClass}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">{tr(locale, "— 선택 —", "— Chọn —")}</option>
          {languages.map((l) => (
            <option key={l} value={l}>
              {languageLabel(locale, l)}
            </option>
          ))}
        </select>
      ) : (
        <input
          type="text"
          className={inputClass + " bg-slate-50"}
          value={value ? languageLabel(locale, value) : ""}
          readOnly
        />
      )}
    </label>
  );

  const offeringTitle = (o: OfferingOption) =>
    `${o.universityName ?? o.universityNameKo ?? "?"} · ${o.departmentName}`;

  return (
    <form action={action} className="flex flex-col gap-5">
      {mode === "offering" ? (
        <input type="hidden" name="choices" value={choicesJson} />
      ) : (
        <>
          <input type="hidden" name="admission_spec_id" value={specId} />
          <input type="hidden" name="offering_id" value="" />
          <input type="hidden" name="target_department_id" value={specDeptId} />
          <input
            type="hidden"
            name="target_department_label"
            value={selectedSpecDept?.nameKo ?? ""}
          />
          <input type="hidden" name="term" value={specTerm} />
          <input type="hidden" name="selected_language" value={specLanguage} />
        </>
      )}

      {mode === "offering" ? (
        <>
          {/* 1. 학기 */}
          <label className={labelClass}>
            <span className={labelTextClass}>
              {tr(locale, "지원 학기", "Học kỳ đăng ký")}
              <span className={requiredMarkClass}>*</span>
            </span>
            <select
              required
              className={inputClass}
              value={term}
              onChange={(e) => onTermChange(e.target.value)}
            >
              <option value="">{tr(locale, "— 학기 선택 —", "— Chọn học kỳ —")}</option>
              {terms.map((t) => (
                <option key={t} value={t}>
                  {t}
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
          </label>

          {term ? (
            <>
              {/* 2. 고른 지망 (순서 = 지망 순위) */}
              <div className={labelClass}>
                <span className={labelTextClass}>
                  {tr(locale, "지망 순위", "Thứ tự nguyện vọng")}
                  <span className={requiredMarkClass}>*</span>
                </span>
                <p className="text-xs text-slate-500">
                  {tr(
                    locale,
                    `아래 목록에서 고른 순서가 1지망 · 2지망 · 3지망이 됩니다 (학기당 최대 ${MAX_PRIORITY}개, 같은 대학의 다른 학과도 각각 1개로 셉니다). ↑/↓ 로 순서를 바꿀 수 있습니다. 결제는 지망마다 따로 진행됩니다.`,
                    `Thứ tự chọn bên dưới sẽ là Nguyện vọng 1 · 2 · 3 (tối đa ${MAX_PRIORITY} mỗi học kỳ; các ngành khác nhau của cùng một trường tính riêng). Dùng ↑/↓ để đổi thứ tự. Mỗi nguyện vọng được thanh toán riêng.`
                  )}
                </p>
                {existing.count > 0 ? (
                  <p className="text-xs text-amber-700">
                    {tr(
                      locale,
                      `이 학생은 ${term} 학기에 이미 ${existing.count}개 지원했습니다. 새 지망은 ${existing.count + 1}지망부터 매겨집니다.`,
                      `Sinh viên đã có ${existing.count} nguyện vọng ở học kỳ ${term}. Nguyện vọng mới bắt đầu từ Nguyện vọng ${existing.count + 1}.`
                    )}
                  </p>
                ) : null}

                {remaining === 0 ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    {tr(
                      locale,
                      `이 학기에는 이미 지망 ${MAX_PRIORITY}개가 모두 찼습니다. 기존 지원을 취소하거나 다른 학기를 고르세요.`,
                      `Học kỳ này đã đủ ${MAX_PRIORITY} nguyện vọng. Hãy hủy nguyện vọng cũ hoặc chọn học kỳ khác.`
                    )}
                  </div>
                ) : choices.length === 0 ? (
                  <div className="rounded-md border border-dashed border-slate-300 px-3 py-4 text-center text-xs text-slate-500">
                    {tr(
                      locale,
                      "아직 고른 지망이 없습니다. 아래 모집 목록에서 '추가'를 누르세요.",
                      "Chưa chọn nguyện vọng nào. Nhấn 'Thêm' ở danh sách bên dưới."
                    )}
                  </div>
                ) : (
                  <ol className="flex flex-col gap-2">
                    {choices.map((c, i) => {
                      const o = offeringById.get(c.offeringId);
                      if (!o) return null;
                      const rank = existing.count + i + 1;
                      return (
                        <li
                          key={c.offeringId}
                          className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
                        >
                          <span
                            className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold ${priorityTone(rank)}`}
                          >
                            {priorityLabel(locale, rank)}
                          </span>
                          <span className="min-w-0 flex-1 text-sm text-slate-800">
                            {offeringTitle(o)}
                          </span>
                          {o.availableLanguages.length > 1 ? (
                            <select
                              aria-label={tr(locale, "어학 능력", "Năng lực ngoại ngữ")}
                              className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                              value={c.language}
                              onChange={(e) => setChoiceLanguage(i, e.target.value)}
                            >
                              <option value="">
                                {tr(locale, "— 어학 능력 —", "— Ngoại ngữ —")}
                              </option>
                              {o.availableLanguages.map((l) => (
                                <option key={l} value={l}>
                                  {languageLabel(locale, l)}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-xs text-slate-500">
                              {c.language ? languageLabel(locale, c.language) : "—"}
                            </span>
                          )}
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              className={smallBtnClass}
                              disabled={i === 0}
                              onClick={() => moveChoice(i, -1)}
                              aria-label={tr(locale, "순위 올리기", "Lên thứ tự")}
                              title={tr(locale, "순위 올리기", "Lên thứ tự")}
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              className={smallBtnClass}
                              disabled={i === choices.length - 1}
                              onClick={() => moveChoice(i, 1)}
                              aria-label={tr(locale, "순위 내리기", "Xuống thứ tự")}
                              title={tr(locale, "순위 내리기", "Xuống thứ tự")}
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              className={smallBtnClass}
                              onClick={() => removeChoice(i)}
                            >
                              {tr(locale, "빼기", "Bỏ")}
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>

              {/* 3. 이 학기의 모집 목록 */}
              {remaining > 0 ? (
                <div className={labelClass}>
                  <span className={labelTextClass}>
                    {tr(locale, "모집 중인 대학 · 학과", "Trường · ngành đang tuyển")}
                    <span className="ml-2 text-xs font-normal text-slate-500">
                      {tr(
                        locale,
                        `${choices.length} / ${remaining}개 선택`,
                        `Đã chọn ${choices.length} / ${remaining}`
                      )}
                    </span>
                  </span>
                  <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
                    {termOfferings.map((o) => {
                      const picked = choices.some((c) => c.offeringId === o.id);
                      const applied = appliedSet.has(o.id);
                      const full = choices.length >= remaining;
                      const quota = formatOfferingQuota(locale, o.intakeQuota, o.totalQuota);
                      return (
                        <li
                          key={o.id}
                          className="flex items-center justify-between gap-2 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <div className="text-sm text-slate-800">{offeringTitle(o)}</div>
                            {quota ? (
                              <div className="text-xs text-slate-500">{quota}</div>
                            ) : null}
                          </div>
                          {applied ? (
                            <span className="shrink-0 text-xs text-slate-400">
                              {tr(locale, "이미 지원함", "Đã đăng ký")}
                            </span>
                          ) : picked ? (
                            <span className="shrink-0 text-xs font-medium text-emerald-700">
                              {tr(locale, "선택됨", "Đã chọn")}
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="shrink-0 rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                              disabled={full}
                              onClick={() => addChoice(o)}
                            >
                              {tr(locale, "추가", "Thêm")}
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </>
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
                {tr(locale, "— 대학 선택 —", "— Chọn trường —")}
              </option>
              {specs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.universityName ?? s.universityNameKo ?? "?"}
                  {s.admissionCategory ? ` · ${s.admissionCategory}` : ""}
                </option>
              ))}
            </select>
            <span className="text-xs text-amber-600">
              {tr(
                locale,
                "모집 중이 아닌 학과도 포함된 목록입니다.",
                "Danh sách này gồm cả ngành chưa mở tuyển."
              )}
            </span>
            {/* 모집이 0건일 때도 돌아갈 길은 남긴다 — 없으면 갇힌다. */}
            <button
              type="button"
              onClick={() => setMode("offering")}
              className="self-start text-xs text-slate-500 underline hover:text-slate-700"
            >
              {tr(locale, "← 모집 중 학과에서 선택", "← Chọn từ ngành đang tuyển")}
            </button>
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
              {selectedSpec.departments.length === 0 ? (
                <span className="text-xs text-slate-500">
                  {tr(locale, "이 모집요강에 등록된 학과가 없습니다.", "Hồ sơ này chưa có ngành nào.")}
                </span>
              ) : selectedSpec.departments.length > 1 ? (
                <select
                  required
                  className={inputClass}
                  value={specDeptId}
                  onChange={(e) => pickSpecDept(selectedSpec, e.target.value)}
                >
                  <option value="">{tr(locale, "— 학과 선택 —", "— Chọn ngành —")}</option>
                  {selectedSpec.departments.map((d) => (
                    <option key={d.departmentId} value={String(d.departmentId)}>
                      {d.name} ({kindLabel(locale, d.kind)})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  className={inputClass + " bg-slate-50"}
                  value={selectedSpecDept ? `${selectedSpecDept.name} (${kindLabel(locale, selectedSpecDept.kind)})` : ""}
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

          {selectedSpec ? (
            <label className={labelClass}>
              <span className={labelTextClass}>
                {tr(locale, "학기", "Học kỳ")}
                <span className={requiredMarkClass}>*</span>
              </span>
              {selectedSpec.terms.length === 0 ? (
                <span className="text-xs text-slate-500">
                  {tr(locale, "이 모집요강에 등록된 학기가 없습니다.", "Hồ sơ này chưa có học kỳ nào.")}
                </span>
              ) : selectedSpec.terms.length > 1 ? (
                <select
                  required
                  className={inputClass}
                  value={specTerm}
                  onChange={(e) => setSpecTerm(e.target.value)}
                >
                  <option value="">{tr(locale, "— 학기 선택 —", "— Chọn học kỳ —")}</option>
                  {selectedSpec.terms.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  className={inputClass + " bg-slate-50"}
                  value={specTerm}
                  readOnly
                />
              )}
              {fieldError("term") ? (
                <span className={errorTextClass}>{fieldError("term")}</span>
              ) : null}
            </label>
          ) : null}

          {selectedSpecDept
            ? languageField(selectedSpecDept.availableLanguages, specLanguage, setSpecLanguage)
            : null}

          <p className="text-xs text-slate-500">
            {tr(
              locale,
              `지망 순위는 이 학기의 다음 순위로 자동으로 매겨집니다 (학기당 최대 ${MAX_PRIORITY}지망).`,
              `Thứ tự nguyện vọng được tự động gán tiếp theo trong học kỳ (tối đa ${MAX_PRIORITY} mỗi học kỳ).`
            )}
          </p>
        </>
      )}

      {state?.error ? (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}

      {state?.notice ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <span>{state.notice}</span>
          <Link
            href={`/center/students/${studentId}`}
            className="shrink-0 rounded-md bg-emerald-700 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-800"
          >
            {tr(locale, "학생 상세로", "Về chi tiết sinh viên")}
          </Link>
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
            : mode === "offering" && choices.length > 1
              ? tr(locale, `지망 ${choices.length}개 등록`, `Đăng ký ${choices.length} nguyện vọng`)
              : tr(locale, "지원 등록", "Đăng ký nguyện vọng")}
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
