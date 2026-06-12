"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Loader2, Plus, Power, Trash2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  saveDataTypeAction,
  deleteDataTypeAction,
  deactivateDataTypeAction,
  getDataTypeUsageAction,
  type SaveDataTypeState,
  type DataTypeUsage,
} from "./actions";

const CATEGORY_OPTIONS = [
  { value: "identity", label: "신원" },
  { value: "education", label: "학력" },
  { value: "family", label: "가족" },
  { value: "financial", label: "재정" },
  { value: "language", label: "어학" },
  { value: "contact", label: "연락처" },
  { value: "career", label: "경력·자격" },
  { value: "essay", label: "서술형 (작문 기초)" },
  { value: "document", label: "발급 서류" },
  { value: "other", label: "기타" },
] as const;

const INPUT_TYPE_OPTIONS = [
  { value: "text", label: "단문 (text)" },
  { value: "long_text", label: "장문 (textarea)" },
  { value: "date", label: "날짜 (date)" },
  { value: "number", label: "숫자 (number)" },
  { value: "select", label: "단일 선택 (select)" },
  { value: "multi_select", label: "복수 선택 (multi_select)" },
  { value: "file", label: "파일 (file)" },
  { value: "boolean", label: "예/아니오 (boolean)" },
  { value: "signature", label: "서명 (signature)" },
] as const;

const SCOPE_OPTIONS = [
  { value: "document_fill", label: "서류작성 정보 (학생·센터 편집)" },
  { value: "university_info", label: "대학/학과 정보 (글로케어 편집·공개)" },
] as const;

export type DataTypeOption = {
  value: string;
  label_ko: string;
  label_vi: string;
};

export type DerivedFrom = {
  selector: string;
  map: Record<string, string>;
};

export type EditableDataType = {
  id: string;
  key: string;
  label_ko: string;
  label_vi: string;
  category: string;
  input_type: string;
  options: DataTypeOption[] | null;
  hint_ko: string | null;
  hint_vi: string | null;
  is_essay_basis: boolean;
  is_default_required: boolean;
  sort_order: number;
  is_active: boolean;
  scope: string;
  aliases: string[];
  is_derived: boolean;
  derived_role: string | null;
  derived_from: DerivedFrom | null;
};

/** 선택자·원본 후보를 고르기 위한 다른 데이터타입 요약 */
export type DataTypeRef = {
  id: string;
  key: string;
  label_ko: string;
  input_type: string;
  options: DataTypeOption[] | null;
};

