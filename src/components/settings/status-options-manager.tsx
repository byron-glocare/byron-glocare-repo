"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";

import {
  createStatusOption,
  updateStatusOption,
  deleteStatusOption,
  countCustomersUsingStatus,
} from "@/app/(app)/settings/actions";
import type { StatusOption } from "@/types/database";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  options: StatusOption[];
};

export function StatusOptionsManager({ options }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({
    code: "",
    label: "",
    display_order: 0,
  });
  const [deleteTarget, setDeleteTarget] = useState<StatusOption | null>(null);
  const [deleteUsage, setDeleteUsage] = useState<number>(0);
  const [migrateTo, setMigrateTo] = useState<string>("__null__");
  const [showAdd, setShowAdd] = useState(false);

  const sorted = [...options].sort(
    (a, b) => a.display_order - b.display_order
  );

  function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const code = String(form.get("code") || "").trim();
    const label = String(form.get("label") || "").trim();
    const display_order =
      Number(form.get("display_order")) || sorted.length + 1;

    startTransition(async () => {
      const result = await createStatusOption({
        code,
        label,
        display_order,
      });
      if (result.ok) {
        toast.success("상태값이 추가되었습니다.");
        setShowAdd(false);
        router.refresh();
      } else {
        toast.error("추가 실패", { description: result.error });
      }
    });
  }

  function startEdit(opt: StatusOption) {
    setEditingId(opt.id);
    setEditValues({
      code: opt.code,
      label: opt.label,
      display_order: opt.display_order,
    });
  }

  function onSaveEdit() {
    if (!editingId) return;
    startTransition(async () => {
      const result = await updateStatusOption(editingId, editValues);
      if (result.ok) {
        toast.success("저장되었습니다.");
        setEditingId(null);
        router.refresh();
      } else {
        toast.error("저장 실패", { description: result.error });
      }
    });
  }

  async function openDeleteDialog(opt: StatusOption) {
    const count = await countCustomersUsingStatus(opt.code);
    setDeleteUsage(count);
    setDeleteTarget(opt);
    setMigrateTo("__null__");
  }

  function onConfirmDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      const result = await deleteStatusOption(
        deleteTarget.id,
        migrateTo === "__null__" ? null : migrateTo
      );
      if (result.ok) {
        toast.success("삭제되었습니다.");
        setDeleteTarget(null);
        router.refresh();
      } else {
        toast.error("삭제 실패", { description: result.error });
      }
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">상태값 관리</CardTitle>
          <CardDescription>
            엑셀의 기존 단일 상태값 (legacy_status) — 수정/삭제 시 기존 고객 레코드에
            자동 반영됩니다.
          </CardDescription>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowAdd((v) => !v)}
        >
          <Plus className="size-3" />
          추가
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {showAdd && (
          <form
            onSubmit={onAdd}
            className="grid sm:grid-cols-4 gap-3 items-end rounded-md border border-border p-3 bg-muted/30"
          >
            <div>
              <Label className="text-xs">코드</Label>
              <Input name="code" placeholder="예: 1-6.기타" required />
            </div>
            <div>
              <Label className="text-xs">라벨</Label>
              <Input name="label" placeholder="예: 기타" required />
            </div>
            <div>
              <Label className="text-xs">정렬 순서</Label>
              <Input
                type="number"
                name="display_order"
                defaultValue={sorted.length + 1}
              />
            </div>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-3 animate-spin" />}
              등록
            </Button>
          </form>
        )}

        <div className="overflow-hidden rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">순서</TableHead>
                <TableHead>코드</TableHead>
                <TableHead>라벨</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((opt) =>
                editingId === opt.id ? (
                  <TableRow key={opt.id} className="bg-accent/30">
                    <TableCell>
                      <Input
                        type="number"
                        value={editValues.display_order}
                        className="h-8"
                        onChange={(e) =>
                          setEditValues((p) => ({
                            ...p,
                            display_order: Number(e.target.value) || 0,
                          }))
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={editValues.code}
                        className="h-8"
                        onChange={(e) =>
                          setEditValues((p) => ({ ...p, code: e.target.value }))
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={editValues.label}
                        className="h-8"
                        onChange={(e) =>
                          setEditValues((p) => ({ ...p, label: e.target.value }))
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          size="sm"
                          onClick={onSaveEdit}
                          disabled={pending}
                        >
                          저장
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingId(null)}
                        >
                          취소
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow key={opt.id}>
                    <TableCell>{opt.display_order}</TableCell>
                    <TableCell className="font-mono text-xs">{opt.code}</TableCell>
                    <TableCell>{opt.label}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => startEdit(opt)}
                        >
                          <Pencil className="size-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => openDeleteDialog(opt)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/5"
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {/* 삭제 확인 다이얼로그 */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>상태값 삭제</DialogTitle>
            <DialogDescription>
              <span className="font-mono">{deleteTarget?.code}</span> 를 쓰는{" "}
              고객 <span className="text-foreground font-medium">{deleteUsage}명</span>{" "}
              있습니다. 해당 고객의 legacy_status 를 어떻게 이행할까요?
            </DialogDescription>
          </DialogHeader>

          {deleteUsage > 0 && (
            <div className="space-y-2">
              <Label className="text-xs">이행할 값</Label>
              <Select value={migrateTo} onValueChange={(v) => setMigrateTo(v ?? "__null__")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__null__">
                    (null) — 상태값 제거
                  </SelectItem>
                  {sorted
                    .filter((o) => o.id !== deleteTarget?.id)
                    .map((o) => (
                      <SelectItem key={o.id} value={o.code}>
                        {o.code} — {o.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
            >
              취소
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={onConfirmDelete}
              disabled={pending}
            >
              {pending && <Loader2 className="size-3 animate-spin" />}
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
