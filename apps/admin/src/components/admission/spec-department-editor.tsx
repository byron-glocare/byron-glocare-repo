"use client";

/**
 * 모집요강 편집 — 학과 탭.
 *   어학당(항상 맨 앞, 삭제 불가) + 일반학과. 학과마다 카드 하나 = 폼 하나 = 저장 버튼 하나.
 *   학과가 가진 것: 마스터·정보, 학비, 장학금, 자격(학과별), 발급서류 항목, 작성서류 양식(읽기), 어학당은 어학연수 프로그램.
 *   가져오기(복사)·학과 추가는 다이얼로그 → 서버 액션 → router.refresh().
 *   카드 key 에 revision 을 넣어 서버 데이터가 바뀌면 필드 초기값이 다시 잡히게 한다.
 */

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Copy, Eye, EyeOff, FileText, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TuitionField, type Tuition } from "@/components/admission/tuition-field";
import { ScholarshipsField, type Scholarship } from "@/components/admission/scholarships-field";
import { EligibilityField, type Eligibility } from "@/components/admission/eligibility-field";
import { SpecDocItemsField } from "@/components/admission/spec-doc-items-field";
import type { DocCatalog, SpecDocItemRow } from "@/lib/admission/spec-doc-items";
import type { SpecDepartment, SpecDepartmentKind, SpecFormFile } from "@/lib/admission/spec-departments";
import {
  addSpecDepartmentAction,
  copyDepartmentSetupAction,
  deleteSpecDepartmentAction,
  saveSpecDepartmentAction,
  setSpecDepartmentActiveAction,
  type CopyWhat,
  type DeptActionState,
} from "@/app/(app)/admissions/specs/[id]/edit/department-actions";

const KIND_LABEL: Record<SpecDepartmentKind, string> = { language: "어학당", regular: "일반학과" };
const LANGUAGE_RE = /(어학|한국어|연수)/;
const inputClass = "rounded-md border border-input bg-background px-2 py-1.5 text-sm";

export type DeptMaster = { id: number; name_ko: string; active: boolean };
export type CopySourceUniversity = {
  university_id: number;
  name_ko: string;
  departments: Array<{ id: string; name_ko: string; kind: SpecDepartmentKind }>;
};

export function SpecDepartmentEditor({
  specId,
  universityId,
  departments,
  masters,
  docRowsByDept,
  formFilesByDept,
  catalog,
  copySources,
  revisions,
  specEligibility = null,
}: {
  specId: string;
  universityId: number;
  departments: SpecDepartment[];
  masters: DeptMaster[];
  docRowsByDept: Record<string, SpecDocItemRow[]>;
  formFilesByDept: Record<string, SpecFormFile[]>;
  catalog: DocCatalog;
  copySources: CopySourceUniversity[];
  /** 학과별 서버 데이터 버전 — 바뀌면 카드를 다시 마운트한다 */
  revisions: Record<string, string>;
  /** 옛 요강 공통 자격 — 학과 자격이 비어 있을 때 편집기 초기값으로만 쓴다(저장하면 학과 것이 된다) */
  specEligibility?: Eligibility | null;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          어학당은 요강마다 하나이며 지울 수 없습니다. 일반학과는 다른 학과 설정을 복사해 시작한 뒤 각자 고칩니다.
        </p>
        <AddDepartmentDialog specId={specId} departments={departments} masters={masters} copySources={copySources} />
      </div>
      {departments.map((sd) => (
        <DepartmentCard
          key={`${sd.id}:${revisions[sd.id] ?? ""}`}
          specId={specId}
          universityId={universityId}
          sd={sd}
          siblings={departments.filter((d) => d.id !== sd.id)}
          masters={masters}
          docRows={docRowsByDept[sd.id] ?? []}
          formFiles={formFilesByDept[sd.id] ?? []}
          catalog={catalog}
          copySources={copySources}
          specEligibility={specEligibility}
        />
      ))}
      {departments.length === 0 ? (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">요강 학과가 없습니다.</div>
      ) : null}
    </div>
  );
}

// ── 학과 카드 ─────────────────────────────────────────────────────────

