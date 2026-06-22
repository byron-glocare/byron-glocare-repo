"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { KeyRound, Loader2, Plus, UserPlus } from "lucide-react";

import {
  createCenterUser,
  setCenterUserStatus,
  resetUserPassword,
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

type Center = {
  id: number;
  name_vi: string;
  name_ko: string | null;
  active: boolean;
};

export function CenterAccounts({
  accounts,
  centers,
}: {
  accounts: AccountRow[];
  centers: Center[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);

  // center 매핑(study_center_users)이 있으면 표시 — 어드민 역할을 겸한
  // 계정(테스트용 등)도 유학센터 목록에 함께 보이게 한다.
  const centerAccounts = accounts.filter((a) => a.centerUserId);

  function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const studyCenterId = Number(form.get("studyCenterId") || 0);
    const name = String(form.get("name") || "").trim();
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");
    const role = (String(form.get("role") || "user") as "admin" | "user");
    const el = e.currentTarget;
    startTransition(async () => {
      const r = await createCenterUser({ studyCenterId, name, email, password, role });
      if (r.ok) {
        toast.success(`${email} 유학센터 계정을 생성했습니다.`);
        setShowCreate(false);
        el.reset();
        router.refresh();
      } else {
        toast.error("생성 실패", { description: r.error });
      }
    });
  }

  function onToggleStatus(a: AccountRow) {
    if (!a.centerUserId) return;
    const next = a.centerStatus === "active" ? "suspended" : "active";
    startTransition(async () => {
      const r = await setCenterUserStatus(a.centerUserId!, next);
      if (r.ok) {
        toast.success(next === "active" ? "활성화했습니다." : "정지했습니다.");
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

  const centerLabel = (c: Center) => c.name_ko || c.name_vi;

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle className="text-base">유학센터 계정</CardTitle>
          <CardDescription>
            youstudyinkorea.com/center 로그인 계정 {centerAccounts.length}명 ·
            센터 등록은 “유학센터” 메뉴에서
          </CardDescription>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => setShowCreate((v) => !v)}
          disabled={centers.length === 0}
        >
          <UserPlus className="size-3" />
          센터 계정 생성
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {centers.length === 0 && (
          <p className="text-sm text-muted-foreground">
            먼저 “유학센터” 메뉴에서 센터를 등록하세요.
          </p>
        )}

        {showCreate && (
          <form
            onSubmit={onCreate}
            className="grid items-end gap-3 rounded-md border border-border bg-muted/30 p-3 sm:grid-cols-2 lg:grid-cols-6"
          >
            <div className="lg:col-span-2">
              <Label className="text-xs">유학센터</Label>
              <select
                name="studyCenterId"
                required
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">— 선택 —</option>
                {centers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {centerLabel(c)}
                    {!c.active ? " (숨김)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">담당자 이름</Label>
              <Input name="name" required />
            </div>
            <div>
              <Label className="text-xs">이메일</Label>
              <Input name="email" type="email" required />
            </div>
            <div>
              <Label className="text-xs">초기 비밀번호</Label>
              <Input name="password" type="text" required minLength={6} />
            </div>
            <div>
              <Label className="text-xs">센터 내 역할</Label>
              <select
                name="role"
                defaultValue="user"
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="user">담당자</option>
                <option value="admin">센터 관리자</option>
              </select>
            </div>
            <Button type="submit" disabled={pending} className="lg:col-span-6">
              {pending ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Plus className="size-3" />
              )}
              계정 생성
            </Button>
          </form>
        )}

        <div className="overflow-hidden rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>이메일</TableHead>
                <TableHead>담당자</TableHead>
                <TableHead>센터(회사)</TableHead>
                <TableHead>역할</TableHead>
                <TableHead>상태</TableHead>
                <TableHead className="w-44" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {centerAccounts.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-6 text-center text-sm text-muted-foreground"
                  >
                    아직 유학센터 계정이 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                centerAccounts.map((a) => {
                  const active = a.centerStatus === "active";
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="text-sm">{a.email ?? "—"}</TableCell>
                      <TableCell className="text-sm">
                        {a.centerName ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {a.centerOrgName ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {a.centerRole === "admin" ? "센터 관리자" : "담당자"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {active ? (
                          <Badge className="border-success/20 bg-success/10 text-success">
                            활성
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-destructive/20 bg-destructive/10 text-destructive"
                          >
                            정지
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
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => onToggleStatus(a)}
                            disabled={pending}
                            className={
                              active
                                ? "text-destructive hover:bg-destructive/5 hover:text-destructive"
                                : "text-success hover:bg-success/5 hover:text-success"
                            }
                          >
                            {active ? "정지" : "활성화"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
