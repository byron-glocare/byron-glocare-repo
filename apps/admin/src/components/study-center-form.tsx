"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Save, Trash2 } from "lucide-react";

import {
  studyCenterSchema,
  type StudyCenterInput,
  type StudyCenterOutput,
} from "@/lib/validators";
import {
  createStudyCenter,
  updateStudyCenter,
  deleteStudyCenter,
} from "@/app/(app)/study-centers/actions";

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
  centerId?: number;
  defaultValues?: Partial<StudyCenterInput>;
};

const EMPTY: StudyCenterInput = {
  active: true,
  flag: "🇻🇳",
  name_ko: null,
  name_vi: "",
  city_ko: null,
  city_vi: null,
  address: null,
  phone: null,
  email: null,
  desc_ko: null,
  desc_vi: null,
  students_ko: null,
  students_vi: null,
  years_ko: null,
  years_vi: null,
};

export function StudyCenterForm({ mode, centerId, defaultValues }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deleting, setDeleting] = useState(false);

  const form = useForm<StudyCenterInput, unknown, StudyCenterOutput>({
    resolver: zodResolver(studyCenterSchema),
    defaultValues: { ...EMPTY, ...defaultValues },
  });

  function onSubmit(values: StudyCenterOutput) {
    startTransition(async () => {
      if (mode === "create") {
        const r = await createStudyCenter(values);
        if (!r.ok) {
          toast.error("등록 실패", { description: r.error });
          return;
        }
        toast.success("등록되었습니다.");
        navigateBackOrTo(router, "/study-centers");
      } else if (centerId != null) {
        const r = await updateStudyCenter(centerId, values);
        if (r.ok) {
          toast.success("저장되었습니다.");
          navigateBackOrTo(router, "/study-centers");
        } else {
          toast.error("저장 실패", { description: r.error });
        }
      }
    });
  }

  async function handleDelete() {
    if (centerId == null) return;
    setDeleting(true);
    const r = await deleteStudyCenter(centerId);
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
                  name="flag"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>국기</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ""}
                          placeholder="🇻🇳"
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
                name="name_vi"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      센터명 (베) <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="예: Trung tâm Hà Nội"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name_ko"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>센터명 (한)</FormLabel>
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
                  name="city_vi"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>도시 (베)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ""}
                          placeholder="Hà Nội"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="city_ko"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>도시 (한)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ""}
                          placeholder="하노이"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>주소</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">연락처 / 통계</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>전화</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>이메일</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          {...field}
                          value={field.value ?? ""}
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
                  name="students_ko"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>누적 학생 수 (한)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ""}
                          placeholder="예: 200+ 명"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="students_vi"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>누적 학생 수 (베)</FormLabel>
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
                  name="years_ko"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>운영 연수 (한)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ""}
                          placeholder="예: 5년"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="years_vi"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>운영 연수 (베)</FormLabel>
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
            <CardTitle className="text-base">설명</CardTitle>
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
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          {mode === "edit" && centerId != null ? (
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
                  <DialogTitle>유학센터 삭제</DialogTitle>
                  <DialogDescription>
                    이 센터를 삭제하시겠습니까?
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
