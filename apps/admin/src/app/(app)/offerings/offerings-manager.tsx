"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Loader2, Plus, Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  checkOfferingReadinessAction,
  createOfferingAction,
  deleteOfferingAction,
  updateOfferingOptionsAction,
  updateOfferingQuotaAction,
  updateOfferingStatusAction,
} from "./actions";

// ---------------------------------------------------------------------------
// 타입
// ---------------------------------------------------------------------------
export type OfferingRow = {
  id: string;
  university_id: number;
  department_id: number;
  term: string;
  intake_quota: number | null;
  status: "draft" | "published" | "closed" | "archived";
  source_spec_id: string | null;
  available_languages: string[];
  location_options: string[];
  sort_order: number;
  notes: string | null;
};

export type GridRow = {
  department_id: number;
  name_ko: string;
  /** null = 요강에 없는 학과(옛 모집만 있음) */
  kind: "language" | "regular" | null;
  spec_department_id: string | null;
  in_spec: boolean;
  is_active: boolean;
};

export type UniversityBlock = {
  university: { id: number; name_ko: string; active: boolean };
  spec: { id: string; status: string } | null;
  rows: GridRow[];
  /** 최신 학기 먼저 */
  terms: string[];
  offerings: OfferingRow[];
};

// ---------------------------------------------------------------------------
// 라벨
// ---------------------------------------------------------------------------
const STATUS_LABEL: Record<OfferingRow["status"], string> = {
  draft: "초안",
  published: "오픈",
  closed: "마감",
  archived: "보관",
};
const SPEC_STATUS_LABEL: Record<string, string> = {
  draft: "초안",
  reviewing: "검토중",
  approved: "승인",
  archived: "보관",
};
const LANGUAGE_OPTIONS = [
  { value: "korean", label: "한국어" },
  { value: "english", label: "영어" },
  { value: "other", label: "기타" },
];
const LOCATION_OPTIONS = [
  { value: "domestic", label: "국내(한국 체류)" },
  { value: "overseas", label: "해외(베트남 등)" },
];

