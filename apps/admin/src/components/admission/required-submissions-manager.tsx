"use client";

import {
  useActionState,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { ImageIcon, Loader2, Pencil, Plus, Save, Trash2, X } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  saveRequiredSubmissionAction,
  deleteRequiredSubmissionAction,
  type SaveRequiredSubmissionState,
} from "@/app/(app)/admissions/[universityId]/submissions-actions";

const STATUS_LABEL: Record<string, string> = {
  draft: "초안",
  approved: "승인 (학생 노출)",
  archived: "보관",
};

const TARGET_PERSON_OPTIONS = [
  { value: "self", label: "학생 본인" },
  { value: "father", label: "아버지" },
  { value: "mother", label: "어머니" },
  { value: "other", label: "기타" },
] as const;

const TARGET_PERSON_LABEL: Record<string, string> = Object.fromEntries(
  TARGET_PERSON_OPTIONS.map((o) => [o.value, o.label])
);

export type SubmissionRow = {
  id: string;
  department_id: number | null;
  base_submission_id: string | null;
  name_ko: string;
  name_vi: string | null;
  target_person: string | null;
  target_person_note: string | null;
  sample_image_url: string | null;
  issuance_requirements: {
    issuer?: string;
    validity_days?: number;
    lead_time_days?: number;
    needs_notarization?: boolean;
    needs_translation?: boolean;
    notes?: string;
  };
  required_data_type_keys: string[];
  aliases: string[];
  applies_to_languages: string[];
  applies_to_locations: string[];
  sort_order: number;
  is_active: boolean;
  status: string;
};

const SUB_LANGUAGE_OPTIONS = [
  { value: "korean", label: "한국어" },
  { value: "english", label: "영어" },
  { value: "other", label: "기타" },
] as const;
const SUB_LOCATION_OPTIONS = [
  { value: "domestic", label: "국내 (한국 체류)" },
  { value: "overseas", label: "해외 (한국 밖)" },
] as const;
const SUB_LANGUAGE_LABEL: Record<string, string> = Object.fromEntries(
  SUB_LANGUAGE_OPTIONS.map((o) => [o.value, o.label])
);
const SUB_LOCATION_LABEL: Record<string, string> = Object.fromEntries(
  SUB_LOCATION_OPTIONS.map((o) => [o.value, o.label])
);

export type DataTypeOption = {
  key: string;
  label_ko: string;
  category: string;
  is_essay_basis: boolean;
};

export type DepartmentOption = {
  id: number;
  name_ko: string;
};

