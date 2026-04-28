"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Save, Trash2 } from "lucide-react";

import {
  universitySchema,
  type UniversityInput,
  type UniversityOutput,
} from "@/lib/validators";
import {
  createUniversity,
  updateUniversity,
  deleteUniversity,
} from "@/app/(app)/universities/actions";

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
  universityId?: number;
  defaultValues?: Partial<UniversityInput>;
};

const EMPTY: UniversityInput = {
  active: true,
  name_ko: "",
  name_vi: null,
  region_ko: null,
  region_vi: null,
  logo_url: null,
  photo_url: null,
  website_url: null,
  desc_ko: null,
  desc_vi: null,
  class_days_ko: null,
  class_days_vi: null,
  transport_bus: false,
  transport_subway: false,
  transport_train: false,
  transport_desc_ko: null,
  transport_desc_vi: null,
  dormitory: false,
  dormitory_desc_ko: null,
  dormitory_desc_vi: null,
  strengths: null,
  tags_ko: null,
  tags_vi: null,
  categories: null,
  emoji: null,
};

export function UniversityForm({
  mode,
  universityId,
  defaultValues,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deleting, setDeleting] = useState(false);

  const form = useForm<UniversityInput, unknown, UniversityOutput>({
    resolver: zodResolver(universitySchema),
    defaultValues: { ...EMPTY, ...defaultValues },
  });

  function onSubmit(values: UniversityOutput) {
    startTransition(async () => {
      if (mode === "create") {
        const r = await createUniversity(values);
        if (!r.ok) {
          toast.error("등록 실패", { description: r.error });
          return;
        }
        toast.success("등록되었습니다.");
        navigateBackOrTo(router, "/universities");
      } else if (universityId != null) {
        const r = await updateUniversity(universityId, values);
        if (r.ok) {
          toast.success("저장되었습니다.");
          navigateBackOrTo(router, "/universities");
        } else {
          toast.error("저장 실패", { description: r.error });
        }
      }
    });
  }

  async function handleDelete() {
    if (universityId == null) return;
    setDeleting(true);
    const r = await deleteUniversity(universityId);
    if (r && !r.ok) {
      toast.error("삭제 실패", { description: r.error });
      setDeleting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">기본 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="emoji"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>이모지</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ""}
                          placeholder="🎓"
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
                      <FormLabel>공개 여부</FormLabel>
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

              <FormField
                control={form.control}
                name="name_ko"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      대학명 (한) <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="예: 호산대학교" />
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
                    <FormLabel>대학명 (베)</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="region_ko"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>지역 (한)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ""}
                          placeholder="예: 경상북도 경산시"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="region_vi"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>지역 (베)</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="website_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>홈페이지 URL</FormLabel>
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

              <FormField
                control={form.control}
                name="categories"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>카테고리</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        placeholder="쉼표 구분: 자동차, 요양보호, 호텔"
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
              <CardTitle className="text-base">홈페이지 노출 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="strengths"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>특징 / 강점</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        value={field.value ?? ""}
                        rows={2}
                        placeholder="홈페이지 학과 모달에 노출"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="tags_ko"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>태그 (한)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ""}
                          placeholder="쉼표: 4년제, 기숙사, 장학금"
                        />
                      </FormControl>
                      <FormDescription>홈페이지 카드에 칩으로 노출</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="tags_vi"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>태그 (베)</FormLabel>
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
                  name="logo_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>로고 URL</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="photo_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>대표 사진 URL</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">상세 설명 (선택)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
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
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="class_days_ko"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>수업일 (한)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        placeholder="예: 월~금 9-18시"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="class_days_vi"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>수업일 (베)</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div>
              <FormLabel className="block mb-2">교통편</FormLabel>
              <div className="flex gap-4 items-center mb-2">
                <FormField
                  control={form.control}
                  name="transport_bus"
                  render={({ field }) => (
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={field.value ?? false}
                        onChange={(e) => field.onChange(e.target.checked)}
                        className="size-4"
                      />
                      🚌 버스
                    </label>
                  )}
                />
                <FormField
                  control={form.control}
                  name="transport_subway"
                  render={({ field }) => (
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={field.value ?? false}
                        onChange={(e) => field.onChange(e.target.checked)}
                        className="size-4"
                      />
                      🚇 지하철
                    </label>
                  )}
                />
                <FormField
                  control={form.control}
                  name="transport_train"
                  render={({ field }) => (
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={field.value ?? false}
                        onChange={(e) => field.onChange(e.target.checked)}
                        className="size-4"
                      />
                      🚆 기차
                    </label>
                  )}
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="transport_desc_ko"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ""}
                          placeholder="교통편 메모 (한)"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="transport_desc_vi"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ""}
                          placeholder="교통편 메모 (베)"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div>
              <FormField
                control={form.control}
                name="dormitory"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={field.value ?? false}
                          onChange={(e) => field.onChange(e.target.checked)}
                          className="size-4"
                        />
                        🏠 기숙사 운영
                      </label>
                    </FormLabel>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid sm:grid-cols-2 gap-4 mt-2">
                <FormField
                  control={form.control}
                  name="dormitory_desc_ko"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ""}
                          placeholder="기숙사 메모 (한)"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dormitory_desc_vi"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ""}
                          placeholder="기숙사 메모 (베)"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          {mode === "edit" && universityId != null ? (
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
                  <DialogTitle>대학 삭제</DialogTitle>
                  <DialogDescription>
                    이 대학을 삭제하시겠습니까? 소속 학과가 있으면 삭제되지
                    않습니다.
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
