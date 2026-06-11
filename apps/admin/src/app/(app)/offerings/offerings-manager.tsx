"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, Plus, Save, Trash2, X, Eye, EyeOff } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  saveOfferingAction,
  deleteOfferingAction,
  updateOfferingStatusAction,
  type SaveOfferingState,
} from "./actions";

// ---------------------------------------------------------------------------
// 라벨 / 옵션
// ---------------------------------------------------------------------------
const STATUS_OPTIONS = [
  { value: "draft", label: "초안 (센터 비노출)" },
  { value: "published", label: "노출 (모집중)" },
  { value: "closed", label: "마감" },
  { value: "archived", label: "보관" },
] as const;
const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.map((o) => [o.value, o.label])
);

// ---------------------------------------------------------------------------
// 타입
// ---------------------------------------------------------------------------
export type OfferingRow = {
  id: string;
  university_id: number;
  department_id: number;
  term: string;
  intake_quota: number | null;
  status: string;
  source_spec_id: string | null;
  sort_order: number;
  notes: string | null;
};

export type UniversityOption = { id: number; name_ko: string };
export type DepartmentOption = {
  id: number;
  university_id: number;
  name_ko: string;
};
export type SpecOption = {
  id: string;
  university_id: number;
  term: string;
  status: string;
};

