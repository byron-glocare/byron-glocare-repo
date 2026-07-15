"use client";

import { useRef, useState, useTransition } from "react";
import { ChevronDown, ChevronRight, Wrench } from "lucide-react";
import type { Json } from "@/types/database";
import { tr, type Locale } from "@/lib/i18n";
import {
  SignaturePad,
  type SignaturePadHandle,
} from "@/components/signature-pad";
import { MultiSelectWithOther } from "@/components/multi-select-other";
import {
  saveStudentDataValueAction,
  translateStudentValueAction,
  uploadStudentFileAction,
  getStudentFileSignedUrlAction,
  removeStudentFileAction,
} from "./actions";
import { AiExtractPanel } from "./ai-extract-panel";
import { FillLinkButton } from "./fill-link-button";

export type DataTypeMeta = {
  key: string;
  label_ko: string;
  label_vi: string;
  category: string;
  input_type: string;
  options: Array<{ value: string; label_ko: string; label_vi: string }> | null;
  hint_ko: string | null;
  hint_vi: string | null;
  is_essay_basis: boolean;
  is_derived: boolean;
  derived_from: { selector: string; map: Record<string, string> } | null;
};

/**
 * 파생(택1) 값 해석 — 저장하지 않고 항상 원본에서 계산.
 *   selector 항목의 선택값(예: "father") → map["father"] = "father_name" → 그 값.
 */
type DerivedResolution =
  | { state: "ok"; value: Json | null; sourceKey: string; choice: string }
  | { state: "no-selector" }
  | { state: "no-choice"; selectorKey: string }
  | { state: "unmapped"; selectorKey: string; choice: string };

function resolveDerived(
  dt: DataTypeMeta,
  valueOf: (key: string) => Json | null
): DerivedResolution {
  const df = dt.derived_from;
  if (!df || !df.selector) return { state: "no-selector" };
  const raw = valueOf(df.selector);
  const choice = raw == null ? "" : String(raw);
  if (!choice) return { state: "no-choice", selectorKey: df.selector };
  const sourceKey = df.map?.[choice];
  if (!sourceKey) return { state: "unmapped", selectorKey: df.selector, choice };
  return { state: "ok", value: valueOf(sourceKey), sourceKey, choice };
}

const CATEGORY_ORDER = [
  "identity",
  "education",
  "family",
  "financial",
  "language",
  "contact",
  "career",
  "essay",
  "document",
  "other",
];

function categoryLabel(locale: Locale, category: string): string {
  switch (category) {
    case "identity":
      return tr(locale, "개인 정보", "Thông tin cá nhân");
    case "education":
      return tr(locale, "학력", "Học vấn");
    case "family":
      return tr(locale, "가족", "Gia đình");
    case "financial":
      return tr(locale, "재정", "Tài chính");
    case "language":
      return tr(locale, "어학", "Ngoại ngữ");
    case "contact":
      return tr(locale, "연락처", "Liên hệ");
    case "career":
      return tr(locale, "경력", "Kinh nghiệm");
    case "essay":
      return tr(locale, "작문 (AI 기초자료)", "Văn viết (cơ sở AI)");
    case "document":
      return tr(locale, "발급 서류", "Giấy tờ phát hành");
    case "other":
      return tr(locale, "기타", "Khác");
    default:
      return category;
  }
}

