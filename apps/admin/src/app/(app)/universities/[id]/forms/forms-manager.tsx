"use client";

import {
  useActionState,
  useEffect,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import Link from "next/link";
import { Download, FileText, Loader2, Pencil, Plus, RotateCcw, Save, Trash2, Upload, X } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  uploadFormFileAction,
  deleteFormFileAction,
  restoreFormFileAction,
  updateFormFileMetaAction,
  addSuggestedDataTypeFromUploadAction,
  type UploadFormFileState,
  type UpdateFormFileMetaState,
} from "./actions";
import type { SuggestedMissingDataType } from "@/lib/admission/call-analyze-form";

const KEY_OPTIONS = [
  { value: "application_form", label: "입학원서" },
  { value: "self_intro", label: "자기소개서" },
  { value: "study_plan", label: "학업계획서" },
  { value: "financial_pledge_form", label: "재정보증서" },
  { value: "privacy_consent", label: "개인정보 동의서" },
  { value: "academic_record_release", label: "학적정보 제공 동의서" },
  { value: "recommendation_letter", label: "추천서" },
  { value: "health_certificate", label: "건강진단서 양식" },
  { value: "other", label: "기타" },
] as const;

const KEY_LABEL: Record<string, string> = Object.fromEntries(
  KEY_OPTIONS.map((o) => [o.value, o.label])
);

export type CurrentFormFile = {
  id: string;
  department_name: string | null;
  key: string;
  name_ko: string;
  file_url: string;
  file_name: string;
  size_bytes: number | null;
  uploaded_at: string;
  notes: string | null;
  required_data_type_keys: string[];
  essay_questions_count: number;
};

export type DataTypeOption = {
  key: string;
  label_ko: string;
  category: string;
  is_essay_basis: boolean;
};

export type ArchivedFormFile = {
  id: string;
  department_name: string | null;
  key: string;
  name_ko: string;
  file_url: string;
  file_name: string;
  uploaded_at: string;
};

export type DepartmentOption = {
  id: number;
  name_ko: string;
};