export function DataTypeForm({
  dataType,
  allTypes = [],
}: {
  dataType?: EditableDataType;
  allTypes?: DataTypeRef[];
}) {
  const isEdit = !!dataType;
  const boundAction = isEdit
    ? saveDataTypeAction.bind(null, dataType!.id)
    : saveDataTypeAction.bind(null, null);
  const [state, action, pending] = useActionState<SaveDataTypeState, FormData>(
    boundAction,
    undefined
  );

  const [inputType, setInputType] = useState<string>(
    dataType?.input_type ?? "text"
  );
  const [options, setOptions] = useState<DataTypeOption[]>(
    dataType?.options ?? []
  );
  const [aliases, setAliases] = useState<string[]>(dataType?.aliases ?? []);
  const [aliasDraft, setAliasDraft] = useState("");

  function addAlias() {
    const v = aliasDraft.trim();
    if (v && !aliases.includes(v)) setAliases([...aliases, v]);
    setAliasDraft("");
  }

  // 택1/파생 설정
  const [isDerived, setIsDerived] = useState<boolean>(
    dataType?.is_derived ?? false
  );
  const [derivedRole, setDerivedRole] = useState<string>(
    dataType?.derived_role ?? ""
  );
  const [derivedSelector, setDerivedSelector] = useState<string>(
    dataType?.derived_from?.selector ?? ""
  );
  const [derivedMap, setDerivedMap] = useState<Record<string, string>>(
    dataType?.derived_from?.map ?? {}
  );

  // 선택자 후보 = select 타입이면서 자기 자신이 아닌 항목
  const selectorCandidates = allTypes.filter(
    (t) => t.input_type === "select" && t.key !== dataType?.key
  );
  const selectorType = allTypes.find((t) => t.key === derivedSelector);
  const selectorOptions = selectorType?.options ?? [];
  // 원본 후보 = 자기 자신·선택자를 제외한 모든 항목
  const sourceCandidates = allTypes.filter(
    (t) => t.key !== dataType?.key && t.key !== derivedSelector
  );

  const derivedFromValue =
    isDerived && derivedSelector
      ? JSON.stringify({ selector: derivedSelector, map: derivedMap })
      : "";

  const fieldErr = (k: string) => state?.fieldErrors?.[k];
  const showOptions = inputType === "select" || inputType === "multi_select";

  return (
    <Card className="p-6">
      <form action={action} className="space-y-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="식별자 key" error={fieldErr("key")} required>
            <input
              type="text"
              name="key"
              required
              maxLength={100}
              defaultValue={dataType?.key ?? ""}
              placeholder="예: highschool_gpa"
              pattern="[a-z][a-z0-9_]*"
              readOnly={isEdit}
              className="rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
            />
            <span className="text-xs text-muted-foreground">
              snake_case. 등록 후 변경 불가.
            </span>
          </Field>

          <Field label="카테고리" error={fieldErr("category")} required>
            <select
              name="category"
              required
              defaultValue={dataType?.category ?? "identity"}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {CATEGORY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="라벨 (한국어)" error={fieldErr("label_ko")} required>
            <input
              type="text"
              name="label_ko"
              required
              maxLength={200}
              defaultValue={dataType?.label_ko ?? ""}
              placeholder="예: 고등학교 GPA"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </Field>

          <Field label="라벨 (베트남어)" error={fieldErr("label_vi")} required>
            <input
              type="text"
              name="label_vi"
              required
              maxLength={200}
              defaultValue={dataType?.label_vi ?? ""}
              placeholder="예: GPA cấp 3"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </Field>

          <Field label="입력 형식" error={fieldErr("input_type")} required>
            <select
              name="input_type"
              required
              value={inputType}
              onChange={(e) => setInputType(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {INPUT_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="분류 (scope)">
            <select
              name="scope"
              defaultValue={dataType?.scope ?? "document_fill"}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {SCOPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="표시 순서">
            <input
              type="number"
              name="sort_order"
              min="0"
              max="9999"
              defaultValue={dataType?.sort_order ?? 0}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </Field>

          <Field label="입력 안내 (한국어)" full>
            <textarea
              name="hint_ko"
              rows={2}
              defaultValue={dataType?.hint_ko ?? ""}
              placeholder="유학센터 담당자가 입력할 때 참고할 안내"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </Field>

          <Field label="입력 안내 (베트남어)" full>
            <textarea
              name="hint_vi"
              rows={2}
              defaultValue={dataType?.hint_vi ?? ""}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </Field>
        </div>

        {/* select 옵션 */}
        {showOptions ? (
          <div className="rounded-md border border-dashed bg-muted/30 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">선택지</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setOptions([
                    ...options,
                    { value: "", label_ko: "", label_vi: "" },
                  ])
                }
              >
                <Plus className="size-4" />
                선택지 추가
              </Button>
            </div>
            {options.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                선택지가 없으면 텍스트 입력으로 fallback.
              </p>
            ) : (
              <div className="space-y-1">
                {options.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={opt.value}
                      onChange={(e) =>
                        setOptions(
                          options.map((o, i) =>
                            i === idx ? { ...o, value: e.target.value } : o
                          )
                        )
                      }
                      placeholder="value"
                      className="w-32 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    />
                    <input
                      type="text"
                      value={opt.label_ko}
                      onChange={(e) =>
                        setOptions(
                          options.map((o, i) =>
                            i === idx ? { ...o, label_ko: e.target.value } : o
                          )
                        )
                      }
                      placeholder="한국어"
                      className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    />
                    <input
                      type="text"
                      value={opt.label_vi}
                      onChange={(e) =>
                        setOptions(
                          options.map((o, i) =>
                            i === idx ? { ...o, label_vi: e.target.value } : o
                          )
                        )
                      }
                      placeholder="베트남어"
                      className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setOptions(options.filter((_, i) => i !== idx))
                      }
                      className="text-destructive hover:opacity-70"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <input
              type="hidden"
              name="options"
              value={JSON.stringify(options)}
            />
          </div>
        ) : null}

        {/* 별칭 (AI 매칭용 동의어) */}
        <div className="rounded-md border border-dashed bg-muted/30 p-4 space-y-2">
          <div className="text-sm font-medium">
            별칭 (AI 매칭용 동의어)
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              서류마다 다른 이름(예: 보호자 성명 · Guardian name)으로 적혀 있어도 이 항목으로 매칭됩니다.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={aliasDraft}
              onChange={(e) => setAliasDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addAlias();
                }
              }}
              placeholder="동의어 입력 후 Enter 또는 [추가]"
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <Button type="button" variant="outline" size="sm" onClick={addAlias}>
              <Plus className="size-4" />
              추가
            </Button>
          </div>
          {aliases.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {aliases.map((a) => (
                <span
                  key={a}
                  className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs"
                >
                  {a}
                  <button
                    type="button"
                    onClick={() => setAliases(aliases.filter((x) => x !== a))}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          ) : null}
          <input type="hidden" name="aliases" value={JSON.stringify(aliases)} />
        </div>

        {/* 택1/파생 (예: 보호자 = 아버지/어머니 중 택1) */}
        <div className="rounded-md border border-dashed bg-muted/30 p-4 space-y-3">
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={isDerived}
              onChange={(e) => setIsDerived(e.target.checked)}
            />
            <span>
              <strong>택1·파생 항목</strong> — 다른 “선택 기준” 항목의 값에 따라
              이 항목 값이 자동으로 결정됩니다.
              <span className="ml-1 text-xs text-muted-foreground">
                (예: 보호자 = 아버지/어머니 중 택1 → 보호자 성명은 선택에 맞춰
                아버지/어머니 성명에서 가져옴)
              </span>
            </span>
          </label>

          {isDerived ? (
            <div className="space-y-3 border-l-2 border-primary/30 pl-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="선택 기준 항목 (selector)">
                  <select
                    value={derivedSelector}
                    onChange={(e) => {
                      setDerivedSelector(e.target.value);
                      setDerivedMap({});
                    }}
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">— 선택하세요 —</option>
                    {selectorCandidates.map((t) => (
                      <option key={t.id} value={t.key}>
                        {t.label_ko} ({t.key})
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-muted-foreground">
                    단일 선택(select) 타입 항목만 기준이 될 수 있습니다.
                  </span>
                </Field>

                <Field label="역할 라벨 (선택)">
                  <input
                    type="text"
                    value={derivedRole}
                    onChange={(e) => setDerivedRole(e.target.value)}
                    placeholder="예: guardian"
                    className="rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
                  />
                  <span className="text-xs text-muted-foreground">
                    같은 선택을 공유하는 파생 항목들을 묶는 이름.
                  </span>
                </Field>
              </div>

              {derivedSelector ? (
                selectorCandidates.length === 0 ? null : selectorOptions.length ===
                  0 ? (
                  <p className="text-xs text-amber-600">
                    선택한 기준 항목에 선택지가 없습니다. 먼저 해당 항목에
                    선택지를 등록하세요.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <div className="text-sm font-medium">
                      선택별 원본 매핑
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        기준 항목의 각 선택지마다, 값을 가져올 원본 항목을
                        지정합니다.
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {selectorOptions.map((opt) => (
                        <div
                          key={opt.value}
                          className="flex items-center gap-2"
                        >
                          <span className="w-40 shrink-0 text-sm">
                            {opt.label_ko}
                            <span className="ml-1 font-mono text-xs text-muted-foreground">
                              {opt.value}
                            </span>
                          </span>
                          <span className="text-muted-foreground">→</span>
                          <select
                            value={derivedMap[opt.value] ?? ""}
                            onChange={(e) =>
                              setDerivedMap({
                                ...derivedMap,
                                [opt.value]: e.target.value,
                              })
                            }
                            className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                          >
                            <option value="">— 원본 항목 선택 —</option>
                            {sourceCandidates.map((t) => (
                              <option key={t.id} value={t.key}>
                                {t.label_ko} ({t.key})
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              ) : null}
            </div>
          ) : null}

          <input type="hidden" name="is_derived" value={isDerived ? "on" : ""} />
          <input
            type="hidden"
            name="derived_role"
            value={isDerived ? derivedRole : ""}
          />
          <input type="hidden" name="derived_from" value={derivedFromValue} />
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="is_essay_basis"
              defaultChecked={dataType?.is_essay_basis ?? false}
            />
            <span>
              <strong>작문 기초 데이터</strong> — 서술형 답변 생성 시 AI 가 참조
            </span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="is_default_required"
              defaultChecked={dataType?.is_default_required ?? false}
            />
            <span>기본 필수</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="is_active"
              defaultChecked={dataType?.is_active ?? true}
            />
            <span>활성</span>
          </label>
        </div>

        {state?.error ? (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.error}
          </div>
        ) : null}

        <div className="flex items-center justify-between border-t pt-4">
          <div className="flex items-center gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  저장 중...
                </>
              ) : (
                <>
                  <Check className="size-4" />
                  {isEdit ? "저장" : "등록"}
                </>
              )}
            </Button>
            <a
              href="/student-data-types"
              className={buttonVariants({ variant: "outline" })}
            >
              취소
            </a>
          </div>
          {isEdit ? <DeleteButton id={dataType!.id} keyName={dataType!.key} /> : null}
        </div>
      </form>
    </Card>
  );
}

function DeleteButton({ id, keyName }: { id: string; keyName: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false); // 사용처 조회 중
  const [busy, setBusy] = useState(false); // 삭제/비활성 실행 중
  const [usage, setUsage] = useState<DataTypeUsage | null>(null); // 경고 모달
  const [err, setErr] = useState<string | null>(null);

  async function onDeleteClick() {
    setErr(null);
    setLoading(true);
    const u = await getDataTypeUsageAction(id);
    setLoading(false);
    if (!u.ok) {
      setErr(u.error ?? "사용처 확인 실패");
      return;
    }
    if (u.total === 0) {
      if (confirm(`정말 "${keyName}" 데이터 타입을 삭제하시겠습니까?`)) {
        await runDelete(false);
      }
      return;
    }
    setUsage(u); // 연결 있음 → 경고 모달
  }

  async function runDelete(force: boolean) {
    setBusy(true);
    setErr(null);
    const res = await deleteDataTypeAction(id, force);
    setBusy(false);
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    setUsage(null);
    router.push("/student-data-types");
    router.refresh();
  }

  async function runDeactivate() {
    setBusy(true);
    setErr(null);
    const res = await deactivateDataTypeAction(id);
    setBusy(false);
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    setUsage(null);
    router.push("/student-data-types");
    router.refresh();
  }

  return (
    <>
      <div className="flex flex-col items-end gap-1">
        <Button
          type="button"
          variant="outline"
          disabled={loading || busy}
          className="text-destructive hover:bg-destructive/10"
          onClick={onDeleteClick}
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Trash2 className="size-4" />
          )}
          삭제
        </Button>
        {err ? <span className="text-xs text-destructive">{err}</span> : null}
      </div>

      {usage ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-md p-5 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-500" />
              <div>
                <h3 className="text-base font-semibold">
                  연결된 데이터가 있습니다
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  <code className="rounded bg-muted px-1">{keyName}</code> 에
                  연결된 항목이 있어 삭제 시 데이터가 깨질 수 있습니다.
                  <strong className="text-foreground"> 비활성화를 권장</strong>
                  합니다 (목록·입력에서 숨겨지지만 기존 값은 보존).
                </p>
              </div>
            </div>

            <ul className="space-y-1 rounded-md border bg-muted/30 p-3 text-sm">
              {usage.valueCount > 0 ? (
                <li className="flex justify-between">
                  <span>학생이 입력한 값</span>
                  <span className="font-medium">{usage.valueCount}건</span>
                </li>
              ) : null}
              {usage.formCount > 0 ? (
                <li className="flex justify-between">
                  <span>이 항목을 쓰는 양식</span>
                  <span className="font-medium">{usage.formCount}개</span>
                </li>
              ) : null}
              {usage.submissionCount > 0 ? (
                <li className="flex justify-between">
                  <span>이 항목을 쓰는 직접제출 서류</span>
                  <span className="font-medium">{usage.submissionCount}건</span>
                </li>
              ) : null}
              {usage.derivedRefs.length > 0 ? (
                <li>
                  <div className="flex justify-between">
                    <span>이 항목을 참조하는 파생 항목</span>
                    <span className="font-medium">
                      {usage.derivedRefs.length}개
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {usage.derivedRefs.join(", ")}
                  </div>
                </li>
              ) : null}
            </ul>

            {err ? (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => {
                  setUsage(null);
                  setErr(null);
                }}
              >
                취소
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                className="text-destructive hover:bg-destructive/10"
                onClick={() => {
                  if (
                    confirm(
                      `경고: "${keyName}" 를 강제 삭제하면 연결된 데이터 참조가 깨질 수 있습니다. 계속하시겠습니까?`
                    )
                  ) {
                    runDelete(true);
                  }
                }}
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                그래도 삭제
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={runDeactivate}
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Power className="size-4" />}
                비활성화 (권장)
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </>
  );
}

function Field({
  label,
  error,
  full,
  required,
  children,
}: {
  label: string;
  error?: string;
  full?: boolean;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${full ? "md:col-span-2" : ""}`}>
      <span className="text-sm font-medium">
        {label}
        {required ? <span className="text-destructive ml-0.5">*</span> : null}
      </span>
      {children}
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </label>
  );
}
