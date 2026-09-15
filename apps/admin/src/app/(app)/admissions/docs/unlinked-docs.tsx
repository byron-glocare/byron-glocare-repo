"use client";

/**
 * 표준에 연결되지 않은 모집요강 서류 — 운영자가 하나씩 서류에 붙인다.
 *   0060 이 자동으로 옮기지 못한 것들. 붙이면 옛 JSONB(std_key)와 새 요강↔항목 행에
 *   같이 기록되고 목록에서 사라진다. 맞는 서류가 없으면 그 자리에서 새 서류로 등록한다.
 */

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { linkSpecDocAction } from "./actions";
import { NewStandardDialog, type DocStandard } from "./docs-manager";

export type UnlinkedDoc = {
  specId: string;
  universityName: string;
  term: string;
  docIndex: number;
  key: string;
  name_ko: string;
  notes: string | null;
  target_person: string | null;
};

const TARGET_LABEL: Record<string, string> = { father: "아버지", mother: "어머니", other: "기타" };

export function UnlinkedDocsPanel({ docs, standards }: { docs: UnlinkedDoc[]; standards: DocStandard[] }) {
  const [open, setOpen] = useState(true);
  const [picking, setPicking] = useState<UnlinkedDoc | null>(null);
  const [creating, setCreating] = useState<UnlinkedDoc | null>(null);
  if (docs.length === 0) return null;

  return (
    <Card className="p-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        {open ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
        <span className="font-medium">표준에 연결되지 않은 요강 서류</span>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">{docs.length}</span>
        <span className="ml-auto text-xs text-muted-foreground">붙이면 학생 화면에 서류로 나옵니다. 그 전엔 이름만 있는 상태입니다.</span>
      </button>
      {open ? (
        <ul className="divide-y border-t">
          {docs.map((d) => (
            <li key={`${d.specId}:${d.docIndex}`} className="grid grid-cols-1 gap-2 px-4 py-2.5 text-sm sm:grid-cols-[180px_1fr_auto] sm:items-center">
              <div className="text-xs text-muted-foreground">
                <div className="truncate font-medium text-foreground">{d.universityName}</div>
                <div>{d.term}</div>
              </div>
              <div className="min-w-0">
                <span className="font-medium">{d.name_ko}</span>
                {d.target_person && d.target_person !== "self" ? (
                  <span className="ml-1.5 rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground">{TARGET_LABEL[d.target_person] ?? d.target_person}</span>
                ) : null}
                {d.notes ? <div className="truncate text-xs text-muted-foreground" title={d.notes}>{d.notes}</div> : null}
              </div>
              <div className="flex gap-1.5 sm:justify-end">
                <Button size="sm" variant="outline" onClick={() => setPicking(d)}>서류 고르기</Button>
                <Button size="sm" variant="ghost" onClick={() => setCreating(d)}>새 서류로 등록</Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {picking ? (
        <StandardPicker
          doc={picking}
          standards={standards}
          onClose={() => setPicking(null)}
        />
      ) : null}
      {creating ? (
        <NewStandardDialog
          open
          initialName={creating.name_ko}
          onClose={() => setCreating(null)}
          onCreated={(_itemKey, stdKey) => {
            if (!stdKey) return;
            const d = creating;
            setCreating(null);
            void linkSpecDocAction({ specId: d.specId, docIndex: d.docIndex, docName: d.name_ko, standardKey: stdKey }).then((r) => {
              if (!r.ok) toast.error(r.error);
              else toast.success(`'${d.name_ko}' 을(를) 새 서류에 연결했습니다.`);
            });
          }}
        />
      ) : null}
    </Card>
  );
}

function StandardPicker({ doc, standards, onClose }: { doc: UnlinkedDoc; standards: DocStandard[]; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const active = standards.filter((s) => s.is_active);
    if (!ql) return active;
    return active.filter((s) => `${s.name_ko} ${s.name_vi ?? ""} ${s.aliases.join(" ")}`.toLowerCase().includes(ql));
  }, [q, standards]);

  const pick = (stdKey: string) =>
    start(async () => {
      const r = await linkSpecDocAction({ specId: doc.specId, docIndex: doc.docIndex, docName: doc.name_ko, standardKey: stdKey });
      if (!r.ok) return void toast.error(r.error);
      toast.success(`'${doc.name_ko}' 을(를) 연결했습니다.`);
      router.refresh();
      onClose();
    });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>어느 서류인가요 — {doc.name_ko}</DialogTitle>
          <DialogDescription>
            {doc.universityName} · {doc.term}
            {doc.notes ? <> · {doc.notes}</> : null}
          </DialogDescription>
        </DialogHeader>
        <Input id="unlinked-picker-search" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="서류 이름 또는 다른 표기" />
        <div className="max-h-80 space-y-0.5 overflow-y-auto">
          {list.length === 0 ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">맞는 서류가 없습니다. 닫고 "새 서류로 등록"을 누르세요.</p>
          ) : (
            list.map((s) => (
              <button
                key={s.key}
                type="button"
                disabled={pending}
                onClick={() => pick(s.key)}
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted disabled:opacity-50"
              >
                <span>{s.name_ko}{s.name_vi ? <span className="ml-1.5 text-xs text-muted-foreground">{s.name_vi}</span> : null}</span>
                <span className="text-xs text-muted-foreground">{s.is_form_doc ? "작성" : "발급"}</span>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