export function FormFilesManager({
  universityId,
  departments,
  dataTypes,
  currentFiles,
  archivedFiles,
}: {
  universityId: number;
  departments: DepartmentOption[];
  dataTypes: DataTypeOption[];
  currentFiles: CurrentFormFile[];
  archivedFiles: ArchivedFormFile[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<UploadFormFileState, FormData>(
    uploadFormFileAction,
    undefined
  );
  const [lastSuccess, setLastSuccess] = useState<{
    notes?: string;
    keys: number;
    questions: number;
    missing: SuggestedMissingDataType[];
  } | null>(null);
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const [addedKeys, setAddedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (state && !state.error && !state.fieldErrors && !pending) {
      setLastSuccess({
        notes: state.analyzeNotes,
        keys: state.analyzedKeys ?? 0,
        questions: state.analyzedQuestions ?? 0,
        missing: state.missingDataTypes ?? [],
      });
      setAddedKeys(new Set());
      setOpen(false);
    }
  }, [state, pending]);

  const onAddSuggestion = async (s: SuggestedMissingDataType) => {
    setAddingKey(s.key);
    try {
      const res = await addSuggestedDataTypeFromUploadAction(s);
      if (res.ok) {
        setAddedKeys((cur) => new Set(cur).add(s.key));
      }
    } finally {
      setAddingKey(null);
    }
  };

  // 대학 전체 vs 학과별 그룹 분리
  const universalFiles = currentFiles.filter((f) => f.department_name === null);
  const deptFiles = currentFiles.filter((f) => f.department_name !== null);

  // 학과별로 그룹
  const byDept = new Map<string, CurrentFormFile[]>();
  for (const f of deptFiles) {
    const key = f.department_name!;
    if (!byDept.has(key)) byDept.set(key, []);
    byDept.get(key)!.push(f);
  }

  const fieldErr = (k: string) => state?.fieldErrors?.[k];

  return (
    <div className="space-y-4">
      {/* 업로드 영역 */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">양식 업로드</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              같은 양식을 다시 올리면 이전 버전은 이력에 보관됩니다.
            </p>
          </div>
          <Button
            type="button"
            variant={open ? "outline" : "default"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? (
              "취소"
            ) : (
              <>
                <Plus className="size-4" />
                양식 추가
              </>
            )}
          </Button>
        </div>

        {open ? (
          <UploadFormInline
            action={action}
            pending={pending}
            state={state}
            fieldErr={fieldErr}
            universityId={universityId}
            departments={departments}
            dataTypes={dataTypes}
          />
        ) : null}

        {/* 업로드 성공 결과 알림 */}
        {lastSuccess && !open ? (
          <div className="mt-4 space-y-3">
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm">
              <div className="font-medium text-emerald-900">
                ✓ 업로드 완료
                {lastSuccess.questions > 0 || lastSuccess.keys > 0 ? (
                  <span>
                    {" "}— AI 자동 추출: 서술형 질문 {lastSuccess.questions}개
                    · 필요 데이터 {lastSuccess.keys}개
                  </span>
                ) : null}
              </div>
              {lastSuccess.notes ? (
                <div className="mt-1 text-xs text-emerald-800">
                  {lastSuccess.notes}
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => setLastSuccess(null)}
                className="mt-2 text-xs text-emerald-700 underline hover:no-underline"
              >
                닫기
              </button>
            </div>

            {/* AI 가 발견한 카탈로그 누락 항목 — 1클릭 추가 */}
            {lastSuccess.missing.length > 0 ? (
              <div className="rounded-md border border-violet-300 bg-violet-50 p-3 text-sm">
                <div className="font-semibold text-violet-900">
                  🆕 AI 가 발견한 카탈로그 누락 항목 ({lastSuccess.missing.length}개)
                </div>
                <p className="mt-1 text-xs text-violet-800">
                  양식이 요구하는데 표준 카탈로그에 없는 항목. 검토 후 "카탈로그에 추가" 누르면
                  즉시 표준 데이터로 등록됩니다.
                </p>
                <div className="mt-2 space-y-2">
                  {lastSuccess.missing.map((m) => {
                    const added = addedKeys.has(m.key);
                    const adding = addingKey === m.key;
                    return (
                      <div
                        key={m.key}
                        className={`rounded-md border bg-white p-2 ${
                          added
                            ? "border-emerald-300 opacity-60"
                            : "border-violet-200"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="text-sm font-medium">
                              {m.label_ko}{" "}
                              <span className="text-xs font-normal text-muted-foreground">
                                · {m.label_vi}
                              </span>
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
                              <code className="rounded bg-muted px-1 py-0.5">
                                {m.key}
                              </code>
                              <span className="rounded border border-input px-1 py-0.5">
                                {m.category}
                              </span>
                              <span className="rounded border border-input px-1 py-0.5">
                                {m.input_type}
                              </span>
                            </div>
                            {m.hint_ko ? (
                              <div className="mt-1 text-xs text-muted-foreground">
                                💡 {m.hint_ko}
                              </div>
                            ) : null}
                            {m.reason ? (
                              <div className="mt-0.5 text-[10px] text-muted-foreground">
                                이유: {m.reason}
                              </div>
                            ) : null}
                          </div>
                          <Button
                            type="button"
                            variant={added ? "outline" : "default"}
                            size="sm"
                            disabled={added || adding}
                            onClick={() => onAddSuggestion(m)}
                          >
                            {added
                              ? "✓ 추가됨"
                              : adding
                                ? "추가 중..."
                                : "카탈로그에 추가"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {addedKeys.size > 0 ? (
                  <p className="mt-2 text-xs text-emerald-700">
                    ✓ {addedKeys.size}개 추가됨. 다음 양식 분석부터 자동 매칭됩니다.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </Card>

      {/* 대학 전체 양식 */}
      <Card className="p-6">
        <h2 className="mb-3 text-base font-semibold">
          대학 전체 양식 ({universalFiles.length})
        </h2>
        {universalFiles.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            등록된 양식이 없습니다.
          </p>
        ) : (
          <FileTable
            files={universalFiles}
            universityId={universityId}
            departments={departments}
            dataTypes={dataTypes}
          />
        )}
      </Card>

      {/* 학과별 양식 (override) */}
      {byDept.size > 0 ? (
        <Card className="p-6">
          <h2 className="mb-3 text-base font-semibold">
            학과별 양식 (override)
          </h2>
          <p className="mb-3 text-xs text-muted-foreground">
            해당 학과 학생은 대학 전체 양식 대신 이 양식을 사용합니다.
          </p>
          {Array.from(byDept.entries()).map(([dept, files]) => (
            <div key={dept} className="mb-4 last:mb-0">
              <div className="mb-2 text-sm font-medium">
                <Badge variant="outline">{dept}</Badge>
              </div>
              <FileTable
                files={files}
                universityId={universityId}
                departments={departments}
                dataTypes={dataTypes}
              />
            </div>
          ))}
        </Card>
      ) : null}

      {/* 이력 (archive) */}
      {archivedFiles.length > 0 ? (
        <Card className="p-6">
          <details>
            <summary className="cursor-pointer text-sm font-medium hover:text-foreground">
              이력 — 이전 버전 ({archivedFiles.length})
            </summary>
            <div className="mt-3 overflow-hidden rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-medium">양식</th>
                    <th className="px-3 py-2 font-medium">학과</th>
                    <th className="px-3 py-2 font-medium">표시명</th>
                    <th className="px-3 py-2 font-medium">파일명</th>
                    <th className="px-3 py-2 font-medium">업로드</th>
                    <th className="w-32 px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {archivedFiles.map((f) => (
                    <tr key={f.id} className="border-t">
                      <td className="px-3 py-2 text-sm">
                        {KEY_LABEL[f.key] ?? f.key}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {f.department_name ?? "대학 전체"}
                      </td>
                      <td className="px-3 py-2">{f.name_ko}</td>
                      <td className="px-3 py-2 text-xs">
                        <a
                          href={f.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline"
                        >
                          {f.file_name}
                        </a>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {new Date(f.uploaded_at).toLocaleString("ko-KR")}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <form
                          action={restoreFormFileAction.bind(
                            null,
                            f.id,
                            universityId
                          )}
                          onSubmit={(e) => {
                            if (!confirm("이 버전을 현재 양식으로 복원하시겠습니까?")) {
                              e.preventDefault();
                            }
                          }}
                        >
                          <Button type="submit" variant="outline" size="sm">
                            <RotateCcw className="size-3" />
                            복원
                          </Button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </Card>
      ) : null}
    </div>
  );
}

function FileTable({
  files,
  universityId,
  departments,
  dataTypes,
}: {
  files: CurrentFormFile[];
  universityId: number;
  departments?: DepartmentOption[];
  dataTypes?: DataTypeOption[];
}) {
  const dtMap = new Map((dataTypes ?? []).map((d) => [d.key, d]));
  const [editingId, setEditingId] = useState<string | null>(null);
  return (
    <div className="overflow-hidden rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr className="text-left">
            <th className="w-32 px-3 py-2 font-medium">양식 종류</th>
            <th className="px-3 py-2 font-medium">표시명</th>
            <th className="px-3 py-2 font-medium">파일</th>
            <th className="w-24 px-3 py-2 text-right font-medium">크기</th>
            <th className="w-32 px-3 py-2 font-medium">업로드</th>
            <th className="w-40 px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {files.map((f) => (
            <FileRowFragment key={f.id}>
              <tr className="border-t">
                <td className="px-3 py-2">
                  <Badge variant="secondary">
                    {KEY_LABEL[f.key] ?? f.key}
                  </Badge>
                </td>
                <td className="px-3 py-2">
                  <div>{f.name_ko}</div>
                  {f.notes ? (
                    <div className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                      {f.notes}
                    </div>
                  ) : null}
                  {f.required_data_type_keys.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {f.required_data_type_keys.slice(0, 5).map((k) => {
                        const dt = dtMap.get(k);
                        return (
                          <span
                            key={k}
                            className="rounded bg-muted px-1.5 py-0.5 text-[10px]"
                            title={k}
                          >
                            {dt?.label_ko ?? k}
                          </span>
                        );
                      })}
                      {f.required_data_type_keys.length > 5 ? (
                        <span className="text-[10px] text-muted-foreground">
                          +{f.required_data_type_keys.length - 5}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-sm">
                  <a
                    href={f.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                    title={f.file_name}
                  >
                    <Download className="size-3" />
                    {f.file_name}
                  </a>
                </td>
                <td className="px-3 py-2 text-right text-xs text-muted-foreground">
                  {f.size_bytes
                    ? `${(f.size_bytes / 1024).toFixed(0)} KB`
                    : "—"}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {new Date(f.uploaded_at).toLocaleDateString("ko-KR")}
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      title="메타데이터 수정"
                      onClick={() =>
                        setEditingId((cur) => (cur === f.id ? null : f.id))
                      }
                    >
                      <Pencil className="size-3" />
                    </Button>
                    <Link
                      href={`/universities/${universityId}/forms/${f.id}/essay-questions`}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                      title="서술형 질문 정의"
                    >
                      <FileText className="size-3" />
                      {f.essay_questions_count > 0 ? (
                        <span className="ml-1">{f.essay_questions_count}</span>
                      ) : null}
                    </Link>
                    <form
                      action={deleteFormFileAction.bind(null, f.id, universityId)}
                      onSubmit={(e) => {
                        if (
                          !confirm(
                            `정말 "${f.name_ko}" 양식을 삭제하시겠습니까? 이전 버전도 모두 삭제됩니다.`
                          )
                        ) {
                          e.preventDefault();
                        }
                      }}
                    >
                      <Button
                        type="submit"
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10"
                        title="양식 삭제 (이전 버전 포함)"
                      >
                        <Trash2 className="size-3" />
                        삭제
                      </Button>
                    </form>
                  </div>
                </td>
              </tr>
              {editingId === f.id ? (
                <tr className="border-t bg-muted/20">
                  <td colSpan={6} className="p-4">
                    <EditFormMeta
                      file={f}
                      universityId={universityId}
                      departments={departments ?? []}
                      dataTypes={dataTypes ?? []}
                      onDone={() => setEditingId(null)}
                    />
                  </td>
                </tr>
              ) : null}
            </FileRowFragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FileRowFragment({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

function EditFormMeta({
  file,
  universityId,
  departments,
  dataTypes,
  onDone,
}: {
  file: CurrentFormFile;
  universityId: number;
  departments: DepartmentOption[];
  dataTypes: DataTypeOption[];
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState<
    UpdateFormFileMetaState,
    FormData
  >(updateFormFileMetaAction, undefined);

  const [formKey, setFormKey] = useState<string>(file.key);
  const [departmentName, setDepartmentName] = useState<string>(
    file.department_name ?? ""
  );
  const [nameKo, setNameKo] = useState<string>(file.name_ko);
  const [notes, setNotes] = useState<string>(file.notes ?? "");
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(
    new Set(file.required_data_type_keys)
  );

  useEffect(() => {
    if (state?.success) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const fieldErr = (k: string) => state?.fieldErrors?.[k];

  return (
    <form
      action={(fd: FormData) => {
        fd.set("form_file_id", file.id);
        fd.set("university_id", String(universityId));
        fd.set(
          "required_data_type_keys",
          JSON.stringify(Array.from(selectedKeys))
        );
        action(fd);
      }}
      className="space-y-3"
    >
      <div className="text-sm font-semibold">양식 정보 수정</div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium">양식 종류</span>
          <select
            name="key"
            value={formKey}
            onChange={(e) => setFormKey(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {KEY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium">적용 범위</span>
          <select
            name="department_name"
            value={departmentName}
            onChange={(e) => setDepartmentName(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">대학 전체</option>
            {departments.map((d) => (
              <option key={d.id} value={d.name_ko}>
                {d.name_ko} (학과별 override)
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 md:col-span-2">
          <span className="text-xs font-medium">표시명</span>
          <input
            type="text"
            name="name_ko"
            required
            maxLength={500}
            value={nameKo}
            onChange={(e) => setNameKo(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          {fieldErr("name_ko") ? (
            <span className="text-xs text-destructive">
              {fieldErr("name_ko")}
            </span>
          ) : null}
        </label>

        <label className="flex flex-col gap-1.5 md:col-span-2">
          <span className="text-xs font-medium">메모 (선택)</span>
          <input
            type="text"
            name="notes"
            maxLength={1000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
      </div>

      <DataTypePicker
        dataTypes={dataTypes}
        selectedKeys={selectedKeys}
        setSelectedKeys={setSelectedKeys}
      />

      {state?.error ? (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              저장 중...
            </>
          ) : (
            <>
              <Save className="size-4" />
              저장
            </>
          )}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onDone}>
          <X className="size-4" />
          취소
        </Button>
      </div>
    </form>
  );
}

function DataTypePicker({
  dataTypes,
  selectedKeys,
  setSelectedKeys,
}: {
  dataTypes: DataTypeOption[];
  selectedKeys: Set<string>;
  setSelectedKeys: Dispatch<SetStateAction<Set<string>>>;
}) {
  const byCategory = new Map<string, DataTypeOption[]>();
  for (const dt of dataTypes) {
    if (!byCategory.has(dt.category)) byCategory.set(dt.category, []);
    byCategory.get(dt.category)!.push(dt);
  }
  const categoryOrder = [
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
  const categoryLabelKo: Record<string, string> = {
    identity: "신원",
    education: "학력",
    family: "가족",
    financial: "재정",
    language: "어학",
    contact: "연락처",
    career: "경력·자격",
    essay: "서술형 (작문 기초)",
    document: "발급 서류",
    other: "기타",
  };
  const toggleKey = (k: string) => {
    setSelectedKeys((cur) => {
      const next = new Set(cur);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  return (
    <div className="rounded-md border bg-background p-3 space-y-2">
      <div className="text-xs font-medium">
        필요한 정보 — {selectedKeys.size}개 선택
      </div>
      <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
        {categoryOrder
          .filter((c) => byCategory.has(c))
          .map((cat) => (
            <div key={cat}>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {categoryLabelKo[cat] ?? cat}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {byCategory.get(cat)!.map((dt) => {
                  const checked = selectedKeys.has(dt.key);
                  return (
                    <label
                      key={dt.key}
                      className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${
                        checked
                          ? "border-primary bg-primary/10"
                          : "border-input hover:bg-muted/50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleKey(dt.key)}
                        className="size-3"
                      />
                      {dt.label_ko}
                      {dt.is_essay_basis ? (
                        <span className="text-[9px] text-amber-700">✎</span>
                      ) : null}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

function UploadFormInline({
  action,
  pending,
  state,
  fieldErr,
  universityId,
  departments,
  dataTypes,
}: {
  action: (formData: FormData) => void;
  pending: boolean;
  state: UploadFormFileState;
  fieldErr: (k: string) => string | undefined;
  universityId: number;
  departments: DepartmentOption[];
  dataTypes: DataTypeOption[];
}) {
  const [fileMeta, setFileMeta] = useState<{
    base64: string;
    name: string;
    size: number;
    type: string;
  } | null>(null);
  const [reading, setReading] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  // controlled inputs — 폼 제출 후 reset 으로 값 날아가지 않도록
  const [formKey, setFormKey] = useState<string>("application_form");
  const [departmentName, setDepartmentName] = useState<string>("");
  const [nameKo, setNameKo] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [autoAnalyze, setAutoAnalyze] = useState<boolean>(true);

  // 성공 시 (state 가 정의됐고 에러 없고 pending false) 모든 상태 초기화
  useEffect(() => {
    if (state && !state.error && !state.fieldErrors && !pending) {
      setFileMeta(null);
      setSelectedKeys(new Set());
      setFormKey("application_form");
      setDepartmentName("");
      setNameKo("");
      setNotes("");
      setAutoAnalyze(true);
    }
  }, [state, pending]);

  // 카테고리별 그룹화
  const byCategory = new Map<string, DataTypeOption[]>();
  for (const dt of dataTypes) {
    if (!byCategory.has(dt.category)) byCategory.set(dt.category, []);
    byCategory.get(dt.category)!.push(dt);
  }
  const categoryOrder = [
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
  const categoryLabelKo: Record<string, string> = {
    identity: "신원",
    education: "학력",
    family: "가족",
    financial: "재정",
    language: "어학",
    contact: "연락처",
    career: "경력·자격",
    essay: "서술형 (작문 기초)",
    document: "발급 서류",
    other: "기타",
  };

  const toggleKey = (k: string) => {
    setSelectedKeys((cur) => {
      const next = new Set(cur);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  // 성공 시 닫기 (state === undefined && pending false 인데 폼 사용한 적 있으면)
  // 간단하게: 폼 submit 후 file 클리어
  const onFileChange = async (file: File) => {
    setReading(true);
    try {
      const base64 = await fileToBase64(file);
      setFileMeta({
        base64,
        name: file.name,
        size: file.size,
        type: file.type,
      });
    } finally {
      setReading(false);
    }
  };

  // 폼 submit 후 성공 감지 (state === undefined && fileMeta 있음 → submit 직후)
  // 단순화: 부모가 reload 하므로 자동 새로고침 됨

  return (
    <form
      action={(fd: FormData) => {
        if (!fileMeta) return;
        fd.set("file_base64", fileMeta.base64);
        fd.set("file_name", fileMeta.name);
        fd.set("file_size", String(fileMeta.size));
        fd.set("mime_type", fileMeta.type);
        fd.set("university_id", String(universityId));
        fd.set(
          "required_data_type_keys",
          JSON.stringify(Array.from(selectedKeys))
        );
        // auto_analyze 는 checkbox 의 on/off 자체로 처리
        action(fd);
        // 폼 닫기 / 초기화는 부모의 useEffect 가 state 변화 보고 처리
      }}
      className="mt-4 space-y-3 rounded-md border bg-muted/30 p-4"
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">
            양식 종류 <span className="text-destructive">*</span>
          </span>
          <select
            name="key"
            required
            value={formKey}
            onChange={(e) => setFormKey(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {KEY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {fieldErr("key") ? (
            <span className="text-xs text-destructive">{fieldErr("key")}</span>
          ) : null}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">적용 범위</span>
          <select
            name="department_name"
            value={departmentName}
            onChange={(e) => setDepartmentName(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">대학 전체</option>
            {departments.map((d) => (
              <option key={d.id} value={d.name_ko}>
                {d.name_ko} (학과별 override)
              </option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground">
            특정 학과 선택 시 해당 학과만 이 양식 사용.
          </span>
        </label>

        <label className="flex flex-col gap-1.5 md:col-span-2">
          <span className="text-sm font-medium">
            표시명 <span className="text-destructive">*</span>
          </span>
          <input
            type="text"
            name="name_ko"
            required
            maxLength={500}
            value={nameKo}
            onChange={(e) => setNameKo(e.target.value)}
            placeholder="예: 2026학년도 외국인 특별전형 입학원서"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          {fieldErr("name_ko") ? (
            <span className="text-xs text-destructive">
              {fieldErr("name_ko")}
            </span>
          ) : null}
        </label>

        <label className="flex flex-col gap-1.5 md:col-span-2">
          <span className="text-sm font-medium">
            파일 <span className="text-destructive">*</span>
          </span>
          <input
            type="file"
            accept=".hwp,.hwpx,.pdf,.docx,application/pdf,application/x-hwp,application/vnd.hancom.hwpx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            required
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFileChange(f);
            }}
            className="text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-secondary/80"
          />
          {fileMeta ? (
            <span className="text-xs text-muted-foreground">
              선택됨: {fileMeta.name} ({(fileMeta.size / 1024).toFixed(0)} KB)
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">
              HWP / HWPX / PDF / DOCX 지원. 최대 30MB.
            </span>
          )}
        </label>

        <label className="flex flex-col gap-1.5 md:col-span-2">
          <span className="text-sm font-medium">메모 (선택)</span>
          <input
            type="text"
            name="notes"
            maxLength={1000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="예: 2026년 봄학기 개정판"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
      </div>

      {/* AI 자동 분석 토글 */}
      <div className="rounded-md border border-amber-300 bg-amber-50 p-3">
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            name="auto_analyze"
            checked={autoAnalyze}
            onChange={(e) => setAutoAnalyze(e.target.checked)}
            className="mt-0.5"
          />
          <div>
            <div className="text-sm font-medium text-amber-900">
              ✨ AI 자동 분석 (권장)
            </div>
            <div className="mt-0.5 text-xs text-amber-800">
              업로드 후 Claude 가 양식을 읽고 서술형 질문 + 필요 데이터 키를
              자동 추출합니다. 약 30-60초 추가 소요. 끄면 빠르지만 수동 입력 필요.
            </div>
          </div>
        </label>
      </div>

      {/* 양식이 요구하는 데이터 타입 선택 — 수동 보조 */}
      <div className="rounded-md border bg-background p-3 space-y-2">
        <div>
          <div className="text-sm font-medium">
            (선택) 수동으로 필요한 정보 미리 체크 — {selectedKeys.size}개
          </div>
          <div className="text-xs text-muted-foreground">
            AI 자동 분석을 켜면 비워둬도 OK. 수동 추가분은 AI 결과와 합쳐집니다.
          </div>
        </div>
        <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
          {categoryOrder
            .filter((c) => byCategory.has(c))
            .map((cat) => (
              <div key={cat}>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {categoryLabelKo[cat] ?? cat}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {byCategory.get(cat)!.map((dt) => {
                    const checked = selectedKeys.has(dt.key);
                    return (
                      <label
                        key={dt.key}
                        className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${
                          checked
                            ? "border-primary bg-primary/10"
                            : "border-input hover:bg-muted/50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleKey(dt.key)}
                          className="size-3"
                        />
                        {dt.label_ko}
                        {dt.is_essay_basis ? (
                          <span className="text-[9px] text-amber-700">✎</span>
                        ) : null}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
        <p className="text-[10px] text-muted-foreground">
          ✎ 표시: 작문 기초 데이터 (AI 작문 생성 시 사용)
        </p>
      </div>

      {state?.error ? (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending || reading || !fileMeta}>
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              업로드 + AI 분석 중... (30-60초)
            </>
          ) : reading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              파일 읽는 중...
            </>
          ) : (
            <>
              <Upload className="size-4" />
              업로드
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result as string;
      const comma = r.indexOf(",");
      resolve(comma >= 0 ? r.slice(comma + 1) : r);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
