"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Save, Trash2 } from "lucide-react";

import {
  studyChannelSchema,
  type StudyChannelInput,
  type StudyChannelOutput,
} from "@/lib/validators";
import {
  createStudyChannel,
  updateStudyChannel,
  deleteStudyChannel,
} from "@/app/(app)/study-channels/actions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { navigateBackOrTo } from "@/lib/navigate-back";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Props = {
  mode: "create" | "edit";
  channelId?: number;
  defaultValues?: Partial<StudyChannelInput>;
};

const EMPTY: StudyChannelInput = {
  active: true,
  type: "tiktok",
  icon: null,
  name_ko: null,
  name_vi: null,
  desc_ko: null,
  desc_vi: null,
  handle: null,
  url: null,
  sort_order: 0,
  memo: null,
};

export function StudyChannelForm({ mode, channelId, defaultValues }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deleting, setDeleting] = useState(false);

  const form = useForm<StudyChannelInput, unknown, StudyChannelOutput>({
    resolver: zodResolver(studyChannelSchema),
    defaultValues: { ...EMPTY, ...defaultValues },
  });

  function onSubmit(values: StudyChannelOutput) {
    startTransition(async () => {
      if (mode === "create") {
        const r = await createStudyChannel(values);
        if (!r.ok) {
          toast.error("등록 실패", { description: r.error });
          return;
        }
        toast.success("등록되었습니다.");
        navigateBackOrTo(router, "/study-channels");
      } else if (channelId != null) {
        const r = await updateStudyChannel(channelId, values);
        if (r.ok) {
          toast.success("저장되었습니다.");
          navigateBackOrTo(router, "/study-channels");
        } else {
          toast.error("저장 실패", { description: r.error });
        }
      }
    });
  }

  async function handleDelete() {
    if (channelId == null) return;
    setDeleting(true);
    const r = await deleteStudyChannel(channelId);
    if (r && !r.ok) {
      toast.error("삭제 실패", { description: r.error });
      setDeleting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">채널 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>채널 유형</FormLabel>
                    <FormControl>
                      <select
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(e.target.value || null)
                        }
                        className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm"
                      >
                        <option value="tiktok">TikTok</option>
                        <option value="facebook">Facebook</option>
                        <option value="instagram">Instagram</option>
                        <option value="youtube">YouTube</option>
                        <option value="kakao">KakaoTalk</option>
                        <option value="website">Website</option>
                      </select>
                    </FormControl>
                    <FormDescription>
                      홈페이지 카드 배경색을 결정
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="icon"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>아이콘</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        placeholder="🎵"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>공개</FormLabel>
                    <FormControl>
                      <label className="flex items-center gap-2 text-sm h-9">
                        <input
                          type="checkbox"
                          checked={field.value ?? true}
                          onChange={(e) => field.onChange(e.target.checked)}
                          className="size-4"
                        />
                        활성
                      </label>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name_ko"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>이름 (한)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        placeholder="예: 글로케어 TikTok"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name_vi"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>이름 (베)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        placeholder="vd: Kênh TikTok GLOCARE"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="desc_ko"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>설명 (한)</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="desc_vi"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>설명 (베)</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="handle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>핸들</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        placeholder="@glocare"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        placeholder="https://..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="sort_order"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>정렬 순서</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        value={field.value ?? 0}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="memo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>메모 (내부용)</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        value={field.value ?? ""}
                        rows={2}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          {mode === "edit" && channelId != null ? (
            <Dialog>
              <DialogTrigger
                className="inline-flex h-9 items-center gap-2 rounded-md border border-destructive/30 bg-card px-3 text-sm font-medium text-destructive hover:bg-destructive/5 transition-colors"
                disabled={pending || deleting}
              >
                <Trash2 className="size-4" />
                삭제
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>채널 삭제</DialogTitle>
                  <DialogDescription>
                    이 채널을 삭제하시겠습니까?
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={deleting}
                  >
                    {deleting && <Loader2 className="size-4 animate-spin" />}
                    {deleting ? "삭제 중…" : "확인 — 삭제"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : (
            <span />
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={pending}
            >
              취소
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              <Save className="size-4" />
              {mode === "create" ? "등록" : "저장"}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