export function StudentDataEditor({
  locale,
  studentId,
  dataTypes,
  existingValues,
  existingInputs = {},
  requiredBySource,
}: {
  locale: Locale;
  studentId: string;
  dataTypes: DataTypeMeta[];
  existingValues: Record<string, Json>;
  /** 입력 원문(번역 전). value_input 이 있는 항목만. 없으면 최종값과 동일 취급. */
  existingInputs?: Record<string, Json>;
  requiredBySource: Record<string, string[]>;
}) {
  // 로컬 state — 즉시 UI 반영 + 서버 저장
  const [values, setValues] = useState<Record<string, Json | null>>(
    existingValues as Record<string, Json | null>
  );
  // 입력 원문(번역 전) — 텍스트 항목의 "입력값" 필드 프리필용
  const [inputs, setInputs] = useState<Record<string, Json | null>>(
    existingInputs as Record<string, Json | null>
  );

  // 필요한 항목만 보기 (지원 대학 직접작성서류가 요구하는 키) ↔ 전체 보기
  const requiredKeySet = new Set(Object.keys(requiredBySource));
  const canScope = requiredKeySet.size > 0;
  const [showAll, setShowAll] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const visibleTypes =
    canScope && !showAll
      ? dataTypes.filter((d) => requiredKeySet.has(d.key))
      : dataTypes;

  // key → 메타 (파생 해석·라벨 조회용)
  const byKey = new Map<string, DataTypeMeta>();
  for (const dt of dataTypes) byKey.set(dt.key, dt);

  const valueOf = (key: string): Json | null => values[key] ?? null;
  // 파생 항목은 원본에서 계산한 값을, 일반 항목은 입력값을 반환
  const effectiveValue = (dt: DataTypeMeta): Json | null => {
    if (!dt.is_derived) return valueOf(dt.key);
    const r = resolveDerived(dt, valueOf);
    return r.state === "ok" ? r.value : null;
  };

  // 카테고리별 그룹화 (범위 적용)
  const byCategory = new Map<string, DataTypeMeta[]>();
  for (const dt of visibleTypes) {
    if (!byCategory.has(dt.category)) byCategory.set(dt.category, []);
    byCategory.get(dt.category)!.push(dt);
  }

  // 부족 항목 카운트 — 지원 의향에서 필요한데 입력 안 된 것 (파생은 계산값 기준)
  const requiredKeys = Object.keys(requiredBySource);
  const missingRequired = requiredKeys.filter((k) => {
    const dt = byKey.get(k);
    const v = dt ? effectiveValue(dt) : values[k];
    return v === null || v === undefined || v === "";
  });

  return (
    <div className="space-y-3">
      {/* 1) 필수 상태 — 가장 중요 (지원 양식이 요구하는 항목) */}
      {requiredKeys.length > 0 ? (
        <section
          className={`rounded-lg border p-4 ${
            missingRequired.length === 0
              ? "border-emerald-200 bg-emerald-50"
              : "border-amber-200 bg-amber-50"
          }`}
        >
          <h2 className="text-sm font-semibold">
            {missingRequired.length === 0
              ? tr(
                  locale,
                  `✓ 필수 항목 ${requiredKeys.length}개를 모두 입력했습니다`,
                  `✓ Tất cả ${requiredKeys.length} mục cần thiết đã đầy đủ`
                )
              : tr(
                  locale,
                  `⚠ 필수 항목 ${missingRequired.length} / ${requiredKeys.length}개가 미입력 상태입니다`,
                  `⚠ Còn thiếu ${missingRequired.length} / ${requiredKeys.length} mục cần thiết`
                )}
          </h2>
          {missingRequired.length > 0 ? (
            <p className="mt-1 text-xs">
              {tr(locale, "아래에서 ", "Các mục có dấu ")}
              <span className="rounded bg-amber-200 px-1 font-semibold">
                {tr(locale, "필수", "cần")}
              </span>{" "}
              {tr(
                locale,
                "표시가 된 항목은 대학 지원 양식에서 요구하는 항목입니다.",
                "bên dưới là do mẫu hồ sơ của trường yêu cầu."
              )}
            </p>
          ) : null}
        </section>
      ) : (
        <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs text-slate-600">
            {tr(
              locale,
              "등록된 지원 내역이 없어 필수 항목을 자동으로 판별할 수 없습니다. 입력 가능한 정보를 최대한 채워주세요.",
              "Chưa có đơn tuyển sinh nào — chưa thể xác định mục bắt buộc tự động. Vui lòng nhập đầy đủ thông tin có thể có."
            )}
          </p>
        </section>
      )}

      {/* 2) 보조 도구 — 외부 입력 링크 · 업로드 서류 자동채움 (접힘 기본, 가끔 사용) */}
      <div className="rounded-lg border border-slate-200 bg-white">
        <button
          type="button"
          onClick={() => setToolsOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-2.5 text-left"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <Wrench className="size-4 text-slate-400" />
            {tr(locale, "도구", "Công cụ")}
            <span className="font-normal text-slate-400">
              {tr(
                locale,
                "· 외부 입력 링크 · 업로드 서류로 자동 채우기",
                "· Liên kết nhập · Tự động điền từ tệp"
              )}
            </span>
          </span>
          {toolsOpen ? (
            <ChevronDown className="size-4 shrink-0 text-slate-400" />
          ) : (
            <ChevronRight className="size-4 shrink-0 text-slate-400" />
          )}
        </button>
        {toolsOpen ? (
          <div className="space-y-3 border-t border-slate-100 p-4">
            <AiExtractPanel
              locale={locale}
              studentId={studentId}
              onApplied={(key, value) =>
                setValues((cur) => ({ ...cur, [key]: value }))
              }
            />
            <FillLinkButton locale={locale} studentId={studentId} />
          </div>
        ) : null}
      </div>

      {/* 3) 범위 토글 — 필요한 항목만 / 전체 */}
      {canScope ? (
        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-2.5">
          <span className="text-xs text-slate-600">
            {showAll
              ? tr(
                  locale,
                  "전체 표준 항목을 보고 있습니다.",
                  "Đang xem tất cả mục tiêu chuẩn."
                )
              : tr(
                  locale,
                  "지원 대학의 작성서류에 필요한 항목만 표시 중입니다.",
                  "Chỉ hiển thị mục cần cho giấy tờ của trường đã đăng ký."
                )}
          </span>
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="shrink-0 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
          >
            {showAll
              ? tr(locale, "필요한 항목만 보기", "Chỉ mục cần thiết")
              : tr(locale, "전체 항목 보기", "Xem tất cả")}
          </button>
        </div>
      ) : null}

      {/* 카테고리별 입력 */}
      {CATEGORY_ORDER.filter((c) => byCategory.has(c)).map((cat) => (
        <CategorySection
          key={cat}
          locale={locale}
          category={cat}
          dataTypes={byCategory.get(cat)!}
          values={values}
          setValues={setValues}
          inputs={inputs}
          setInputs={setInputs}
          studentId={studentId}
          requiredBySource={requiredBySource}
          byKey={byKey}
        />
      ))}
    </div>
  );
}

function CategorySection({
  locale,
  category,
  dataTypes,
  values,
  setValues,
  inputs,
  setInputs,
  studentId,
  requiredBySource,
  byKey,
}: {
  locale: Locale;
  category: string;
  dataTypes: DataTypeMeta[];
  values: Record<string, Json | null>;
  setValues: React.Dispatch<React.SetStateAction<Record<string, Json | null>>>;
  inputs: Record<string, Json | null>;
  setInputs: React.Dispatch<React.SetStateAction<Record<string, Json | null>>>;
  studentId: string;
  requiredBySource: Record<string, string[]>;
  byKey: Map<string, DataTypeMeta>;
}) {
  const valueOf = (key: string): Json | null => values[key] ?? null;
  const effectiveValue = (dt: DataTypeMeta): Json | null => {
    if (!dt.is_derived) return valueOf(dt.key);
    const r = resolveDerived(dt, valueOf);
    return r.state === "ok" ? r.value : null;
  };
  const filled = dataTypes.filter((dt) => {
    const v = effectiveValue(dt);
    return v !== null && v !== undefined && v !== "";
  }).length;

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <header className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">
          {categoryLabel(locale, category)}{" "}
          <span className="font-normal text-slate-500">
            ({filled}/{dataTypes.length})
          </span>
        </h2>
      </header>
      <div className="divide-y divide-slate-100">
        {dataTypes.map((dt) =>
          dt.is_derived ? (
            <DerivedFieldRow
              key={dt.key}
              locale={locale}
              dataType={dt}
              resolution={resolveDerived(dt, valueOf)}
              byKey={byKey}
              requiredSources={requiredBySource[dt.key] ?? []}
            />
          ) : (
            <FieldRow
              key={dt.key}
              locale={locale}
              dataType={dt}
              value={values[dt.key] ?? null}
              inputValue={inputs[dt.key] ?? null}
              onChange={(v, vi) => {
                setValues((cur) => ({ ...cur, [dt.key]: v }));
                if (vi !== undefined)
                  setInputs((cur) => ({ ...cur, [dt.key]: vi }));
              }}
              studentId={studentId}
              requiredSources={requiredBySource[dt.key] ?? []}
            />
          )
        )}
      </div>
    </section>
  );
}

