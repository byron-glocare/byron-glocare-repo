"use client";

/**
 * 모집요강 편집 기본 탭 — 옛 "작성서류·미연결" 서류 줄 정리 목록.
 *   발급/미연결 줄: [학과에 넣기] → 발급서류 항목 + 학과 고르기 → 학과별 항목 추가 후 줄 삭제.
 *   작성서류 줄: [양식 올리기] → 학과 고르고 양식 업로드 화면으로(올린 뒤 돌아와 줄을 지운다).
 *   모든 줄: [삭제].
 *   줄이 하나도 없으면 부모가 이 목록 자체를 그리지 않는다.
 */

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { deleteLegacyDocRowAction, moveLegacyDocRowToDepartmentsAction } from "@/app/(app)/admissions/specs/[id]/edit/legacy-doc-actions";

const inputClass = "rounded-md border border-input bg-background px-2 py-1.5 text-sm";

export type LegacyDocRow = {
  /** spec.required_documents 배열의 index */
  index: number;
  name_ko: string;
  notes: string | null;
  notarization: string | null;
  required: boolean;
  kind: "form" | "unlinked";
};
export type LegacyItemOption = { key: string; name_ko: string };
export type LegacyDeptOption = { id: string; name_ko: string; kind: "language" | "regular" };

const norm = (s: string) => s.replace(/[\s()[\]·,.\-_/]/g, "").toLowerCase();
function bigrams(s: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
  return out;
}
function similarity(a: string, b: string): number {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.includes(y) || y.includes(x)) return 0.6 + 0.4 * (Math.min(x.length, y.length) / Math.max(x.length, y.length));
  const bx = bigrams(x);
  const by = bigrams(y);
  if (!bx.length || !by.length) return 0;
  const pool = [...by];
  let hit = 0;
  for (const g of bx) {
    const j = pool.indexOf(g);
    if (j >= 0) { hit++; pool.splice(j, 1); }
  }
  return (2 * hit) / (bx.length + by.length);
}
function guessItem(name: string, items: LegacyItemOption[]): string {
  let best = "";
  let score = 0;
  for (const it of items) {
    const s = similarity(name, it.name_ko);
    if (s > score) { score = s; best = it.key; }
  }
  return score >= 0.4 ? best : "";
}

export function LegacyDocRows({
  specId,
  universityId,
  rows,
  items,
  departments,
}: {
  specId: string;
  universityId: number;
  rows: LegacyDocRow[];
  items: LegacyItemOption[];
  departments: LegacyDeptOption[];
}) {
  if (rows.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        요강 원문에서 온 옛 서류 줄입니다. 줄마다 학과로 옮기거나(발급서류는 학과의 발급서류 항목으로, 작성서류는 학과 양식으로) 지우세요. 모두 정리하면 이
        목록은 사라집니다.
      </p>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <RowItem key={`${r.index}:${r.name_ko}`} specId={specId} universityId={universityId} row={r} items={items} departments={departments} />
        ))}
      </ul>
    </div>
  );
}

function RowItem({
  specId,
  universityId,
  row,
  items,
  departments,
}: {
  specId: string;
  universityId: number;
  row: LegacyDocRow;
  items: LegacyItemOption[];
  departments: LegacyDeptOption[];
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [formDept, setFormDept] = useState<string>(departments.find((d) => d.kind === "regular")?.id ?? departments[0]?.id ?? "");

  const remove = () => {
    if (!confirm(`옛 서류 줄 "${row.name_ko}" 을(를) 지울까요?`)) return;
    startTransition(async () => {
      const res = await deleteLegacyDocRowAction(specId, row.index, row.name_ko);
      if (res.ok) {
        toast.success("옛 서류 줄을 지웠습니다");
        router.refresh();
      } else toast.error("삭제 실패", { description: res.error });
    });
  };

  const uploadHref = formDept
    ? `/admissions/forms/new?university_id=${universityId}&spec_department_id=${encodeURIComponent(formDept)}&name_ko=${encodeURIComponent(row.name_ko)}`
    : "";

  return (
    <li className={`rounded-md border px-3 py-2 text-sm ${row.kind === "form" ? "" : "border-dashed"}`}>
      <div className="flex flex-wrap items-center gap-2">
        {row.kind === "form" ? <FileText className="size-3.5 shrink-0 text-muted-foreground" /> : null}
        <span className="font-medium">{row.name_ko || "(이름 없음)"}</span>
        <Badge variant="outline" className="text-[10px]">{row.kind === "form" ? "작성서류" : "미연결"}</Badge>
        {row.required === false ? <Badge variant="outline" className="text-[10px]">선택</Badge> : null}
        {row.notarization ? <Badge variant="outline" className="text-[10px]">{row.notarization}</Badge> : null}
        <span className="ml-auto flex flex-wrap items-center gap-1.5">
          {row.kind === "form" ? (
            <>
              <select className={inputClass} value={formDept} onChange={(e) => setFormDept(e.target.value)} aria-label="양식을 올릴 학과">
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name_ko}</option>
                ))}
              </select>
              {uploadHref ? (
                <Link href={uploadHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  <Upload className="size-3.5" />
                  양식 올리기
                </Link>
              ) : null}
            </>
          ) : (
            <MoveToDepartmentsDialog specId={specId} row={row} items={items} departments={departments} disabled={busy} />
          )}
          <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={busy} onClick={remove}>
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
            삭제
          </Button>
        </span>
      </div>
      {row.notes ? <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{row.notes}</p> : null}
      {row.kind === "form" ? (
        <p className="mt-1 text-[11px] text-muted-foreground">양식을 올린 뒤 이 화면으로 돌아와 이 줄을 삭제하세요.</p>
      ) : null}
    </li>
  );
}