function DepartmentCard({
  specId,
  universityId,
  sd,
  siblings,
  masters,
  docRows,
  formFiles,
  catalog,
  copySources,
  specEligibility,
}: {
  specId: string;
  universityId: number;
  sd: SpecDepartment;
  siblings: SpecDepartment[];
  masters: DeptMaster[];
  docRows: SpecDocItemRow[];
  formFiles: SpecFormFile[];
  catalog: DocCatalog;
  copySources: CopySourceUniversity[];
  specEligibility: Eligibility | null;
}) {
  const router = useRouter();
  const bound = saveSpecDepartmentAction.bind(null, specId, sd.id);
  const [state, action, pending] = useActionState<DeptActionState, FormData>(bound, undefined);
  const [busy, startTransition] = useTransition();
  // 자격은 학과별. 학과 자격이 비어 있으면 옛 요강 공통 자격으로 시작한다(저장하면 이 학과 것이 된다).
  const initialEligibility = (sd.eligibility && Object.keys(sd.eligibility).length ? (sd.eligibility as Eligibility) : specEligibility) ?? null;
  const lp = sd.info.language_program ?? {};

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(`${sd.name_ko} 저장됨`);
      router.refresh();
    } else toast.error("저장 실패", { description: state.error });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const masterOptions = useMemo(() => {
    const list = sd.kind === "language" ? masters.filter((m) => LANGUAGE_RE.test(m.name_ko) || m.id === sd.department_id) : masters;
    return list.some((m) => m.id === sd.department_id) ? list : [{ id: sd.department_id, name_ko: sd.name_ko, active: sd.department_active }, ...list];
  }, [masters, sd]);

  const toggleActive = () =>
    startTransition(async () => {
      const res = await setSpecDepartmentActiveAction(specId, sd.id, !sd.is_active);
      if (res.ok) {
        toast.success(sd.is_active ? "비활성으로 바꿨습니다" : "활성으로 바꿨습니다");
        router.refresh();
      } else toast.error(res.error);
    });

  const remove = () => {
    if (!confirm(`${sd.name_ko} 학과를 이 요강에서 지울까요? 발급서류 항목은 함께 지워지고, 양식은 현행에서 내려갑니다.`)) return;
    startTransition(async () => {
      const res = await deleteSpecDepartmentAction(specId, sd.id);
      if (res.ok) {
        toast.success("학과를 지웠습니다");
        router.refresh();
      } else toast.error("지울 수 없습니다", { description: res.error });
    });
  };

  const fieldErr = (k: string) => (state && !state.ok ? state.fieldErrors?.[k] : undefined);

  return (
    <Card className={`p-5 ${sd.is_active ? "" : "opacity-80"}`}>
      <form action={action} className="space-y-4">
        <input type="hidden" name="is_active" value={sd.is_active ? "on" : ""} />
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold">{sd.name_ko}</h3>
          <Badge variant={sd.kind === "language" ? "default" : "secondary"}>{KIND_LABEL[sd.kind]}</Badge>
          {!sd.is_active ? <Badge variant="outline" className="text-muted-foreground">비활성</Badge> : null}
          {!sd.department_active ? <Badge variant="outline" className="text-amber-600">마스터 비노출</Badge> : null}
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <CopySetupDialog specId={specId} target={sd} siblings={siblings} copySources={copySources} />
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={toggleActive}>
              {sd.is_active ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              {sd.is_active ? "비활성" : "활성"}
            </Button>
            {sd.kind === "regular" ? (
              <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={busy} onClick={remove}>
                <Trash2 className="size-3.5" />
                삭제
              </Button>
            ) : null}
          </div>
        </div>

        {/* 마스터 + 정보 */}
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <label className="col-span-2 flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">학과 마스터</span>
            <select name="department_id" defaultValue={sd.department_id} className={inputClass}>
              {masterOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name_ko}
                  {m.active ? "" : " (비노출)"}
                </option>
              ))}
            </select>
            {fieldErr("department_id") ? <span className="text-xs text-destructive">{fieldErr("department_id")}</span> : null}
          </label>
          <Text label="학부" name="info_faculty" defaultValue={sd.info.faculty ?? ""} placeholder="예: 보건" />
          <Text label="트랙" name="info_track" defaultValue={sd.info.track ?? ""} placeholder="예: 영어트랙" />
          <Num label="년수" name="info_years" defaultValue={sd.info.years ?? null} min={1} max={6} />
          <Text label="정원" name="info_capacity" defaultValue={sd.info.capacity == null ? "" : String(sd.info.capacity)} placeholder="숫자 또는 '약간명'" />
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">TOPIK 최소</span>
            <select name="info_topik" defaultValue={sd.info.korean_min_topik ?? ""} className={inputClass}>
              <option value="">—</option>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>{n}급</option>
              ))}
            </select>
          </label>
          <label className="col-span-2 flex flex-col gap-1 md:col-span-4">
            <span className="text-xs text-muted-foreground">메모</span>
            <input type="text" name="info_notes" defaultValue={sd.info.notes ?? ""} className={inputClass} placeholder="추가 안내사항" />
          </label>
        </div>

        <Section title={`발급서류 항목 (${docRows.length})`} open>
          <SpecDocItemsField name="dept_doc_items" initial={docRows} catalog={catalog} />
        </Section>

        <Section title={`작성서류 양식 (${formFiles.length})`} open>
          <FormFilesList files={formFiles} universityId={universityId} sdId={sd.id} />
        </Section>

        <Section title="학비">
          <TuitionField name="dept_tuition" initial={(Object.keys(sd.tuition).length ? sd.tuition : null) as Tuition | null} />
        </Section>

        <Section title={`장학금 (${sd.scholarships.length})`}>
          <ScholarshipsField name="dept_scholarships" initial={sd.scholarships as Scholarship[]} />
        </Section>

        <Section title="지원 자격">
          {!sd.eligibility && specEligibility ? (
            <p className="mb-2 text-xs text-muted-foreground">이 학과의 자격이 아직 없어 옛 요강 공통 자격을 보여줍니다. 저장하면 이 학과의 자격이 됩니다.</p>
          ) : null}
          <EligibilityField name="dept_eligibility" initial={initialEligibility} />
        </Section>

        {sd.kind === "language" ? (
          <Section title="어학연수 프로그램" open>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              <Num label="학기당 시간" name="lp_hours_per_semester" defaultValue={lp.hours_per_semester ?? null} min={0} />
              <Num label="주당 시간" name="lp_hours_per_week" defaultValue={lp.hours_per_week ?? null} min={0} />
              <Num label="학기 주수" name="lp_weeks_per_semester" defaultValue={lp.weeks_per_semester ?? null} min={0} />
              <Text label="주간 시간표" name="lp_weekly_schedule" defaultValue={lp.weekly_schedule ?? ""} placeholder="예: 월-금 09:00-13:00" />
              <Text label="비자" name="lp_visa_type" defaultValue={lp.visa_type ?? ""} placeholder="D-4" />
              <Text label="연장 비자" name="lp_visa_extension" defaultValue={lp.visa_extension ?? ""} placeholder="예: 학기마다 연장" />
            </div>
          </Section>
        ) : null}

        {state && !state.ok ? <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</div> : null}

        <div className="flex items-center gap-2 border-t pt-3">
          <Button type="submit" size="sm" disabled={pending || busy}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            {sd.name_ko} 저장
          </Button>
        </div>
      </form>
    </Card>
  );
}