function FieldRow({
  locale,
  dataType,
  value,
  inputValue,
  onChange,
  studentId,
  requiredSources,
}: {
  locale: Locale;
  dataType: DataTypeMeta;
  value: Json | null;
  inputValue: Json | null;
  onChange: (v: Json | null, valueInput?: Json | null) => void;
  studentId: string;
  requiredSources: string[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<boolean>(false);

  const isRequired = requiredSources.length > 0;
  const isFilled =
    value !== null && value !== undefined && value !== "" && value !== false;

  const save = (newValue: Json | null, valueInput?: Json | null) => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await saveStudentDataValueAction({
        studentId,
        dataTypeKey: dataType.key,
        value: newValue,
        valueInput,
      });
      if (!res.ok) {
        setError(res.error);
      } else {
        setSaved(true);
        // 2초 후 사라짐
        setTimeout(() => setSaved(false), 1500);
      }
    });
  };

  return (
    <div id={`field-${dataType.key}`} className="scroll-mt-24 px-4 py-3 target:bg-amber-50">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <label className="text-sm font-medium text-slate-900">
            {locale === "ko" ? dataType.label_ko : dataType.label_vi}
            {isRequired ? (
              <span
                className="ml-2 rounded bg-amber-200 px-1 text-[10px] font-semibold text-amber-900"
                title={requiredSources.join(", ")}
              >
                {tr(locale, "필수", "cần")}
              </span>
            ) : null}
            {dataType.is_essay_basis ? (
              <span className="ml-2 rounded bg-purple-100 px-1 text-[10px] text-purple-700">
                {tr(locale, "AI 기초자료", "AI cơ sở")}
              </span>
            ) : null}
          </label>
          <div className="mt-0.5 text-xs text-slate-500">
            {locale === "ko" ? dataType.label_vi : dataType.label_ko}{" "}
            <span className="text-slate-400">· {dataType.key}</span>
          </div>
          {(locale === "ko" ? dataType.hint_ko : dataType.hint_vi) ? (
            <div className="mt-1 text-xs text-slate-600">
              💡 {locale === "ko" ? dataType.hint_ko : dataType.hint_vi}
            </div>
          ) : null}
        </div>
        <div className="shrink-0">
          {pending ? (
            <span className="text-xs text-slate-400">
              {tr(locale, "저장 중...", "đang lưu...")}
            </span>
          ) : saved ? (
            <span className="text-xs text-emerald-600">
              {tr(locale, "✓ 저장됨", "✓ đã lưu")}
            </span>
          ) : isFilled ? (
            <span className="text-xs text-emerald-600">✓</span>
          ) : (
            <span className="text-xs text-slate-300">—</span>
          )}
        </div>
      </div>

      <div className="mt-2">
        <ValueInput
          locale={locale}
          dataType={dataType}
          value={value}
          inputValue={inputValue}
          studentId={studentId}
          onCommit={(v, vi) => {
            onChange(v, vi);
            save(v, vi);
          }}
        />
      </div>

      {error ? (
        <div className="mt-1 text-xs text-rose-700">
          {tr(locale, "오류", "Lỗi")}: {error}
        </div>
      ) : null}
    </div>
  );
}