export function RequiredSubmissionsManager({
  universityId,
  departments,
  dataTypes,
  submissions,
  mode = "university",
}: {
  /** 공용이면 null, 대학별이면 대학 id */
  universityId: number | null;
  departments: DepartmentOption[];
  dataTypes: DataTypeOption[];
  submissions: SubmissionRow[];
  mode?: "global" | "university";
}) {
  const isGlobal = mode === "global";
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const deptName = (deptId: number | null): string =>
    deptId === null
      ? "대학 전체"
      : departments.find((d) => d.id === deptId)?.name_ko ?? `학과 #${deptId}`;

  return (
    <div className="space-y-3">
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">
              {isGlobal ? "공용 제출서류 (전체 대학 공통)" : "대학 전용 제출서류"}
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {isGlobal
                ? "출입국·공통 요구 서류. 모든 대학에 기본 적용되며, 대학별 세부요건은 각 대학 입학서류에서 덮어씁니다."
                : "이 대학에만 해당하는 서류. 샘플 이미지·발급요건·대상자를 등록합니다."}
            </p>
          </div>
          <Button
            type="button"
            variant={adding ? "outline" : "default"}
            size="sm"
            onClick={() => {
              setAdding((v) => !v);
              setEditingId(null);
            }}
          >
            {adding ? (
              "취소"
            ) : (
              <>
                <Plus className="size-4" />
                서류 추가
              </>
            )}
          </Button>
        </div>

        {adding ? (
          <div className="mt-4">
            <SubmissionForm
              universityId={universityId}
              departments={departments}
              dataTypes={dataTypes}
              mode={mode}
              onDone={() => setAdding(false)}
            />
          </div>
        ) : null}
      </Card>

      {submissions.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          등록된 직접제출 서류가 없습니다.
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="divide-y divide-border">
            {submissions.map((s) => {
              const iss = s.issuance_requirements ?? {};
              const isEditing = editingId === s.id;
              return (
                <div key={s.id}>
                  <div className="flex items-start gap-3 px-4 py-3">
                    {/* 샘플 썸네일 */}
                    {s.sample_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <a
                        href={s.sample_image_url}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0"
                      >
                        <img
                          src={s.sample_image_url}
                          alt={s.name_ko}
                          className="size-14 rounded border object-cover"
                        />
                      </a>
                    ) : (
                      <div className="flex size-14 shrink-0 items-center justify-center rounded border border-dashed text-muted-foreground">
                        <ImageIcon className="size-5" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium">{s.name_ko}</span>
                        {s.name_vi ? (
                          <span className="text-xs text-muted-foreground">
                            {s.name_vi}
                          </span>
                        ) : null}
                        {s.target_person ? (
                          <Badge variant="secondary" className="text-[10px]">
                            대상:{" "}
                            {s.target_person === "other"
                              ? s.target_person_note || "기타"
                              : TARGET_PERSON_LABEL[s.target_person] ??
                                s.target_person}
                          </Badge>
                        ) : null}
                        {!isGlobal ? (
                          <Badge variant="outline" className="text-[10px]">
                            {deptName(s.department_id)}
                          </Badge>
                        ) : null}
                        {s.status === "approved" ? (
                          <Badge className="bg-success/10 text-success border-success/20 text-[10px]">
                            {STATUS_LABEL[s.status]}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">
                            {STATUS_LABEL[s.status] ?? s.status}
                          </Badge>
                        )}
                        {!s.is_active ? (
                          <Badge variant="outline" className="text-[10px]">
                            비활성
                          </Badge>
                        ) : null}
                      </div>

                      {/* 발급요건 요약 */}
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        {iss.issuer ? <span>발급처: {iss.issuer}</span> : null}
                        {iss.lead_time_days != null ? (
                          <span>리드타임: {iss.lead_time_days}일</span>
                        ) : null}
                        {iss.validity_days != null ? (
                          <span>유효기간: {iss.validity_days}일</span>
                        ) : null}
                        {iss.needs_notarization ? <span>공증 필요</span> : null}
                        {iss.needs_translation ? <span>번역 필요</span> : null}
                      </div>

                      {(s.aliases?.length ?? 0) > 0 ? (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {s.aliases.map((a) => (
                            <span
                              key={a}
                              className="rounded bg-muted px-1.5 py-0.5 text-[10px]"
                            >
                              {a}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingId((cur) => (cur === s.id ? null : s.id));
                          setAdding(false);
                        }}
                      >
                        <Pencil className="size-3" />
                      </Button>
                      <form
                        action={deleteRequiredSubmissionAction.bind(
                          null,
                          s.id,
                          universityId
                        )}
                        onSubmit={(e) => {
                          if (
                            !confirm(`"${s.name_ko}" 서류를 삭제하시겠습니까?`)
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
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </form>
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="border-t bg-muted/20 p-4">
                      <SubmissionForm
                        universityId={universityId}
                        departments={departments}
                        dataTypes={dataTypes}
                        mode={mode}
                        submission={s}
                        onDone={() => setEditingId(null)}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

export function SubmissionForm({
  universityId,
  departments,
  dataTypes,
  submission,
  mode = "university",
  baseSubmissionId = null,
  onDone,
}: {
  universityId: number | null;
  departments: DepartmentOption[];
  dataTypes: DataTypeOption[];
  submission?: SubmissionRow;
  mode?: "global" | "university";
  /** 대학별 오버라이드면 공용 마스터 id */
  baseSubmissionId?: string | null;
  onDone: () => void;
}) {
  const isGlobal = mode === "global";
  const isEdit = !!submission?.id;
  const bound = saveRequiredSubmissionAction.bind(null, submission?.id || null);
  const [state, action, pending] = useActionState<
    SaveRequiredSubmissionState,
    FormData
  >(bound, undefined);

  const iss = submission?.issuance_requirements ?? {};
  const [nameKo, setNameKo] = useState(submission?.name_ko ?? "");
  const [nameVi, setNameVi] = useState(submission?.name_vi ?? "");
  const [departmentId, setDepartmentId] = useState<string>(
    submission?.department_id != null ? String(submission.department_id) : ""
  );
  const [targetPerson, setTargetPerson] = useState<string>(
    submission?.target_person ?? ""
  );
  const [targetPersonNote, setTargetPersonNote] = useState<string>(
    submission?.target_person_note ?? ""
  );
  const [status, setStatus] = useState(submission?.status ?? "draft");
  const [isActive, setIsActive] = useState(submission?.is_active ?? true);
  const [sortOrder, setSortOrder] = useState<string>(
    String(submission?.sort_order ?? 0)
  );
  const [issuer, setIssuer] = useState(iss.issuer ?? "");
  const [validityDays, setValidityDays] = useState<string>(
    iss.validity_days != null ? String(iss.validity_days) : ""
  );
  const [leadTimeDays, setLeadTimeDays] = useState<string>(
    iss.lead_time_days != null ? String(iss.lead_time_days) : ""
  );
  const [needsNotarization, setNeedsNotarization] = useState(
    iss.needs_notarization ?? false
  );
  const [needsTranslation, setNeedsTranslation] = useState(
    iss.needs_translation ?? false
  );
  const [issNotes, setIssNotes] = useState(iss.notes ?? "");
  const [aliases, setAliases] = useState<string[]>(submission?.aliases ?? []);
  const [aliasDraft, setAliasDraft] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(
    new Set(submission?.required_data_type_keys ?? [])
  );
  const [appliesLanguages, setAppliesLanguages] = useState<string[]>(
    submission?.applies_to_languages ?? []
  );
  const [appliesLocations, setAppliesLocations] = useState<string[]>(
    submission?.applies_to_locations ?? []
  );
  const toggleIn = (
    list: string[],
    set: (v: string[]) => void,
    value: string
  ) =>
    set(
      list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
    );

  // 샘플 이미지
  const [sample, setSample] = useState<{
    base64: string;
    name: string;
    type: string;
    preview: string;
  } | null>(null);
  const [reading, setReading] = useState(false);

  useEffect(() => {
    if (state?.success) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const fieldErr = (k: string) => state?.fieldErrors?.[k];

  function addAlias() {
    const v = aliasDraft.trim();
    if (v && !aliases.includes(v)) setAliases([...aliases, v]);
    setAliasDraft("");
  }

  async function onPickSample(file: File) {
    setReading(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const comma = dataUrl.indexOf(",");
      const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
      setSample({
        base64,
        name: file.name,
        type: file.type || "image/png",
        preview: dataUrl,
      });
    } finally {
      setReading(false);
    }
  }

  const existingPreview = submission?.sample_image_url ?? null;

  return (
    <form
      action={(fd: FormData) => {
        fd.set("university_id", universityId != null ? String(universityId) : "");
        fd.set("base_submission_id", baseSubmissionId ?? "");
        fd.set("target_person", targetPerson);
        fd.set(
          "target_person_note",
          targetPerson === "other" ? targetPersonNote : ""
        );
        fd.set("required_data_type_keys", JSON.stringify(Array.from(selectedKeys)));
        fd.set("aliases", JSON.stringify(aliases));
        fd.set("applies_to_languages", JSON.stringify(appliesLanguages));
        fd.set("applies_to_locations", JSON.stringify(appliesLocations));
        if (sample) {
          fd.set("sample_base64", sample.base64);
          fd.set("sample_name", sample.name);
          fd.set("sample_type", sample.type);
        }
        action(fd);
      }}
      className="space-y-3"
    >
      <div className="text-sm font-semibold">
        {isEdit ? "서류 수정" : "새 직접제출 서류"}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="서류명 (한국어)" error={fieldErr("name_ko")} required>
          <input
            type="text"
            name="name_ko"
            required
            maxLength={300}
            value={nameKo}
            onChange={(e) => setNameKo(e.target.value)}
            placeholder="예: 고등학교 졸업증명서"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </Field>
        <Field label="서류명 (베트남어)">
          <input
            type="text"
            name="name_vi"
            maxLength={300}
            value={nameVi}
            onChange={(e) => setNameVi(e.target.value)}
            placeholder="예: Giấy chứng nhận tốt nghiệp"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </Field>

        <Field label="서류 대상자">
          <select
            value={targetPerson}
            onChange={(e) => setTargetPerson(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">— 미지정 —</option>
            {TARGET_PERSON_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {targetPerson === "other" ? (
            <input
              type="text"
              value={targetPersonNote}
              onChange={(e) => setTargetPersonNote(e.target.value)}
              maxLength={500}
              placeholder="대상자 설명 (예: 재정보증인)"
              className="mt-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          ) : null}
        </Field>

        {!isGlobal ? (
          <Field label="적용 범위">
            <select
              name="department_id"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">대학 전체 공통</option>
              {departments.map((d) => (
                <option key={d.id} value={String(d.id)}>
                  {d.name_ko} (학과 한정)
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        <Field label="상태">
          <select
            name="status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="draft">초안 (학생 비노출)</option>
            <option value="approved">승인 (학생 노출)</option>
            <option value="archived">보관</option>
          </select>
        </Field>
      </div>

      {/* 샘플 이미지 */}
      <div className="rounded-md border bg-background p-3 space-y-2">
        <div className="text-sm font-medium">샘플 이미지 (참고용)</div>
        <div className="flex items-center gap-3">
          {sample?.preview || existingPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={sample?.preview ?? existingPreview ?? ""}
              alt="샘플 미리보기"
              className="size-20 rounded border object-cover"
            />
          ) : (
            <div className="flex size-20 items-center justify-center rounded border border-dashed text-muted-foreground">
              <ImageIcon className="size-6" />
            </div>
          )}
          <div className="flex-1">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onPickSample(f);
              }}
              className="text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-secondary/80"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              학생이 “이런 서류를 준비하면 됩니다”로 참고할 예시. PNG/JPG, 최대
              10MB. {isEdit ? "비워두면 기존 이미지 유지." : ""}
            </p>
          </div>
        </div>
      </div>

      {/* 발급 요건 */}
      <div className="rounded-md border bg-background p-3 space-y-3">
        <div className="text-sm font-medium">발급 요건</div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Field label="발급처">
            <input
              type="text"
              name="iss_issuer"
              maxLength={300}
              value={issuer}
              onChange={(e) => setIssuer(e.target.value)}
              placeholder="예: 출신 고등학교"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </Field>
          <Field label="리드타임 (발급 소요일)">
            <input
              type="number"
              name="iss_lead_time_days"
              min="0"
              max="3650"
              value={leadTimeDays}
              onChange={(e) => setLeadTimeDays(e.target.value)}
              placeholder="예: 7"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </Field>
          <Field label="유효기간 (발급 후 일수)">
            <input
              type="number"
              name="iss_validity_days"
              min="0"
              max="36500"
              value={validityDays}
              onChange={(e) => setValidityDays(e.target.value)}
              placeholder="예: 90"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="iss_needs_notarization"
              checked={needsNotarization}
              onChange={(e) => setNeedsNotarization(e.target.checked)}
            />
            <span>공증 필요</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="iss_needs_translation"
              checked={needsTranslation}
              onChange={(e) => setNeedsTranslation(e.target.checked)}
            />
            <span>번역 필요</span>
          </label>
        </div>
        <Field label="발급 안내 메모">
          <textarea
            name="iss_notes"
            rows={2}
            value={issNotes}
            onChange={(e) => setIssNotes(e.target.value)}
            placeholder="예: 번역공증은 베트남 현지 공증사무소에서 진행. 영사확인 추가 필요할 수 있음."
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </Field>
      </div>

      {/* 별칭 */}
      <div className="rounded-md border bg-background p-3 space-y-2">
        <div className="text-sm font-medium">
          별칭 (AI 매칭용)
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            같은 서류의 다른 이름(예: 졸업증명서 · Bằng tốt nghiệp)
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
            placeholder="동의어 입력 후 Enter"
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
      </div>

      {/* 이 서류에서 뽑을 수 있는 표준데이터 */}
      <DataTypePicker
        dataTypes={dataTypes}
        selectedKeys={selectedKeys}
        setSelectedKeys={setSelectedKeys}
      />

      {/* 서류 분기 — 특정 언어/거주지 선택 학생에게만 적용 (빈값 = 전체) */}
      <div className="rounded-md border bg-background p-3 space-y-2">
        <div className="text-sm font-medium">
          적용 조건 (서류 분기)
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            비워두면 모든 학생. 선택하면 그 조건의 학생에게만 필요.
          </span>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-muted-foreground w-14">언어</span>
            {SUB_LANGUAGE_OPTIONS.map((o) => (
              <label key={o.value} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={appliesLanguages.includes(o.value)}
                  onChange={() =>
                    toggleIn(appliesLanguages, setAppliesLanguages, o.value)
                  }
                />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-muted-foreground w-14">거주지</span>
            {SUB_LOCATION_OPTIONS.map((o) => (
              <label key={o.value} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={appliesLocations.includes(o.value)}
                  onChange={() =>
                    toggleIn(appliesLocations, setAppliesLocations, o.value)
                  }
                />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="is_active"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          <span>활성</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">정렬</span>
          <input
            type="number"
            name="sort_order"
            min="0"
            max="9999"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="w-20 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          />
        </label>
      </div>

      {state?.error ? (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={pending || reading}>
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              저장 중...
            </>
          ) : reading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              이미지 읽는 중...
            </>
          ) : (
            <>
              <Save className="size-4" />
              {isEdit ? "저장" : "등록"}
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
    essay: "서술형",
    document: "발급 서류",
    other: "기타",
  };
  const toggleKey = (k: string) =>
    setSelectedKeys((cur) => {
      const next = new Set(cur);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  return (
    <div className="rounded-md border bg-background p-3 space-y-2">
      <div className="text-sm font-medium">
        이 서류에서 확인할 수 있는 정보 — {selectedKeys.size}개
        <span className="ml-2 text-xs font-normal text-muted-foreground">
          (AI가 서류에서 뽑아낼 표준데이터)
        </span>
      </div>
      <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
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

function Field({
  label,
  error,
  required,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium">
        {label}
        {required ? <span className="ml-0.5 text-destructive">*</span> : null}
      </span>
      {children}
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </label>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
