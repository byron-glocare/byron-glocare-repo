"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Ban,
  KeyRound,
  Loader2,
  Plus,
  ShieldCheck,
  ShieldMinus,
  ShieldPlus,
  UserPlus,
} from "lucide-react";

import {
  createAdminAccount,
  setAdminRole,
  toggleBan,
  resetUserPassword,
  updateOwnPassword,
  type AccountRow,
} from "@/app/(app)/accounts/actions";
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
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";

const KIND_LABEL: Record<string, string> = {
  admin: "어드민",
  center: "유학센터",
  caregiver: "요양보호",
  none: "미분류",
};

export function AdminAccounts({
  accounts,
  currentUserId,
  currentUserEmail,
}: {
  accounts: AccountRow[];
  currentUserId: string;
  currentUserEmail: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const adminAccounts = accounts.filter((a) => a.isAdmin);

  function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");
    const el = e.currentTarget;
    startTransition(async () => {
      const r = await createAdminAccount({ email, password });
      if (r.ok) {
        toast.success(`${email} 어드민 계정을 생성했습니다.`);
        setShowCreate(false);
        el.reset();
        router.refresh();
      } else {
        toast.error("생성 실패", { description: r.error });
      }
    });
  }

  function onRevoke(a: AccountRow) {
    if (
      !confirm(
        `${a.email} 의 어드민 권한을 회수할까요?\n이 계정은 더 이상 관리자(3001)에 접근할 수 없습니다.`
      )
    )
      return;
    startTransition(async () => {
      const r = await setAdminRole(a.id, false);
      if (r.ok) {
        toast.success("어드민 권한을 회수했습니다.");
        router.refresh();
      } else {
        toast.error("실패", { description: r.error });
      }
    });
  }

  function onToggleBan(a: AccountRow) {
    const isBanned = !!a.banned_until && new Date(a.banned_until) > new Date();
    startTransition(async () => {
      const r = await toggleBan(a.id, !isBanned);
      if (r.ok) {
        toast.success(isBanned ? "활성화했습니다." : "비활성화했습니다.");
        router.refresh();
      } else {
        toast.error("실패", { description: r.error });
      }
    });
  }

  function onReset(a: AccountRow) {
    const pw = prompt(`${a.email} 의 새 비밀번호 (6자 이상)`);
    if (pw == null) return;
    if (pw.length < 6) {
      toast.error("비밀번호는 6자 이상이어야 합니다.");
      return;
    }
    startTransition(async () => {
      const r = await resetUserPassword(a.id, pw);
      if (r.ok) toast.success("비밀번호를 변경했습니다.");
      else toast.error("실패", { description: r.error });
    });
  }

  function onChangeOwn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") || "");
    const confirmPw = String(form.get("confirm") || "");
    if (password !== confirmPw) {
      toast.error("비밀번호 확인이 일치하지 않습니다.");
      return;
    }
    const el = e.currentTarget;
    startTransition(async () => {
      const r = await updateOwnPassword(password);
      if (r.ok) {
        toast.success("비밀번호가 변경되었습니다.");
        setShowPw(false);
        el.reset();
      } else {
        toast.error("변경 실패", { description: r.error });
      }
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle className="text-base">글로케어 어드민 계정</CardTitle>
          <CardDescription>
            관리자(3001)에 접근 가능한 계정 {adminAccounts.length}명 · 권한은
            여기서만 부여/회수
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowPw((v) => !v)}
          >
            <KeyRound className="size-3" />
            내 비밀번호 변경
          </Button>
          <Button type="button" size="sm" onClick={() => setShowCreate((v) => !v)}>
            <UserPlus className="size-3" />
            어드민 계정 생성
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showCreate && (
          <form
            onSubmit={onCreate}
            className="grid items-end gap-3 rounded-md border border-border bg-muted/30 p-3 sm:grid-cols-3"
          >
            <div>
              <Label className="text-xs">이메일</Label>
              <Input name="email" type="email" required placeholder="staff@glocare.co.kr" />
            </div>
            <div>
              <Label className="text-xs">초기 비밀번호 (6자 이상)</Label>
              <Input name="password" type="text" required minLength={6} />
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Plus className="size-3" />
              )}
              생성
            </Button>
          </form>
        )}

        {showPw && (
          <form
            onSubmit={onChangeOwn}
            className="grid items-end gap-3 rounded-md border border-border bg-info/5 p-3 sm:grid-cols-3"
          >
            <div>
              <Label className="text-xs">
                새 비밀번호 ({currentUserEmail ?? "내 계정"})
              </Label>
              <Input name="password" type="password" required minLength={6} />
            </div>
            <div>
              <Label className="text-xs">비밀번호 확인</Label>
              <Input name="confirm" type="password" required minLength={6} />
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <ShieldCheck className="size-3" />
              )}
              변경
            </Button>
          </form>
        )}

        <div className="overflow-hidden rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>이메일</TableHead>
                <TableHead>마지막 로그인</TableHead>
                <TableHead>상태</TableHead>
                <TableHead className="w-72" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {adminAccounts.map((a) => {
                const isBanned =
                  !!a.banned_until && new Date(a.banned_until) > new Date();
                const isMe = a.id === currentUserId;
                return (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{a.email ?? "—"}</span>
                        {isMe && (
                          <Badge variant="outline" className="text-xs">
                            본인
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {a.last_sign_in_at ? formatDateTime(a.last_sign_in_at) : "—"}
                    </TableCell>
                    <TableCell>
                      {isBanned ? (
                        <Badge
                          variant="outline"
                          className="border-destructive/20 bg-destructive/10 text-destructive"
                        >
                          <Ban className="size-3" />
                          비활성
                        </Badge>
                      ) : (
                        <Badge className="border-success/20 bg-success/10 text-success">
                          <ShieldCheck className="size-3" />
                          활성
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => onReset(a)}
                          disabled={pending}
                        >
                          <KeyRound className="size-3" />
                          비번
                        </Button>
                        {!isMe && (
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => onRevoke(a)}
                              disabled={pending}
                              className="text-destructive hover:bg-destructive/5 hover:text-destructive"
                            >
                              <ShieldMinus className="size-3" />
                              권한회수
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => onToggleBan(a)}
                              disabled={pending}
                              className={
                                isBanned
                                  ? "text-success hover:bg-success/5 hover:text-success"
                                  : "text-destructive hover:bg-destructive/5 hover:text-destructive"
                              }
                            >
                              {isBanned ? "활성화" : "비활성화"}
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <GrantRole accounts={accounts} pending={pending} onDone={() => router.refresh()} />
      </CardContent>
    </Card>
  );
}

/** 기존 비-어드민 계정에 어드민 권한 부여 (회수 실수 복구 등) */
function GrantRole({
  accounts,
  pending,
  onDone,
}: {
  accounts: AccountRow[];
  pending: boolean;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const candidates = accounts.filter((a) => !a.isAdmin);

  function onGrant(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const userId = String(form.get("userId") || "");
    if (!userId) return;
    startTransition(async () => {
      const r = await setAdminRole(userId, true);
      if (r.ok) {
        toast.success("어드민 권한을 부여했습니다.");
        setOpen(false);
        onDone();
      } else {
        toast.error("실패", { description: r.error });
      }
    });
  }

  return (
    <div className="rounded-md border border-dashed border-border p-3">
      <button
        type="button"
        className="text-xs font-medium text-muted-foreground hover:text-foreground"
        onClick={() => setOpen((v) => !v)}
      >
        <ShieldPlus className="mr-1 inline size-3" />
        기존 계정에 어드민 권한 부여 {open ? "▲" : "▼"}
      </button>
      {open && (
        <form onSubmit={onGrant} className="mt-3 flex flex-wrap items-end gap-2">
          <div className="min-w-64 flex-1">
            <Label className="text-xs">계정 선택</Label>
            <select
              name="userId"
              required
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">— 계정 선택 —</option>
              {candidates.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.email ?? a.id} ({KIND_LABEL[a.kind]})
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" size="sm" disabled={pending || isPending}>
            {isPending ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <ShieldPlus className="size-3" />
            )}
            권한 부여
          </Button>
        </form>
      )}
    </div>
  );
}