/**
 * 파생(택1) 항목 — 입력칸 대신 계산된 값을 읽기전용으로 표시.
 *   값은 저장하지 않는다. 선택 기준 항목이 바뀌면 자동으로 따라간다.
 */
function DerivedFieldRow({
  locale,
  dataType,
  resolution,
  byKey,
  requiredSources,
}: {
  locale: Locale;
  dataType: DataTypeMeta;
  resolution: DerivedResolution;
  byKey: Map<string, DataTypeMeta>;
  requiredSources: string[];
}) {
  const isRequired = requiredSources.length > 0;
  const labelOf = (key: string): string => {
    const dt = byKey.get(key);
    if (!dt) return key;
    return locale === "ko" ? dt.label_ko : dt.label_vi;
  };
  // 선택값(choice)의 사람이 읽는 라벨
  const choiceLabel = (selectorKey: string, choice: string): string => {
    const sel = byKey.get(selectorKey);
    const opt = sel?.options?.find((o) => o.value === choice);
    if (!opt) return choice;
    return locale === "ko" ? opt.label_ko : opt.label_vi;
  };

  let displayValue: string | null = null;
  let note: string;
  let toneEmpty = false;

  switch (resolution.state) {
    case "ok": {
      const v = resolution.value;
      displayValue =
        v === null || v === undefined || v === "" ? null : String(v);
      const selectorKey = dataType.derived_from?.selector ?? "";
      const choiceTxt = choiceLabel(selectorKey, resolution.choice);
      note = tr(
        locale,
        `${choiceTxt} 선택 → "${labelOf(resolution.sourceKey)}"에서 자동`,
        `Chọn ${choiceTxt} → tự động lấy từ "${labelOf(resolution.sourceKey)}"`
      );
      if (displayValue === null) {
        toneEmpty = true;
        note = tr(
          locale,
          `"${labelOf(resolution.sourceKey)}" 값이 비어 있습니다 — 해당 항목을 입력하세요`,
          `"${labelOf(resolution.sourceKey)}" đang trống — vui lòng nhập mục đó`
        );
      }
      break;
    }
    case "no-choice":
      toneEmpty = true;
      note = tr(
        locale,
        `먼저 "${labelOf(resolution.selectorKey)}"를 선택하세요`,
        `Vui lòng chọn "${labelOf(resolution.selectorKey)}" trước`
      );
      break;
    case "unmapped":
      toneEmpty = true;
      note = tr(
        locale,
        `"${choiceLabel(resolution.selectorKey, resolution.choice)}" 선택에 연결된 원본 항목이 없습니다 (관리자 설정 필요)`,
        `Lựa chọn "${choiceLabel(resolution.selectorKey, resolution.choice)}" chưa được liên kết nguồn (cần cấu hình)`
      );
      break;
    case "no-selector":
    default:
      toneEmpty = true;
      note = tr(
        locale,
        "파생 설정이 올바르지 않습니다 (선택 기준 미지정)",
        "Cấu hình phái sinh chưa hợp lệ (thiếu mục tiêu chuẩn)"
      );
      break;
  }

  return (
    <div id={`field-${dataType.key}`} className="scroll-mt-24 px-4 py-3 target:bg-amber-50">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <label className="text-sm font-medium text-slate-900">
            {locale === "ko" ? dataType.label_ko : dataType.label_vi}
            <span className="ml-2 rounded bg-sky-100 px-1 text-[10px] font-semibold text-sky-700">
              {tr(locale, "택1·자동", "Tự động")}
            </span>
            {isRequired ? (
              <span
                className="ml-2 rounded bg-amber-200 px-1 text-[10px] font-semibold text-amber-900"
                title={requiredSources.join(", ")}
              >
                {tr(locale, "필수", "cần")}
              </span>
            ) : null}
          </label>
          <div className="mt-0.5 text-xs text-slate-500">
            {locale === "ko" ? dataType.label_vi : dataType.label_ko}{" "}
            <span className="text-slate-400">· {dataType.key}</span>
          </div>
        </div>
        <div className="shrink-0">
          {displayValue !== null ? (
            <span className="text-xs text-emerald-600">✓</span>
          ) : (
            <span className="text-xs text-slate-300">—</span>
          )}
        </div>
      </div>

      <div className="mt-2">
        <div
          className={`w-full rounded-md border px-3 py-2 text-sm ${
            displayValue !== null
              ? "border-slate-200 bg-slate-50 text-slate-800"
              : "border-dashed border-slate-300 bg-slate-50 text-slate-400"
          }`}
        >
          {displayValue ?? tr(locale, "(자동 계산 — 값 없음)", "(tự động — chưa có giá trị)")}
        </div>
        <p
          className={`mt-1 text-xs ${
            toneEmpty ? "text-amber-700" : "text-slate-500"
          }`}
        >
          ↪ {note}
        </p>
      </div>
    </div>
  );
}