function FormFilesList({ files, universityId, sdId }: { files: SpecFormFile[]; universityId: number; sdId: string }) {
  const uploadHref = `/admissions/forms/new?university_id=${universityId}&spec_department_id=${encodeURIComponent(sdId)}`;
  return (
    <div className="space-y-2">
      {files.length === 0 ? (
        <p className="text-xs text-muted-foreground">이 학과의 작성서류 양식이 없습니다.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {files.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2">
              <FileText className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="font-medium">{f.name_ko}</span>
              <span className="text-xs text-muted-foreground">{f.key}</span>
              {f.is_essay ? <Badge variant="outline" className="text-[10px]">서술형</Badge> : null}
              <span className="ml-auto flex items-center gap-1.5">
                <Link href={`/admissions/forms/${f.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  편집
                </Link>
                <a href={f.file_url} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground underline" title={f.file_name}>
                  파일
                </a>
              </span>
            </li>
          ))}
        </ul>
      )}
      <Link href={uploadHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
        <Upload className="size-3.5" />
        양식 업로드
      </Link>
    </div>
  );
}

// ── 가져오기(복사) ─────────────────────────────────────────────────────

const WHAT_LABEL: Array<{ key: keyof CopyWhat; label: string }> = [
  { key: "docs", label: "발급서류 항목" },
  { key: "forms", label: "작성서류 양식" },
  { key: "tuition", label: "학비" },
  { key: "scholarships", label: "장학금" },
  { key: "eligibility", label: "자격" },
];
const ALL_WHAT: CopyWhat = { docs: true, forms: true, tuition: true, scholarships: true, eligibility: true };

function CopySourcePicker({
  siblings,
  copySources,
  value,
  onChange,
}: {
  siblings: SpecDepartment[];
  copySources: CopySourceUniversity[];
  value: string;
  onChange: (sdId: string) => void;
}) {
  const [mode, setMode] = useState<"same" | "other">(siblings.length > 0 ? "same" : "other");
  const [uni, setUni] = useState<string>("");
  const uniDepts = copySources.find((u) => String(u.university_id) === uni)?.departments ?? [];
  return (
    <div className="space-y-2">
      <div className="flex gap-3 text-sm">
        <label className="flex items-center gap-1.5">
          <input type="radio" checked={mode === "same"} onChange={() => { setMode("same"); onChange(""); }} disabled={siblings.length === 0} /> 이 요강의 다른 학과
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" checked={mode === "other"} onChange={() => { setMode("other"); onChange(""); }} /> 다른 대학의 학과
        </label>
      </div>
      {mode === "same" ? (
        <select className={`${inputClass} w-full`} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">학과 선택</option>
          {siblings.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name_ko} ({KIND_LABEL[d.kind]})
            </option>
          ))}
        </select>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          <select className={inputClass} value={uni} onChange={(e) => { setUni(e.target.value); onChange(""); }}>
            <option value="">대학 선택</option>
            {copySources.map((u) => (
              <option key={u.university_id} value={u.university_id}>{u.name_ko}</option>
            ))}
          </select>
          <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value)} disabled={!uni}>
            <option value="">학과 선택</option>
            {uniDepts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name_ko} ({KIND_LABEL[d.kind]})
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

function CopyWhatPicker({ value, onChange }: { value: CopyWhat; onChange: (v: CopyWhat) => void }) {
  return (
    <div className="flex flex-wrap gap-3 text-sm">
      {WHAT_LABEL.map((w) => (
        <label key={w.key} className="flex items-center gap-1.5">
          <input type="checkbox" checked={value[w.key] !== false} onChange={(e) => onChange({ ...value, [w.key]: e.target.checked })} />
          {w.label}
        </label>
      ))}
    </div>
  );
}

function CopySetupDialog({
  specId,
  target,
  siblings,
  copySources,
}: {
  specId: string;
  target: SpecDepartment;
  siblings: SpecDepartment[];
  copySources: CopySourceUniversity[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [what, setWhat] = useState<CopyWhat>(ALL_WHAT);
  const [pending, startTransition] = useTransition();

  const run = () =>
    startTransition(async () => {
      const res = await copyDepartmentSetupAction(specId, target.id, from, what);
      if (res.ok) {
        toast.success(`${target.name_ko} 에 설정을 가져왔습니다`);
        setOpen(false);
        router.refresh();
      } else toast.error("가져오기 실패", { description: res.error });
    });

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Copy className="size-3.5" />
        가져오기
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{target.name_ko} — 다른 학과 설정 가져오기</DialogTitle>
            <DialogDescription>고른 항목은 이 학과의 현재 설정을 덮어씁니다. 양식은 같은 파일을 가리키는 새 행으로 복사됩니다.</DialogDescription>
          </DialogHeader>
          <CopySourcePicker siblings={siblings} copySources={copySources} value={from} onChange={setFrom} />
          <CopyWhatPicker value={what} onChange={setWhat} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>취소</Button>
            <Button type="button" onClick={run} disabled={pending || !from}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Copy className="size-4" />}
              가져오기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── 학과 추가 ─────────────────────────────────────────────────────────

function AddDepartmentDialog({
  specId,
  departments,
  masters,
  copySources,
}: {
  specId: string;
  departments: SpecDepartment[];
  masters: DeptMaster[];
  copySources: CopySourceUniversity[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [masterId, setMasterId] = useState("");
  const [newName, setNewName] = useState("");
  const [copy, setCopy] = useState(false);
  const [from, setFrom] = useState("");
  const [what, setWhat] = useState<CopyWhat>(ALL_WHAT);
  const [pending, startTransition] = useTransition();

  const used = new Set(departments.map((d) => d.department_id));
  const free = masters.filter((m) => !used.has(m.id));

  const run = () =>
    startTransition(async () => {
      const res = await addSpecDepartmentAction(specId, {
        department_id: mode === "existing" && masterId ? Number(masterId) : null,
        new_name: mode === "new" ? newName : null,
        copy_from: copy && from ? { sdId: from, what } : null,
      });
      if (res.ok) {
        toast.success("학과를 추가했습니다");
        setOpen(false);
        setMasterId("");
        setNewName("");
        router.refresh();
      } else toast.error("학과 추가 실패", { description: res.error });
    });

  const canRun = mode === "existing" ? !!masterId : newName.trim() !== "";

  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        학과 추가
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>학과 추가</DialogTitle>
            <DialogDescription>이 대학의 학과 마스터를 고르거나 새 이름으로 만듭니다(새 마스터는 비노출로 만들어집니다).</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-3 text-sm">
              <label className="flex items-center gap-1.5">
                <input type="radio" checked={mode === "existing"} onChange={() => setMode("existing")} /> 기존 학과 마스터
              </label>
              <label className="flex items-center gap-1.5">
                <input type="radio" checked={mode === "new"} onChange={() => setMode("new")} /> 새 학과 이름
              </label>
            </div>
            {mode === "existing" ? (
              <select className={`${inputClass} w-full`} value={masterId} onChange={(e) => setMasterId(e.target.value)}>
                <option value="">학과 선택</option>
                {free.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name_ko}
                    {m.active ? "" : " (비노출)"}
                  </option>
                ))}
              </select>
            ) : (
              <input type="text" className={`${inputClass} w-full`} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="예: 글로벌요양복지과" />
            )}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={copy} onChange={(e) => setCopy(e.target.checked)} /> 다음 학과 설정을 복사
            </label>
            {copy ? (
              <div className="space-y-2 rounded-md border p-3">
                <CopySourcePicker siblings={departments} copySources={copySources} value={from} onChange={setFrom} />
                <CopyWhatPicker value={what} onChange={setWhat} />
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>취소</Button>
            <Button type="button" onClick={run} disabled={pending || !canRun || (copy && !from)}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              추가
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── 작은 부품 ─────────────────────────────────────────────────────────

function Section({ title, open, children }: { title: string; open?: boolean; children: React.ReactNode }) {
  return (
    <details open={open} className="rounded-md border border-input bg-muted/30">
      <summary className="cursor-pointer px-4 py-2 text-sm font-medium hover:bg-muted/50">{title}</summary>
      <div className="border-t border-input p-3">{children}</div>
    </details>
  );
}

function Text({ label, name, defaultValue, placeholder }: { label: string; name: string; defaultValue: string; placeholder?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input type="text" name={name} defaultValue={defaultValue} placeholder={placeholder} className={inputClass} />
    </label>
  );
}

function Num({ label, name, defaultValue, min, max }: { label: string; name: string; defaultValue: number | null; min?: number; max?: number }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input type="number" name={name} defaultValue={defaultValue ?? ""} min={min} max={max} className={inputClass} />
    </label>
  );
}
