"use client";

import { useActionState, useEffect, useState } from "react";
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
};

/** (호환용) 다른 데이터타입 요약 — 더는 폼에서 쓰지 않지만 시그니처 유지 */
export type DataTypeRef = {
  id: string;
  key: string;
  label_ko: string;
  input_type: string;
  options: DataTypeOption[] | null;
};

export function DataTypeForm({
  dataType,
  inline = false,
  onSaved,
  onCancel,
}: {
  dataType?: EditableDataType;
  /** (호환용) 더는 사용하지 않음 */
  allTypes?: DataTypeRef[];
  /** 인라인 모드: 저장 후 화면 이동 없이 onSaved 콜백 호출 */
  inline?: boolean;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const isEdit = !!dataType;
  const boundAction = isEdit
    ? saveDataTypeAction.bind(null, dataType!.id)
    : saveDataTypeAction.bind(null, null);
  const [state, action, pending] = useActionState<SaveDataTypeState, FormData>(
    boundAction,
    undefined
  );

  // 인라인 저장 성공 시 → 화면 이동 없이 콜백
  useEffect(() => {
    if (inline && state?.ok) onSaved?.();
  }, [inline, state, onSaved]);

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

  const fieldErr = (k: string) => state?.fieldErrors?.[k];
  const showOptions = inputType === "select" || inputType === "multi_select";

  return (
    <Card className="p-6">
      <form
        action={action}
        onSubmit={(e) => {
          // key 를 전혀 다른 값으로 바꾸면 연결된 양식·값이 깨질 수 있음 → 경고
          if (!isEdit) return;
          const fd = new FormData(e.currentTarget);
          const newKey = String(fd.get("key") ?? "").trim();
          if (
            newKey !== dataType!.key &&
            !window.confirm(
              `식별자 key 를 "${dataType!.key}" → "${newKey}" 로 바꿉니다.\n\n` +
                "전혀 다른 key 로 변경하면 이 항목과 이미 연결된 양식·학생 값이 깨질 수 있습니다. " +
                "계속하시겠습니까?"
            )
          ) {
            e.preventDefault();
          }
        }}
        className="space-y-5"
      >
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
              className="rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
            />
            <span className="text-xs text-muted-foreground">
              snake_case. 변경 가능하나, 바꾸면 연결된 양식·값이 깨질 수 있습니다.
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

        </div>

        {/* 체크박스 3개 — 분류와 입력 안내 사이 */}
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

        {/* 입력 안내 (한/베) — 반반 한 줄 */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="입력 안내 (한국어)">
            <textarea
              name="hint_ko"
              rows={2}
              defaultValue={dataType?.hint_ko ?? ""}
              placeholder="유학센터 담당자가 입력할 때 참고할 안내"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </Field>
          <Field label="입력 안내 (베트남어)">
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

        {/* 별칭 (AI 매칭용 동의어) — 서류 라벨 자동 매칭용 */}
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

        {/* 표시 순서 — 가장 마지막 */}
        <div className="max-w-[220px]">
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
        </div>

        {inline ? <input type="hidden" name="__inline" value="1" /> : null}

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
            {inline ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => onCancel?.()}
              >
                닫기
              </Button>
            ) : (
              <a
                href="/student-data-types"
                className={buttonVariants({ variant: "outline" })}
              >
                취소
              </a>
            )}
            {inline && state?.ok ? (
              <span className="text-sm text-emerald-600">저장됨</span>
            ) : null}
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