function ValueInput({
  locale,
  dataType,
  value,
  inputValue,
  studentId,
  onCommit,
}: {
  locale: Locale;
  dataType: DataTypeMeta;
  value: Json | null;
  inputValue: Json | null;
  studentId: string;
  onCommit: (v: Json | null, valueInput?: Json | null) => void;
}) {
  const baseClass =
    "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";

  switch (dataType.input_type) {
    case "long_text":
      return (
        <TranslatableTextInput
          locale={locale}
          label={locale === "ko" ? dataType.label_ko : dataType.label_vi}
          multiline
          value={typeof value === "string" ? value : ""}
          inputValue={typeof inputValue === "string" ? inputValue : ""}
          baseClass={baseClass}
          onCommit={(final, input) =>
            onCommit(final || null, input || null)
          }
        />
      );

    case "date":
      return (
        <input
          type="date"
          defaultValue={typeof value === "string" ? value : ""}
          onBlur={(e) => onCommit(e.target.value || null)}
          className={baseClass}
        />
      );

    case "number":
      return (
        <input
          type="number"
          step="any"
          defaultValue={typeof value === "number" ? value : ""}
          onBlur={(e) => {
            const v = e.target.value;
            onCommit(v === "" ? null : Number(v));
          }}
          className={baseClass}
        />
      );

    case "select":
      return (
        <select
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onCommit(e.target.value || null)}
          className={baseClass}
        >
          <option value="">{tr(locale, "— 선택 안 함 —", "— chưa chọn —")}</option>
          {(dataType.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {locale === "ko"
                ? `${o.label_ko} · ${o.label_vi}`
                : `${o.label_vi} · ${o.label_ko}`}
            </option>
          ))}
        </select>
      );

    case "multi_select":
      return (
        <MultiSelectWithOther
          locale={locale}
          value={Array.isArray(value) ? (value as string[]) : []}
          options={dataType.options ?? []}
          onCommit={(arr) => onCommit(arr.length > 0 ? arr : null)}
        />
      );

    case "boolean":
      return (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={value === true}
            onChange={(e) => onCommit(e.target.checked)}
          />
          <span>{tr(locale, "예", "Có")}</span>
        </label>
      );

    case "file":
      return (
        <FileInput
          locale={locale}
          studentId={studentId}
          dataTypeKey={dataType.key}
          value={value}
          onCommit={onCommit}
        />
      );

    case "signature":
      return (
        <SignatureInput
          locale={locale}
          studentId={studentId}
          dataTypeKey={dataType.key}
          value={value}
          onCommit={onCommit}
        />
      );

    case "text":
    default:
      return (
        <TranslatableTextInput
          locale={locale}
          label={locale === "ko" ? dataType.label_ko : dataType.label_vi}
          value={typeof value === "string" ? value : ""}
          inputValue={typeof inputValue === "string" ? inputValue : ""}
          baseClass={baseClass}
          onCommit={(final, input) => onCommit(final || null, input || null)}
        />
      );
  }
}