function MoveToDepartmentsDialog({
  specId,
  row,
  items,
  departments,
  disabled,
}: {
  specId: string;
  row: LegacyDocRow;
  items: LegacyItemOption[];
  departments: LegacyDeptOption[];
  disabled?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [itemKey, setItemKey] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  const openDialog = () => {
    setItemKey(guessItem(row.name_ko, items));
    setQ("");
    const regular = departments.filter((d) => d.kind === "regular").map((d) => d.id);
    setPicked(new Set(regular.length ? regular : departments.map((d) => d.id)));
    setOpen(true);
  };

  const filtered = useMemo(() => {
    const k = norm(q);
    const list = k ? items.filter((i) => norm(i.name_ko).includes(k) || i.key.toLowerCase().includes(k)) : items;
    // 고른 항목은 검색과 무관하게 맨 위에 보인다
    const sel = items.find((i) => i.key === itemKey);
    return sel && !list.includes(sel) ? [sel, ...list] : list;
  }, [q, items, itemKey]);

  const run = () =>
    startTransition(async () => {
      const res = await moveLegacyDocRowToDepartmentsAction(specId, row.index, row.name_ko, itemKey, Array.from(picked));
      if (res.ok) {
        toast.success(`"${row.name_ko}" 을(를) 학과에 넣었습니다`);
        setOpen(false);
        router.refresh();
      } else toast.error("학과에 넣기 실패", { description: res.error });
    });

  return (
    <>
      <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={openDialog}>
        <ArrowRight className="size-3.5" />
        학과에 넣기
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>&quot;{row.name_ko}&quot; — 학과에 넣기</DialogTitle>
            <DialogDescription>
              발급서류 항목을 고르면 고른 학과의 발급서류 항목 끝에 추가되고(이미 있으면 건너뜀) 이 옛 줄은 지워집니다. 줄 메모는 항목 안내문으로 들어갑니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <span className="text-xs text-muted-foreground">발급서류 항목</span>
              <input type="text" className={`${inputClass} w-full`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="항목 이름 검색" />
              <div className="max-h-56 overflow-y-auto rounded-md border">
                {filtered.length === 0 ? (
                  <p className="p-3 text-xs text-muted-foreground">맞는 항목이 없습니다.</p>
                ) : (
                  filtered.map((i) => (
                    <label key={i.key} className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted/50 ${i.key === itemKey ? "bg-muted" : ""}`}>
                      <input type="radio" name={`legacy-item-${row.index}`} checked={i.key === itemKey} onChange={() => setItemKey(i.key)} />
                      <span>{i.name_ko}</span>
                      <span className="ml-auto text-[10px] text-muted-foreground">{i.key}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <span className="text-xs text-muted-foreground">넣을 학과</span>
              <div className="flex flex-wrap gap-3 text-sm">
                {departments.map((d) => (
                  <label key={d.id} className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={picked.has(d.id)}
                      onChange={(e) =>
                        setPicked((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(d.id);
                          else next.delete(d.id);
                          return next;
                        })
                      }
                    />
                    {d.name_ko}
                    {d.kind === "language" ? <span className="text-[10px] text-muted-foreground">(어학당)</span> : null}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>취소</Button>
            <Button type="button" onClick={run} disabled={pending || !itemKey || picked.size === 0}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
              넣고 줄 지우기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
