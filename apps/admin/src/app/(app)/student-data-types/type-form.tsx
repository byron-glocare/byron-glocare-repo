"use client";

import { useActionState, useState } from "react";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  saveDataTypeAction,
  deleteDataTypeAction,
  type SaveDataTypeState,
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
  { value: "document", label: "첨부 파일" },
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
};

export function DataTypeForm({ dataType }: { dataType?: EditableDataType }) {
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
  return (
    <form
      action={deleteDataTypeAction.bind(null, id)}
      onSubmit={(e) => {
        if (
          !confirm(
            `정말 "${keyName}" 데이터 타입을 삭제하시겠습니까? 이 타입을 사용하는 양식과의 매핑도 해제됩니다.`
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <Button
        type="submit"
        variant="outline"
        className="text-destructive hover:bg-destructive/10"
      >
        <Trash2 className="size-4" />
        삭제
      </Button>
    </form>
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
