"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImageIcon, Info, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

import { ANCHOR_FIELDS, describeTiming } from "@/lib/auto-sms";
import {
  deleteAutoSmsRule,
  saveAutoSmsRule,
  toggleAutoSmsRule,
  uploadAutoSmsImage,
} from "@/app/(app)/sms/auto/actions";

type Rule = {
  id: string;
  name: string;
  title: string | null;
  anchor_field: string;
  offset_days: number;
  send_time: string | null;
  body: string;
  image_path: string | null;
  imageUrl: string | null;
  is_active: boolean;
  sentCount: number;
  failedCount: number;
};

type RecentSend = {
  id: string;
  ruleName: string;
  customer: string;
  status: string;
  error: string | null;
  sentAt: string;
};

type FormState = {
  id?: string;
  name: string;
  title: string;
  anchor_field: string;
  offset_days: string;
  timeMode: "immediate" | "fixed";
  send_time: string;
  body: string;
  image_path: string | null;
  imageUrl: string | null;
  is_active: boolean;
};

const EMPTY_FORM: FormState = {
  name: "",
  title: "",
  anchor_field: "created_at",
  offset_days: "0",
  timeMode: "immediate",
  send_time: "09:00",
  body: "",
  image_path: null,
  imageUrl: null,
  is_active: true,
};