function StatusBadge({ status }: { status: OfferingRow["status"] }) {
  if (status === "published") {
    return <Badge className="border-success/20 bg-success/10 text-[10px] text-success">오픈</Badge>;
  }
  if (status === "closed") {
    return (
      <Badge variant="outline" className="border-amber-300 text-[10px] text-amber-700">
        마감
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-[10px]">
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// 메인
// ---------------------------------------------------------------------------
export function OfferingsManager({
  blocks,
  universities,
  filterUniversityId,
}: {
  blocks: UniversityBlock[];
  universities: Array<{ id: number; name_ko: string }>;
  filterUniversityId: number | null;
}) {
  const router = useRouter();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-muted-foreground">대학</label>
        <select
          value={filterUniversityId ? String(filterUniversityId) : ""}
          onChange={(e) => router.push(e.target.value ? `/offerings?u=${e.target.value}` : "/offerings")}
          className="h-8 min-w-48 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="">전체</option>
          {universities.map((u) => (
            <option key={u.id} value={String(u.id)}>
              {u.name_ko}
            </option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground">
          오픈 = 유학센터·학생 지원 가능 · 마감 = 지원 종료 · 초안 = 비노출
        </span>
      </div>

      {blocks.length === 0 ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">
          모집요강이 등록된 대학이 없습니다. 모집요강을 먼저 등록하면 여기서 학과·학기별로 오픈할 수 있습니다.
        </Card>
      ) : (
        blocks.map((b) => <UniversityGrid key={b.university.id} block={b} />)
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 대학 격자
// ---------------------------------------------------------------------------
type PublishConfirm = { id: string; label: string; warnings: string[] };

function UniversityGrid({ block }: { block: UniversityBlock }) {
  const router = useRouter();
  const [extraTerms, setExtraTerms] = useState<string[]>([]);
  const [newTerm, setNewTerm] = useState("");
  const [confirm, setConfirm] = useState<PublishConfirm | null>(null);
  const [detail, setDetail] = useState<OfferingRow | null>(null);
  const [pending, startTransition] = useTransition();

  const terms = useMemo(() => {
    const set = new Set<string>([...block.terms, ...extraTerms]);
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [block.terms, extraTerms]);

  const byCell = useMemo(() => {
    const m = new Map<string, OfferingRow>();
    for (const o of block.offerings) m.set(`${o.department_id}|${o.term}`, o);
    return m;
  }, [block.offerings]);

  const publishedCount = block.offerings.filter((o) => o.status === "published").length;

  const addTerm = () => {
    const t = newTerm.trim();
    if (!t) return;
    if (terms.includes(t)) {
      toast.info(`${t} 학기는 이미 있습니다.`);
      setNewTerm("");
      return;
    }
    setExtraTerms((cur) => [...cur, t]);
    setNewTerm("");
  };

  const rowLabel = (o: OfferingRow) => {
    const r = block.rows.find((x) => x.department_id === o.department_id);
    return `${r?.name_ko ?? `학과 #${o.department_id}`} · ${o.term}`;
  };

  // 오픈: 준비도 확인 → 경고 있으면 확인창, 없으면 바로
  const requestPublish = (o: OfferingRow) => {
    startTransition(async () => {
      const r = await checkOfferingReadinessAction(o.id);
      if (r.blocked) {
        toast.error("오픈할 수 없습니다", { description: r.reason });
        return;
      }
      if (r.warnings.length > 0) {
        setConfirm({ id: o.id, label: rowLabel(o), warnings: r.warnings });
        return;
      }
      await doStatus(o.id, "published");
    });
  };

  const doStatus = async (id: string, status: OfferingRow["status"]) => {
    const res = await updateOfferingStatusAction(id, status);
    if (!res.ok) {
      toast.error("상태 변경 실패", { description: res.error });
      return;
    }
    if (status === "published") {
      if (res.warnings && res.warnings.length > 0) {
        toast.warning("오픈했지만 미완료 항목이 있습니다", { description: res.warnings.join(" / ") });
      } else {
        toast.success("오픈했습니다.");
      }
    } else if (status === "closed") {
      toast.success("마감했습니다.");
    } else {
      toast.success("초안으로 돌렸습니다.");
    }
    router.refresh();
  };

  const setStatus = (id: string, status: OfferingRow["status"]) => {
    startTransition(() => doStatus(id, status));
  };

  const confirmPublish = () => {
    if (!confirm) return;
    const id = confirm.id;
    setConfirm(null);
    startTransition(() => doStatus(id, "published"));
  };

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-4 py-2">
        <span className="text-sm font-semibold">{block.university.name_ko}</span>
        {!block.university.active ? (
          <Badge variant="outline" className="text-[10px] text-muted-foreground">
            대학 숨김
          </Badge>
        ) : null}
        {block.spec ? (
          <Link
            href={`/admissions/specs/${block.spec.id}`}
            className="text-[11px] text-muted-foreground hover:text-primary hover:underline"
          >
            모집요강 · {SPEC_STATUS_LABEL[block.spec.status] ?? block.spec.status}
          </Link>
        ) : (
          <Badge variant="outline" className="border-amber-300 text-[10px] text-amber-700">
            모집요강 없음 — 요강을 등록해야 모집을 추가·오픈할 수 있습니다
          </Badge>
        )}
        <span className="text-xs text-muted-foreground">오픈 {publishedCount}개</span>
        <div className="ml-auto flex items-center gap-1">
          <input
            type="text"
            value={newTerm}
            onChange={(e) => setNewTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTerm();
              }
            }}
            placeholder="학기 추가 (예: 2027-Spring)"
            maxLength={100}
            list={`terms-${block.university.id}`}
            className="h-7 w-44 rounded-md border border-input bg-background px-2 text-xs"
          />
          <datalist id={`terms-${block.university.id}`}>
            {suggestTerms().map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
          <Button type="button" size="xs" variant="outline" onClick={addTerm} disabled={!newTerm.trim()}>
            <Plus className="size-3" />
            학기 추가
          </Button>
        </div>
      </div>

      {block.rows.length === 0 ? (
        <div className="p-6 text-sm text-muted-foreground">
          요강에 학과가 없습니다. 모집요강에서 학과를 추가하세요.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/10 text-xs text-muted-foreground">
                <th className="sticky left-0 z-10 bg-background px-4 py-2 text-left font-medium">학과</th>
                {terms.map((t) => (
                  <th key={t} className="min-w-44 px-3 py-2 text-left font-medium">
                    {t}
                    {!block.terms.includes(t) ? (
                      <span className="ml-1 text-[10px] font-normal text-amber-700">(새 학기)</span>
                    ) : null}
                  </th>
                ))}
                {terms.length === 0 ? (
                  <th className="px-3 py-2 text-left font-normal">
                    학기가 없습니다 — 우측 상단에서 학기를 추가하세요.
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {block.rows.map((r) => (
                <tr key={r.department_id} className={!r.is_active ? "opacity-60" : undefined}>
                  <td className="sticky left-0 z-10 bg-background px-4 py-2 align-top">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="font-medium">{r.name_ko}</span>
                      {r.kind === "language" ? (
                        <Badge variant="outline" className="text-[10px]">
                          어학당
                        </Badge>
                      ) : r.kind === "regular" ? (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          일반학과
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-amber-300 text-[10px] text-amber-700">
                          요강에 없음
                        </Badge>
                      )}
                      {r.in_spec && !r.is_active ? (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          비활성
                        </Badge>
                      ) : null}
                    </div>
                  </td>
                  {terms.map((t) => {
                    const o = byCell.get(`${r.department_id}|${t}`);
                    return (
                      <td key={t} className="px-3 py-2 align-top">
                        <OfferingCell
                          block={block}
                          row={r}
                          term={t}
                          offering={o}
                          pending={pending}
                          onPublish={requestPublish}
                          onStatus={setStatus}
                          onDetail={setDetail}
                        />
                      </td>
                    );
                  })}
                  {terms.length === 0 ? <td /> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 오픈 확인 (경고 목록) */}
      <Dialog open={!!confirm} onOpenChange={(open) => (!open ? setConfirm(null) : undefined)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>미완료 항목이 있습니다</DialogTitle>
            <DialogDescription>{confirm?.label} — 그래도 오픈하시겠습니까?</DialogDescription>
          </DialogHeader>
          <ul className="space-y-1 text-sm">
            {(confirm?.warnings ?? []).map((w) => (
              <li key={w} className="flex items-start gap-1.5">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
                <span>{w}</span>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirm(null)}>
              취소
            </Button>
            <Button type="button" onClick={confirmPublish} disabled={pending}>
              그래도 오픈
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 상세 옵션 */}
      {detail ? (
        <OfferingDetailDialog
          offering={detail}
          label={rowLabel(detail)}
          onClose={() => setDetail(null)}
          onStatus={(status) => {
            setDetail(null);
            setStatus(detail.id, status);
          }}
        />
      ) : null}
    </Card>
  );
}

/** 학기 입력 자동완성 후보 — 올해~+2년 × 4분기 */
function suggestTerms(): string[] {
  const y = new Date().getFullYear();
  const out: string[] = [];
  for (let yy = y; yy <= y + 2; yy++) for (const q of ["Spring", "Summer", "Fall", "Winter"]) out.push(`${yy}-${q}`);
  return out;
}

// ---------------------------------------------------------------------------
// 칸
// ---------------------------------------------------------------------------
function OfferingCell({
  block,
  row,
  term,
  offering,
  pending,
  onPublish,
  onStatus,
  onDetail,
}: {
  block: UniversityBlock;
  row: GridRow;
  term: string;
  offering: OfferingRow | undefined;
  pending: boolean;
  onPublish: (o: OfferingRow) => void;
  onStatus: (id: string, status: OfferingRow["status"]) => void;
  onDetail: (o: OfferingRow) => void;
}) {
  const router = useRouter();
  const [adding, startAdd] = useTransition();

  if (!offering) {
    const disabledReason = !block.spec
      ? "모집요강이 없어 추가할 수 없습니다"
      : !row.in_spec
        ? "요강에 없는 학과 — 모집요강에서 학과를 추가하세요"
        : null;
    return (
      <Button
        type="button"
        size="xs"
        variant="ghost"
        className="text-muted-foreground"
        disabled={!!disabledReason || adding}
        title={disabledReason ?? `${row.name_ko} · ${term} 모집 추가 (초안)`}
        onClick={() =>
          startAdd(async () => {
            const res = await createOfferingAction({
              university_id: block.university.id,
              department_id: row.department_id,
              term,
            });
            if (!res.ok) {
              toast.error("추가 실패", { description: res.error });
              return;
            }
            router.refresh();
          })
        }
      >
        {adding ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
        추가
      </Button>
    );
  }

  const o = offering;
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <StatusBadge status={o.status} />
        <QuotaInput offering={o} />
        {o.status !== "published" && !o.source_spec_id && block.spec ? (
          <span className="text-[10px] text-muted-foreground" title="오픈 시 대학 요강으로 자동 연결됩니다">
            ·
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {o.status !== "published" ? (
          <Button
            type="button"
            size="xs"
            variant="outline"
            disabled={pending}
            title="유학센터·학생에게 노출하고 지원을 받습니다"
            onClick={() => onPublish(o)}
          >
            오픈
          </Button>
        ) : (
          <Button
            type="button"
            size="xs"
            variant="outline"
            disabled={pending}
            title="지원 종료 (목록엔 마감으로 표시)"
            onClick={() => onStatus(o.id, "closed")}
          >
            마감
          </Button>
        )}
        {o.status === "closed" || o.status === "archived" ? (
          <Button type="button" size="xs" variant="ghost" disabled={pending} onClick={() => onStatus(o.id, "draft")}>
            초안으로
          </Button>
        ) : null}
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          title="언어·위치·메모"
          onClick={() => onDetail(o)}
        >
          <Settings2 className="size-3" />
        </Button>
      </div>
      {o.notes ? <div className="max-w-44 truncate text-[10px] text-muted-foreground" title={o.notes}>{o.notes}</div> : null}
    </div>
  );
}

function QuotaInput({ offering }: { offering: OfferingRow }) {
  const router = useRouter();
  const [value, setValue] = useState(offering.intake_quota != null ? String(offering.intake_quota) : "");
  const [saving, startSave] = useTransition();

  const commit = () => {
    const trimmed = value.trim();
    const next = trimmed === "" ? null : Number(trimmed);
    if (next === (offering.intake_quota ?? null)) return;
    if (next != null && !Number.isInteger(next)) {
      toast.error("정원은 정수로 입력하세요");
      return;
    }
    startSave(async () => {
      const res = await updateOfferingQuotaAction(offering.id, next);
      if (!res.ok) {
        toast.error("정원 저장 실패", { description: res.error });
        setValue(offering.intake_quota != null ? String(offering.intake_quota) : "");
        return;
      }
      router.refresh();
    });
  };

  const missing = offering.intake_quota == null;
  return (
    <label className="flex items-center gap-1 text-xs" title="정원 (글로케어 운영 모집 인원). 오픈에 필수.">
      <span className="text-muted-foreground">정원</span>
      <input
        type="number"
        min={0}
        max={100000}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        placeholder="—"
        className={`h-6 w-14 rounded-md border bg-background px-1.5 text-xs ${
          missing ? "border-amber-300" : "border-input"
        }`}
      />
      {saving ? <Loader2 className="size-3 animate-spin text-muted-foreground" /> : null}
    </label>
  );
}

// ---------------------------------------------------------------------------
// 상세 옵션 (언어 · 위치 · 메모 · 초안으로/삭제)
// ---------------------------------------------------------------------------
function OfferingDetailDialog({
  offering,
  label,
  onClose,
  onStatus,
}: {
  offering: OfferingRow;
  label: string;
  onClose: () => void;
  onStatus: (status: OfferingRow["status"]) => void;
}) {
  const router = useRouter();
  const [langs, setLangs] = useState<string[]>(offering.available_languages ?? []);
  const [locs, setLocs] = useState<string[]>(offering.location_options ?? []);
  const [notes, setNotes] = useState(offering.notes ?? "");
  const [pending, startTransition] = useTransition();

  const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const save = () => {
    startTransition(async () => {
      const res = await updateOfferingOptionsAction(offering.id, {
        available_languages: langs,
        location_options: locs,
        notes: notes || null,
      });
      if (!res.ok) {
        toast.error("저장 실패", { description: res.error });
        return;
      }
      toast.success("저장했습니다.");
      router.refresh();
      onClose();
    });
  };

  const remove = () => {
    if (!window.confirm(`"${label}" 모집(초안)을 삭제하시겠습니까?`)) return;
    startTransition(async () => {
      const res = await deleteOfferingAction(offering.id);
      if (!res.ok) {
        toast.error("삭제 실패", { description: res.error });
        return;
      }
      toast.success("삭제했습니다.");
      router.refresh();
      onClose();
    });
  };

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>
            <StatusBadge status={offering.status} />
            <span className="ml-2">정원 {offering.intake_quota ?? "미정"}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <div className="mb-1 text-xs font-medium">수업 언어</div>
            <div className="flex flex-wrap gap-1.5">
              {LANGUAGE_OPTIONS.map((opt) => {
                const on = langs.includes(opt.value);
                return (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => setLangs((cur) => toggle(cur, opt.value))}
                    className={`rounded-md border px-2 py-1 text-xs ${
                      on ? "border-primary bg-primary/10 text-primary" : "border-input hover:bg-muted"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium">지원 가능 위치</div>
            <div className="flex flex-wrap gap-1.5">
              {LOCATION_OPTIONS.map((opt) => {
                const on = locs.includes(opt.value);
                return (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => setLocs((cur) => toggle(cur, opt.value))}
                    className={`rounded-md border px-2 py-1 text-xs ${
                      on ? "border-primary bg-primary/10 text-primary" : "border-input hover:bg-muted"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium">메모 (내부용)</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={2000}
              className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            />
          </label>
        </div>

        <DialogFooter className="sm:justify-between">
          <div className="flex gap-1">
            {offering.status === "published" ? (
              <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => onStatus("draft")}>
                초안으로
              </Button>
            ) : null}
            {offering.status === "draft" ? (
              <Button type="button" variant="ghost" size="sm" className="text-destructive" disabled={pending} onClick={remove}>
                <Trash2 className="size-3.5" />
                삭제
              </Button>
            ) : (
              <span className={buttonVariants({ variant: "ghost", size: "sm" }) + " cursor-default text-muted-foreground"} title="초안만 삭제할 수 있습니다">
                삭제 불가
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              취소
            </Button>
            <Button type="button" size="sm" disabled={pending} onClick={save}>
              {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
              저장
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