function FileInput({
  locale,
  studentId,
  dataTypeKey,
  value,
  onCommit,
}: {
  locale: Locale;
  studentId: string;
  dataTypeKey: string;
  value: Json | null;
  onCommit: (v: Json | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileObj =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as { path?: string; url?: string; file_name?: string })
      : null;
  const fileName = fileObj?.file_name ?? null;
  const hasUpload = !!fileObj?.path;
  const legacyUrl = fileObj?.url ?? null; // 예전 'URL 직접 입력' 데이터 호환

  async function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = ""; // 같은 파일 재선택 허용
    if (!file) return;

    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.set("studentId", studentId);
    fd.set("dataTypeKey", dataTypeKey);
    fd.set("file", file);
    const res = await uploadStudentFileAction(fd);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onCommit(res.value); // { path, file_name } → 기존 save 흐름으로 저장
  }

  async function handleOpen() {
    if (!fileObj?.path) return;
    setOpening(true);
    setError(null);
    const res = await getStudentFileSignedUrlAction(fileObj.path);
    setOpening(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    window.open(res.url, "_blank", "noopener,noreferrer");
  }

  async function handleRemove() {
    if (busy) return;
    setBusy(true);
    setError(null);
    if (fileObj?.path) {
      const res = await removeStudentFileAction({
        studentId,
        dataTypeKey,
        path: fileObj.path,
      });
      if (!res.ok) {
        setBusy(false);
        setError(res.error);
        return;
      }
    }
    setBusy(false);
    onCommit(null); // UI 갱신 (+ 값 삭제 재확인, 멱등)
  }

  if (hasUpload || legacyUrl) {
    return (
      <div>
        <div className="flex items-center gap-3 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm">
          <span className="flex-1 truncate" title={fileName ?? legacyUrl ?? ""}>
            📎 {fileName ?? legacyUrl}
          </span>
          {hasUpload ? (
            <button
              type="button"
              onClick={handleOpen}
              disabled={opening}
              className="shrink-0 font-medium text-emerald-700 hover:underline disabled:opacity-50"
            >
              {opening ? "..." : tr(locale, "열기", "Mở")}
            </button>
          ) : legacyUrl ? (
            <a
              href={legacyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 font-medium text-emerald-700 hover:underline"
            >
              {tr(locale, "열기", "Mở")}
            </a>
          ) : null}
          <button
            type="button"
            onClick={handleRemove}
            disabled={busy}
            className="shrink-0 text-rose-600 hover:underline disabled:opacity-50"
          >
            {busy ? "..." : tr(locale, "삭제", "Xóa")}
          </button>
        </div>
        {error ? (
          <p className="mt-1 text-xs text-rose-700">
            {tr(locale, "오류", "Lỗi")}: {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        onChange={handlePick}
        disabled={busy}
        className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-emerald-600 file:px-3 file:py-1.5 file:font-medium file:text-white hover:file:bg-emerald-700 disabled:opacity-50"
      />
      {busy ? (
        <p className="mt-1 text-xs text-slate-400">
          {tr(locale, "업로드 중...", "Đang tải lên...")}
        </p>
      ) : null}
      {error ? (
        <p className="mt-1 text-xs text-rose-700">
          {tr(locale, "오류", "Lỗi")}: {error}
        </p>
      ) : null}
    </div>
  );
}

/** dataURL(base64) → File 변환 (업로드 액션이 File 을 받음) */
function dataUrlToFile(dataUrl: string, fileName: string): File {
  const comma = dataUrl.indexOf(",");
  const meta = dataUrl.slice(0, comma);
  const b64 = dataUrl.slice(comma + 1);
  const mime = meta.match(/:(.*?);/)?.[1] ?? "image/png";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new File([arr], fileName, { type: mime });
}

/**
 * 서명 입력 — 캔버스로 서명 → PNG 업로드(비공개 버킷). 파일 값과 동일한
 *   { path, file_name } 형태로 저장해 기존 열기/삭제 흐름을 재사용.
 */
function SignatureInput({
  locale,
  studentId,
  dataTypeKey,
  value,
  onCommit,
}: {
  locale: Locale;
  studentId: string;
  dataTypeKey: string;
  value: Json | null;
  onCommit: (v: Json | null) => void;
}) {
  const padRef = useRef<SignaturePadHandle>(null);
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [empty, setEmpty] = useState(true);

  const fileObj =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as { path?: string; file_name?: string })
      : null;
  const hasSignature = !!fileObj?.path;

  async function handleSave() {
    const dataUrl = padRef.current?.toDataURL();
    if (!dataUrl) {
      setError(tr(locale, "서명을 입력해주세요.", "Vui lòng ký tên."));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const file = dataUrlToFile(dataUrl, `signature-${dataTypeKey}.png`);
      const fd = new FormData();
      fd.set("studentId", studentId);
      fd.set("dataTypeKey", dataTypeKey);
      fd.set("file", file);
      const res = await uploadStudentFileAction(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onCommit(res.value); // { path, file_name }
    } finally {
      setBusy(false);
    }
  }

  async function handleOpen() {
    if (!fileObj?.path) return;
    setOpening(true);
    setError(null);
    const res = await getStudentFileSignedUrlAction(fileObj.path);
    setOpening(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    window.open(res.url, "_blank", "noopener,noreferrer");
  }

  async function handleReset() {
    if (busy) return;
    setBusy(true);
    setError(null);
    if (fileObj?.path) {
      const res = await removeStudentFileAction({
        studentId,
        dataTypeKey,
        path: fileObj.path,
      });
      if (!res.ok) {
        setBusy(false);
        setError(res.error);
        return;
      }
    }
    setBusy(false);
    onCommit(null); // 패드 다시 표시
  }

  // 이미 서명된 경우 — 미리보기/열기/다시 서명
  if (hasSignature) {
    return (
      <div>
        <div className="flex items-center gap-3 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm">
          <span className="flex-1">
            ✍️ {tr(locale, "서명 완료", "Đã ký")}
          </span>
          <button
            type="button"
            onClick={handleOpen}
            disabled={opening}
            className="shrink-0 font-medium text-emerald-700 hover:underline disabled:opacity-50"
          >
            {opening ? "..." : tr(locale, "보기", "Xem")}
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={busy}
            className="shrink-0 text-rose-600 hover:underline disabled:opacity-50"
          >
            {busy ? "..." : tr(locale, "다시 서명", "Ký lại")}
          </button>
        </div>
        {error ? (
          <p className="mt-1 text-xs text-rose-700">
            {tr(locale, "오류", "Lỗi")}: {error}
          </p>
        ) : null}
      </div>
    );
  }

  // 미서명 — 캔버스 패드
  return (
    <div className="space-y-2">
      <SignaturePad ref={padRef} disabled={busy} onChange={setEmpty} />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={busy || empty}
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy ? tr(locale, "저장 중...", "Đang lưu...") : tr(locale, "서명 저장", "Lưu chữ ký")}
        </button>
        <button
          type="button"
          onClick={() => padRef.current?.clear()}
          disabled={busy || empty}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
        >
          {tr(locale, "지우기", "Xóa")}
        </button>
        <span className="text-xs text-slate-500">
          {tr(
            locale,
            "마우스·손가락·펜으로 서명하세요.",
            "Ký bằng chuột, ngón tay hoặc bút."
          )}
        </span>
      </div>
      {error ? (
        <p className="text-xs text-rose-700">
          {tr(locale, "오류", "Lỗi")}: {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * 번역형 텍스트 입력 — "입력값(원문)" + "최종값(서류 사용)" 이중 관리.
 *   - 입력값에 베트남어를 넣고 벗어나면 자동으로 한국어(+고유명사 영어)로 번역해 최종값을 채움.
 *   - 최종값은 직접 수정 가능. [재번역] 으로 입력값에서 다시 번역.
 *   - 저장: value=최종값, value_input=입력값 (문서는 value 만 읽음).
 */
function TranslatableTextInput({
  locale,
  label,
  value,
  inputValue,
  baseClass,
  multiline,
  onCommit,
}: {
  locale: Locale;
  label: string;
  value: string;
  inputValue: string;
  baseClass: string;
  multiline?: boolean;
  onCommit: (final: string, input: string) => void;
}) {
  // value_input 이 없던 기존 값은 입력==최종으로 취급
  const initialInput = inputValue || value;
  const [draftInput, setDraftInput] = useState(initialInput);
  const [draftFinal, setDraftFinal] = useState(value);
  const [committedInput, setCommittedInput] = useState(initialInput);
  const [committedFinal, setCommittedFinal] = useState(value);
  const [translating, setTranslating] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const commit = (final: string, input: string) => {
    setCommittedFinal(final);
    setCommittedInput(input);
    onCommit(final, input);
  };

  const runTranslate = async (force: boolean) => {
    const text = draftInput.trim();
    if (!text) {
      // 입력값 비움 → 최종값도 비우고 삭제
      setDraftFinal("");
      setNote(null);
      commit("", "");
      return;
    }
    if (!force && text === committedInput.trim()) return; // 변화 없음
    setTranslating(true);
    setNote(null);
    const res = await translateStudentValueAction({ label, text });
    setTranslating(false);
    if (!res.ok) {
      // 실패 시 원문을 최종값으로 유지 (값 보존)
      setDraftFinal(text);
      commit(text, text);
      setNote(
        tr(
          locale,
          `번역 실패 — 원문을 최종값으로 저장했습니다. (${res.error})`,
          `Dịch lỗi — đã lưu nguyên văn. (${res.error})`
        )
      );
      return;
    }
    setDraftFinal(res.text);
    commit(res.text, text);
    setNote(
      res.translated
        ? tr(
            locale,
            "자동 번역됨 — 필요하면 아래 최종값을 수정하세요.",
            "Đã dịch tự động — sửa 'giá trị cuối' nếu cần."
          )
        : null
    );
  };

  const inputCls = `${baseClass} bg-slate-50`;
  const finalCls = `${baseClass} border-emerald-300`;

  return (
    <div className="space-y-1.5">
      {/* 입력값 (원문) */}
      <div>
        <div className="mb-0.5 flex items-center gap-2">
          <span className="text-[11px] font-medium text-slate-500">
            {tr(locale, "입력값 (원문)", "Giá trị nhập (gốc)")}
          </span>
          {translating ? (
            <span className="text-[11px] text-sky-600">
              {tr(locale, "번역 중…", "Đang dịch…")}
            </span>
          ) : null}
        </div>
        {multiline ? (
          <textarea
            value={draftInput}
            onChange={(e) => setDraftInput(e.target.value)}
            onBlur={() => {
              if (draftInput.trim() !== committedInput.trim())
                void runTranslate(false);
            }}
            rows={3}
            className={inputCls}
            placeholder={tr(
              locale,
              "베트남어로 입력하면 자동 번역됩니다.",
              "Nhập tiếng Việt — sẽ tự động dịch."
            )}
          />
        ) : (
          <input
            type="text"
            value={draftInput}
            onChange={(e) => setDraftInput(e.target.value)}
            onBlur={() => {
              if (draftInput.trim() !== committedInput.trim())
                void runTranslate(false);
            }}
            className={inputCls}
            placeholder={tr(
              locale,
              "베트남어로 입력하면 자동 번역됩니다.",
              "Nhập tiếng Việt — sẽ tự động dịch."
            )}
          />
        )}
      </div>

      {/* 최종값 (서류 사용) */}
      <div>
        <div className="mb-0.5 flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium text-emerald-700">
            {tr(locale, "최종값 (서류에 사용)", "Giá trị cuối (dùng cho hồ sơ)")}
          </span>
          <button
            type="button"
            onClick={() => void runTranslate(true)}
            disabled={translating || !draftInput.trim()}
            className="rounded border border-slate-300 px-1.5 py-0.5 text-[11px] text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            {tr(locale, "↻ 재번역", "↻ Dịch lại")}
          </button>
        </div>
        {multiline ? (
          <textarea
            value={draftFinal}
            onChange={(e) => setDraftFinal(e.target.value)}
            onBlur={() => {
              if (draftFinal !== committedFinal) commit(draftFinal, committedInput);
            }}
            rows={3}
            className={finalCls}
          />
        ) : (
          <input
            type="text"
            value={draftFinal}
            onChange={(e) => setDraftFinal(e.target.value)}
            onBlur={() => {
              if (draftFinal !== committedFinal) commit(draftFinal, committedInput);
            }}
            className={finalCls}
          />
        )}
      </div>

      {note ? <p className="text-[11px] text-slate-500">{note}</p> : null}
    </div>
  );
}

