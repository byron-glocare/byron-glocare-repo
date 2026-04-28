"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Save, Trash2 } from "lucide-react";

import {
  studyCaseSchema,
  type StudyCaseInput,
  type StudyCaseOutput,
} from "@/lib/validators";
import {
  createStudyCase,
  updateStudyCase,
  deleteStudyCase,
} from "@/app/(app)/study-cases/actions";

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
  caseId?: number;
  defaultValues?: Partial<StudyCaseInput>;
};

const EMPTY: StudyCaseInput = {
  active: true,
  tiktok_url: null,
  tiktok_thumb: null,
  hero: "N",
  category_ko: null,
  category_vi: null,
  title_ko: null,
  title_vi: null,
  desc_ko: null,
  desc_vi: null,
};

export function StudyCaseForm({ mode, caseId, defaultValues }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deleting, setDeleting] = useState(false);

  const form = useForm<StudyCaseInput, unknown, StudyCaseOutput>({
    resolver: zodResolver(studyCaseSchema),
    defaultValues: { ...EMPTY, ...defaultValues },
  });

  function onSubmit(values: StudyCaseOutput) {
    startTransition(async () => {
      if (mode === "create") {
        const result = await createStudyCase(values);
        if (!result.ok) {
          toast.error("등록 실패", { description: result.error });
          return;
        }
        toast.success("등록되었습니다.");
        navigateBackOrTo(router, "/study-cases");
      } else if (caseId != null) {
        const result = await updateStudyCase(caseId, values);
        if (result.ok) {
          toast.success("저장되었습니다.");
          navigateBackOrTo(router, "/study-cases");
        } else {
          toast.error("저장 실패", { description: result.error });
        }
      }
    });
  }

  async function handleDelete() {
    if (caseId == null) return;
    setDeleting(true);
    const result = await deleteStudyCase(caseId);
    if (result && !result.ok) {
      toast.error("삭제 실패", { description: result.error });
      setDeleting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">노출 설정</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="hero"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      노출 위치 <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <select
                        {...field}
                        value={field.value ?? "N"}
                        className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40"
                      >
                        <option value="N">N — Cases 그리드 (Hero 아래)</option>
                        <option value="1">1 — Hero 영역, 1순위</option>
                        <option value="2">2 — Hero 영역, 2순위</option>
                        <option value="3">3 — Hero 영역, 3순위</option>
                      </select>
                    </FormControl>
                    <FormDescription>
                      홈페이지 첫 화면 우측 영상 배치 순서. N 은 아래 사례 그리드.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>공개 여부</FormLabel>
                    <FormControl>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={field.value ?? true}
                          onChange={(e) => field.onChange(e.target.checked)}
                          className="size-4"
                        />
                        활성 (홈페이지 노출)
                      </label>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tiktok_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      TikTok URL <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        placeholder="https://www.tiktok.com/@user/video/..."
                      />
                    </FormControl>
                    <FormDescription>
                      썸네일은 자동 추출되니 thumb 는 비워둬도 됨.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tiktok_thumb"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>썸네일 URL (선택)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        placeholder="자동 추출되므로 보통 비워둠"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">카테고리 / 제목</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="category_ko"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>카테고리 (한)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ""}
                          placeholder="예: 요양보호사"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="category_vi"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>카테고리 (베)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ""}
                          placeholder="vd: Chăm sóc người cao tuổi"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="title_ko"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>제목 (한)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        placeholder="예: 베트남에서 한국 요양원 취업까지 — 짱 씨"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="title_vi"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>제목 (베)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        placeholder="vd: Từ Việt Nam đến viện dưỡng lão Hàn Quốc"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">설명 (선택)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="desc_ko"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>설명 (한)</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value ?? ""}
                      rows={3}
                      placeholder="홈페이지에는 노출되지 않음. 내부 메모용으로 활용 가능."
                    />
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
                    <Textarea
                      {...field}
                      value={field.value ?? ""}
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          {mode === "edit" && caseId != null ? (
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
                  <DialogTitle>사례 삭제</DialogTitle>
                  <DialogDescription>
                    이 사례를 삭제하시겠습니까? 되돌릴 수 없습니다.
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