export function AutoSmsView({
  rules,
  recent,
}: {
  rules: Rule[];
  recent: RecentSend[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const bodyBytes = useMemo(
    () => new TextEncoder().encode(form.body).length,
    [form.body]
  );

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setOpen(true);
  };

  const openEdit = (r: Rule) => {
    setForm({
      id: r.id,
      name: r.name,
      title: r.title ?? "",
      anchor_field: r.anchor_field,
      offset_days: String(r.offset_days),
      timeMode: r.send_time ? "fixed" : "immediate",
      send_time: r.send_time ? r.send_time.slice(0, 5) : "09:00",
      body: r.body,
      image_path: r.image_path,
      imageUrl: r.imageUrl,
      is_active: r.is_active,
    });
    setOpen(true);
  };

  const insertName = () => {
    const el = bodyRef.current;
    const token = "{이름}";
    if (!el) {
      setForm((f) => ({ ...f, body: f.body + token }));
      return;
    }
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    const next = el.value.slice(0, start) + token + el.value.slice(end);
    setForm((f) => ({ ...f, body: next }));
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + token.length;
    });
  };

  const onPickImage = async (file: File) => {
    // 클라이언트 선검증 — NHN MMS 규격
    if (!/\.jpe?g$/i.test(file.name) && file.type !== "image/jpeg") {
      toast.error("jpg/jpeg 이미지만 첨부할 수 있습니다.");
      return;
    }
    if (file.size > 300 * 1024) {
      toast.error(
        `이미지가 ${Math.round(file.size / 1024)}KB — 최대 300KB 까지 가능합니다.`
      );
      return;
    }
    const dim = await new Promise<{ w: number; h: number } | null>((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        resolve({ w: img.naturalWidth, h: img.naturalHeight });
        URL.revokeObjectURL(url);
      };
      img.onerror = () => {
        resolve(null);
        URL.revokeObjectURL(url);
      };
      img.src = url;
    });
    if (!dim) {
      toast.error("이미지를 읽을 수 없습니다.");
      return;
    }
    if (dim.w > 1000 || dim.h > 1000) {
      toast.error(
        `해상도 ${dim.w}×${dim.h}px — 최대 1000×1000px 까지 가능합니다.`
      );
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await uploadAutoSmsImage(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setForm((f) => ({ ...f, image_path: res.path, imageUrl: res.url }));
    } finally {
      setUploading(false);
    }
  };

  const onSave = async () => {
    const offset = Number(form.offset_days);
    setSaving(true);
    try {
      const res = await saveAutoSmsRule({
        id: form.id,
        name: form.name,
        title: form.title,
        anchor_field: form.anchor_field,
        offset_days: Number.isFinite(offset) ? Math.trunc(offset) : NaN,
        send_time: form.timeMode === "fixed" ? form.send_time : null,
        body: form.body,
        image_path: form.image_path,
        is_active: form.is_active,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(form.id ? "자동 문자를 수정했습니다." : "자동 문자를 등록했습니다.");
      setOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const onToggle = async (r: Rule, next: boolean) => {
    const res = await toggleAutoSmsRule(r.id, next);
    if (!res.ok) toast.error(res.error);
    router.refresh();
  };

  const onDelete = async (r: Rule) => {
    if (
      !confirm(
        `"${r.name}" 자동 문자를 삭제할까요?\n발송 기록도 함께 삭제됩니다. (이미 발송된 문자는 취소되지 않습니다)`
      )
    )
      return;
    const res = await deleteAutoSmsRule(r.id);
    if (!res.ok) toast.error(res.error);
    else toast.success("삭제했습니다.");
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* 동작 안내 */}
      <div className="flex items-start gap-3 rounded-md border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
        <Info className="size-4 mt-0.5 shrink-0" />
        <div className="space-y-1">
          <p>
            활성화된 자동 문자는 <b>전화번호가 등록된 모든 교육생</b> 중 발송
            시점이 도래한 고객에게 <b>한 룰당 1회</b> 발송됩니다. 발송 여부는
            10분마다 확인됩니다.
          </p>
          <p>
            룰을 만들기 <b>이전에 이미 시점이 지난 고객에게는 발송되지 않습니다</b>
            (등록일 이후 도래분부터 적용).
          </p>
        </div>
      </div>

      {/* 룰 목록 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">자동 문자 목록</CardTitle>
            <CardDescription>
              생애주기 날짜 기준 자동 발송 룰 {rules.length}건
            </CardDescription>
          </div>
          <Button onClick={openCreate}>
            <Plus className="size-4 mr-1" />새 자동 문자
          </Button>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center border border-dashed border-border rounded-md">
              등록된 자동 문자가 없습니다. &quot;새 자동 문자&quot; 로 첫 룰을
              만들어보세요.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>문자 이름</TableHead>
                    <TableHead>시점</TableHead>
                    <TableHead className="max-w-[280px]">내용</TableHead>
                    <TableHead className="w-20">이미지</TableHead>
                    <TableHead className="w-28">발송</TableHead>
                    <TableHead className="w-16">활성</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {r.name}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {describeTiming(r)}
                      </TableCell>
                      <TableCell className="max-w-[280px]">
                        <p className="truncate text-sm text-muted-foreground">
                          {r.body}
                        </p>
                      </TableCell>
                      <TableCell>
                        {r.image_path ? (
                          <Badge variant="secondary" className="gap-1">
                            <ImageIcon className="size-3" />
                            첨부
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {r.sentCount}건
                        {r.failedCount > 0 && (
                          <span className="text-destructive ml-1">
                            (실패 {r.failedCount})
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={r.is_active}
                          onCheckedChange={(v) => onToggle(r, v)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(r)}
                            aria-label="수정"
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onDelete(r)}
                            aria-label="삭제"
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 최근 발송 기록 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">최근 발송 기록</CardTitle>
          <CardDescription>최근 50건</CardDescription>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border rounded-md">
              발송 기록이 없습니다.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>문자 이름</TableHead>
                    <TableHead>수신자</TableHead>
                    <TableHead className="w-24">상태</TableHead>
                    <TableHead className="w-44">발송 시각</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="whitespace-nowrap">
                        {s.ruleName}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {s.customer}
                      </TableCell>
                      <TableCell>
                        {s.status === "sent" ? (
                          <Badge variant="secondary">발송됨</Badge>
                        ) : s.status === "failed" ? (
                          <Badge
                            variant="destructive"
                            title={s.error ?? undefined}
                          >
                            실패
                          </Badge>
                        ) : (
                          <Badge variant="outline">대기</Badge>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {s.sentAt}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 생성/수정 다이얼로그 */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {form.id ? "자동 문자 수정" : "새 자동 문자"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* 문자 이름 */}
            <div className="space-y-1.5">
              <Label htmlFor="auto-sms-name">문자 이름</Label>
              <Input
                id="auto-sms-name"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="예: 취업 10일차 안부 문자"
              />
              <p className="text-xs text-muted-foreground">
                내부 관리용 이름 — 고객에게 보이지 않습니다.
              </p>
            </div>

            {/* 제목 */}
            <div className="space-y-1.5">
              <Label htmlFor="auto-sms-title">제목</Label>
              <Input
                id="auto-sms-title"
                value={form.title}
                maxLength={40}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                placeholder="[글로케어]"
              />
              <p className="text-xs text-muted-foreground">
                문자(MMS) 제목으로 표시됩니다 (최대 40자). 비우면 [글로케어]로
                발송됩니다.
              </p>
            </div>

            {/* 시점 */}
            <div className="space-y-1.5">
              <Label>시점</Label>
              <div className="flex items-center gap-2">
                <Select
                  value={form.anchor_field}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, anchor_field: v ?? f.anchor_field }))
                  }
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ANCHOR_FIELDS.map((a) => (
                      <SelectItem key={a.value} value={a.value}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  className="w-24"
                  value={form.offset_days}
                  min={-365}
                  max={365}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, offset_days: e.target.value }))
                  }
                />
                <span className="text-sm text-muted-foreground shrink-0">
                  일 후
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                예: 근무 시작일 +10 = 취업 10일 후. 음수는 며칠 전(-3 = 3일 전),
                0 = 당일.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <Select
                  value={form.timeMode}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      timeMode: (v ?? "immediate") as FormState["timeMode"],
                    }))
                  }
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="immediate">즉시</SelectItem>
                    <SelectItem value="fixed">시간 지정</SelectItem>
                  </SelectContent>
                </Select>
                {form.timeMode === "fixed" && (
                  <Input
                    type="time"
                    className="w-32"
                    value={form.send_time}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, send_time: e.target.value }))
                    }
                  />
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                즉시: 시점이 도래하면 바로(10분 이내) 발송됩니다. 단, 미래
                날짜가 도래한 날에는 <b>오전 9시(서울 기준)</b>에 발송됩니다.
                시간 지정 시 해당 시각(서울 기준)에 발송됩니다.
              </p>
            </div>

            {/* 내용 */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="auto-sms-body">내용</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={insertName}
                >
                  + 이름 넣기
                </Button>
              </div>
              <Textarea
                id="auto-sms-body"
                ref={bodyRef}
                rows={6}
                value={form.body}
                onChange={(e) =>
                  setForm((f) => ({ ...f, body: e.target.value }))
                }
                placeholder={"{이름}님, 안녕하세요. 글로케어입니다."}
              />
              <p className="text-xs text-muted-foreground">
                {"{이름}"} 은 발송 시 고객 이름으로 자동 치환됩니다. 현재{" "}
                {bodyBytes} / 1,900 byte
                {bodyBytes > 1900 && (
                  <span className="text-destructive"> — 너무 깁니다</span>
                )}
              </p>
            </div>

            {/* 이미지 */}
            <div className="space-y-1.5">
              <Label htmlFor="auto-sms-image">이미지 첨부 (선택)</Label>
              {form.imageUrl ? (
                <div className="flex items-start gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={form.imageUrl}
                    alt="첨부 이미지 미리보기"
                    className="h-24 w-24 rounded-md border border-border object-cover"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setForm((f) => ({ ...f, image_path: null, imageUrl: null }))
                    }
                  >
                    이미지 제거
                  </Button>
                </div>
              ) : (
                <Input
                  id="auto-sms-image"
                  type="file"
                  accept=".jpg,.jpeg,image/jpeg"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void onPickImage(file);
                    e.target.value = "";
                  }}
                />
              )}
              <p className="text-xs text-muted-foreground">
                규격: jpg/jpeg · 최대 300KB · 1000×1000px 이하 (문자 MMS 규격).
                {uploading && " 업로드 중…"}
              </p>
            </div>

            {/* 활성 */}
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <p className="text-sm font-medium">활성화</p>
                <p className="text-xs text-muted-foreground">
                  끄면 발송이 중단됩니다 (기록은 유지).
                </p>
              </div>
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) =>
                  setForm((f) => ({ ...f, is_active: v }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button onClick={onSave} disabled={saving || uploading}>
              {saving ? "저장 중…" : form.id ? "수정" : "등록"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
