"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, KeyRound, Loader2, Plus, ShieldCheck, UserPlus } from "lucide-react";

import {
  createAuthUser,
  toggleAuthUserBan,
  updateOwnPassword,
} from "@/app/(app)/settings/actions";

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

type AuthUser = {
  id: string;
  email: string | undefined;
  created_at: string;
  last_sign_in_at: string | null;
  banned_until: string | null;
};

type Props = {
  users: AuthUser[];
  currentUserId: string;
  currentUserEmail: string | null;
};

export function AccountsManager({ users, currentUserId, currentUserEmail }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);

  function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");

    startTransition(async () => {
      const result = await createAuthUser({ email, password });
      if (result.ok) {
        toast.success(`${email} 계정이 생성되었습니다.`);
        setShowCreate(false);
        (e.currentTarget as HTMLFormElement).reset?.();
        router.refresh();
      } else {
        toast.error("계정 생성 실패", { description: result.error });
      }
    });
  }

  function onToggleBan(user: AuthUser) {
    const isBanned = user.banned_until && new Date(user.banned_until) > new Date();
    startTransition(async () => {
      const result = await toggleAuthUserBan(user.id, !isBanned);
      if (result.ok) {
        toast.success(isBanned ? "활성화되었습니다." : "비활성화되었습니다.");
        router.refresh();
      } else {
        toast.error("실패", { description: result.error });
      }
    });
  }

  function onChangePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") || "");
    const confirm = String(form.get("confirm") || "");

    if (password !== confirm) {
      toast.error("비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    startTransition(async () => {
      const result = await updateOwnPassword(password);
      if (result.ok) {
        toast.success("비밀번호가 변경되었습니다.");
        setShowPasswordChange(false);
        (e.currentTarget as HTMLFormElement).reset?.();
      } else {
        toast.error("변경 실패", { description: result.error });
      }
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between flex-wrap gap-3">
        <div>
          <CardTitle className="text-base">계정 관리</CardTitle>
          <CardDescription>
            로그인 사용자 {users.length}명 · 계정 삭제는 Supabase 대시보드에서 직접
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowPasswordChange((v) => !v)}
          >
            <KeyRound className="size-3" />
            내 비밀번호 변경
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => setShowCreate((v) => !v)}
          >
            <UserPlus className="size-3" />
            계정 생성
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showCreate && (
          <form
            onSubmit={onCreate}
            className="grid sm:grid-cols-3 gap-3 items-end rounded-md border border-border p-3 bg-muted/30"
          >
            <div>
              <Label className="text-xs">이메일</Label>
              <Input
                name="email"
                type="email"
                required
                placeholder="user@example.com"
              />
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

        {showPasswordChange && (
          <form
            onSubmit={onChangePassword}
            className="grid sm:grid-cols-3 gap-3 items-end rounded-md border border-border p-3 bg-info/5"
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
                <TableHead>생성일</TableHead>
                <TableHead>마지막 로그인</TableHead>
                <TableHead>상태</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => {
                const isBanned =
                  u.banned_until && new Date(u.banned_until) > new Date();
                const isMe = u.id === currentUserId;
                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{u.email ?? "—"}</span>
                        {isMe && (
                          <Badge variant="outline" className="text-xs">
                            본인
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(u.created_at)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {u.last_sign_in_at ? formatDateTime(u.last_sign_in_at) : "—"}
                    </TableCell>
                    <TableCell>
                      {isBanned ? (
                        <Badge
                          variant="outline"
                          className="bg-destructive/10 text-destructive border-destructive/20"
                        >
                          <Ban className="size-3" />
                          비활성
                        </Badge>
                      ) : (
                        <Badge className="bg-success/10 text-success border-success/20">
                          <ShieldCheck className="size-3" />
                          활성
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {!isMe && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => onToggleBan(u)}
                          disabled={pending}
                          className={
                            isBanned
                              ? "text-success hover:text-success hover:bg-success/5"
                              : "text-destructive hover:text-destructive hover:bg-destructive/5"
                          }
                        >
                          {isBanned ? "활성화" : "비활성화"}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