// ---------------------------------------------------------------------------
// 메인 매니저
// ---------------------------------------------------------------------------
export function OfferingsManager({
  universities,
  departments,
  specs,
  offerings,
}: {
  universities: UniversityOption[];
  departments: DepartmentOption[];
  specs: SpecOption[];
  offerings: OfferingRow[];
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const uniName = (id: number) =>
    universities.find((u) => u.id === id)?.name_ko ?? `대학 #${id}`;
  const deptName = (id: number) =>
    departments.find((d) => d.id === id)?.name_ko ?? `학과 #${id}`;

  // 대학 → 학기 → offering 으로 그룹핑
  const grouped = useMemo(() => {
    const byUni = new Map<number, OfferingRow[]>();
    for (const o of offerings) {
      if (!byUni.has(o.university_id)) byUni.set(o.university_id, []);
      byUni.get(o.university_id)!.push(o);
    }
    return Array.from(byUni.entries()).sort(([a], [b]) =>
      uniName(a).localeCompare(uniName(b), "ko")
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offerings, universities]);

  // term datalist (specs + offerings 의 알려진 학기들)
  const knownTerms = useMemo(() => {
    const s = new Set<string>();
    for (const sp of specs) s.add(sp.term);
    for (const o of offerings) s.add(o.term);
    return Array.from(s).sort().reverse();
  }, [specs, offerings]);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">모집 큐레이션</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              어느 대학·학과·학기를 유학센터에 줄지 결정하고, 학기별 모집수를
              관리합니다. <b>노출(모집중)</b> 상태여야 센터에 보입니다.
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
                모집 추가
              </>
            )}
          </Button>
        </div>

        {adding ? (
          <div className="mt-4">
            <OfferingForm
              universities={universities}
              departments={departments}
              specs={specs}
              knownTerms={knownTerms}
              onDone={() => setAdding(false)}
            />
          </div>
        ) : null}
      </Card>

      {offerings.length === 0 ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">
          아직 등록된 모집이 없습니다. 우측 상단 “모집 추가”로 시작하세요.
        </Card>
      ) : (
        grouped.map(([universityId, rows]) => (
          <Card key={universityId} className="overflow-hidden p-0">
            <div className="border-b bg-muted/30 px-4 py-2 text-sm font-semibold">
              {uniName(universityId)}
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {rows.length}개 모집
              </span>
            </div>
            <div className="divide-y divide-border">
              {rows
                .slice()
                .sort(
                  (a, b) =>
                    b.term.localeCompare(a.term) ||
                    a.sort_order - b.sort_order ||
                    deptName(a.department_id).localeCompare(
                      deptName(b.department_id),
                      "ko"
                    )
                )
                .map((o) => {
                  const isEditing = editingId === o.id;
                  const canPublish =
                    o.intake_quota != null && o.status !== "published";
                  return (
                    <div key={o.id}>
                      <div className="flex items-start gap-3 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-medium">
                              {deptName(o.department_id)}
                            </span>
                            <Badge variant="outline" className="text-[10px]">
                              {o.term}
                            </Badge>
                            {o.intake_quota != null ? (
                              <Badge variant="secondary" className="text-[10px]">
                                모집 {o.intake_quota}명
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="border-amber-300 text-[10px] text-amber-600"
                              >
                                모집수 미정
                              </Badge>
                            )}
                            {o.status === "published" ? (
                              <Badge className="border-success/20 bg-success/10 text-[10px] text-success">
                                {STATUS_LABEL[o.status]}
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px]">
                                {STATUS_LABEL[o.status] ?? o.status}
                              </Badge>
                            )}
                            {o.source_spec_id ? (
                              <span className="text-[10px] text-muted-foreground">
                                · 모집요강 연결됨
                              </span>
                            ) : null}
                          </div>
                          {o.notes ? (
                            <div className="mt-1 text-xs text-muted-foreground">
                              {o.notes}
                            </div>
                          ) : null}
                        </div>

                        <div className="flex shrink-0 items-center gap-1">
                          {canPublish ? (
                            <form
                              action={updateOfferingStatusAction.bind(
                                null,
                                o.id,
                                "published"
                              )}
                            >
                              <Button
                                type="submit"
                                variant="outline"
                                size="sm"
                                title="센터에 노출"
                              >
                                <Eye className="size-3" />
                                노출
                              </Button>
                            </form>
                          ) : null}
                          {o.status === "published" ? (
                            <form
                              action={updateOfferingStatusAction.bind(
                                null,
                                o.id,
                                "draft"
                              )}
                            >
                              <Button
                                type="submit"
                                variant="outline"
                                size="sm"
                                title="노출 중지"
                              >
                                <EyeOff className="size-3" />
                                숨김
                              </Button>
                            </form>
                          ) : null}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingId((cur) => (cur === o.id ? null : o.id));
                              setAdding(false);
                            }}
                          >
                            <Pencil className="size-3" />
                          </Button>
                          <form
                            action={deleteOfferingAction.bind(null, o.id)}
                            onSubmit={(e) => {
                              if (
                                !confirm(
                                  `"${deptName(o.department_id)} · ${o.term}" 모집을 삭제하시겠습니까?`
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
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          </form>
                        </div>
                      </div>

                      {isEditing ? (
                        <div className="border-t bg-muted/20 p-4">
                          <OfferingForm
                            universities={universities}
                            departments={departments}
                            specs={specs}
                            knownTerms={knownTerms}
                            offering={o}
                            onDone={() => setEditingId(null)}
                          />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 생성/수정 폼
// ---------------------------------------------------------------------------
function OfferingForm({
  universities,
  departments,
  specs,
  knownTerms,
  offering,
  onDone,
}: {
  universities: UniversityOption[];
  departments: DepartmentOption[];
  specs: SpecOption[];
  knownTerms: string[];
  offering?: OfferingRow;
  onDone: () => void;
}) {
  const isEdit = !!offering?.id;
  const bound = saveOfferingAction.bind(null, offering?.id || null);
  const [state, action, pending] = useActionState<SaveOfferingState, FormData>(
    bound,
    undefined
  );

  const [universityId, setUniversityId] = useState<string>(
    offering?.university_id != null ? String(offering.university_id) : ""
  );
  const [departmentId, setDepartmentId] = useState<string>(
    offering?.department_id != null ? String(offering.department_id) : ""
  );
  const [term, setTerm] = useState(offering?.term ?? "");
  const [intakeQuota, setIntakeQuota] = useState<string>(
    offering?.intake_quota != null ? String(offering.intake_quota) : ""
  );
  const [status, setStatus] = useState(offering?.status ?? "draft");
  const [sourceSpecId, setSourceSpecId] = useState<string>(
    offering?.source_spec_id ?? ""
  );
  const [sortOrder, setSortOrder] = useState<string>(
    String(offering?.sort_order ?? 0)
  );
  const [notes, setNotes] = useState(offering?.notes ?? "");

  useEffect(() => {
    if (state?.success) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const fieldErr = (k: string) => state?.fieldErrors?.[k];

  const uniId = universityId ? Number(universityId) : null;
  const deptOptions = departments.filter((d) => d.university_id === uniId);
  // 같은 대학의 모집요강 (학기 일치 우선 정렬)
  const specOptions = specs
    .filter((s) => s.university_id === uniId)
    .sort((a, b) => {
      const am = a.term === term ? 0 : 1;
      const bm = b.term === term ? 0 : 1;
      return am - bm || b.term.localeCompare(a.term);
    });

  return (
    <form
      action={(fd: FormData) => {
        fd.set("university_id", universityId);
        fd.set("department_id", departmentId);
        fd.set("source_spec_id", sourceSpecId);
        action(fd);
      }}
      className="space-y-3"
    >
      <div className="text-sm font-semibold">
        {isEdit ? "모집 수정" : "새 모집"}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="대학교" error={fieldErr("university_id")} required>
          <select
            value={universityId}
            onChange={(e) => {
              setUniversityId(e.target.value);
              setDepartmentId(""); // 대학 바뀌면 학과 초기화
              setSourceSpecId("");
            }}
            required
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">— 선택 —</option>
            {universities.map((u) => (
              <option key={u.id} value={String(u.id)}>
                {u.name_ko}
              </option>
            ))}
          </select>
        </Field>

        <Field label="학과" error={fieldErr("department_id")} required>
          <select
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            required
            disabled={!uniId}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
          >
            <option value="">
              {uniId ? "— 선택 —" : "먼저 대학을 선택하세요"}
            </option>
            {deptOptions.map((d) => (
              <option key={d.id} value={String(d.id)}>
                {d.name_ko}
              </option>
            ))}
          </select>
        </Field>

        <Field label="학기" error={fieldErr("term")} required>
          <input
            type="text"
            name="term"
            list="offering-terms"
            required
            maxLength={100}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="예: 2026-Spring"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <datalist id="offering-terms">
            {knownTerms.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </Field>

        <Field
          label="학기별 모집수 (글로케어 운영 인원)"
          error={fieldErr("intake_quota")}
        >
          <input
            type="number"
            name="intake_quota"
            min="0"
            max="100000"
            value={intakeQuota}
            onChange={(e) => setIntakeQuota(e.target.value)}
            placeholder="예: 5"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <span className="text-[11px] text-muted-foreground">
            노출(모집중) 상태에는 필수. 모집요강 정원과 별개인 실제 모집 인원.
          </span>
        </Field>

        <Field label="상태" error={fieldErr("status")}>
          <select
            name="status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="모집요강 연결 (선택)">
          <select
            value={sourceSpecId}
            onChange={(e) => setSourceSpecId(e.target.value)}
            disabled={!uniId}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
          >
            <option value="">— 연결 안 함 —</option>
            {specOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.term} · {s.status}
                {s.term === term ? " (학기 일치)" : ""}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="메모">
        <textarea
          name="notes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="큐레이션 메모 (내부용)"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </Field>

      <div className="flex items-center gap-3">
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
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              저장 중...
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
