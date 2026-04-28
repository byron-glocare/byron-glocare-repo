"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Save, Trash2 } from "lucide-react";

import {
  departmentSchema,
  type DepartmentInput,
  type DepartmentOutput,
} from "@/lib/validators";
import {
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from "@/app/(app)/universities/actions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  deptId?: number;
  defaultValues?: Partial<DepartmentInput>;
  universityOptions: { id: number; name_ko: string; emoji: string | null }[];
  /** edit 시 어디로 돌아갈지 (기본: /departments) */
  backHref?: string;
};

const EMPTY_BASE: Omit<DepartmentInput, "university_id"> = {
  active: true,
  icon: null,
  name_ko: "",
  name_vi: null,
  category: null,
  degree_years: null,
  tuition_ko: null,
  tuition_vi: null,
  scholarship_ko: null,
  scholarship_vi: null,
  dept_url: null,
  badge: null,
  case_ids: null,
  course: null,
  sort_order: 0,
};

export function DepartmentForm({
  mode,
  deptId,
  defaultValues,
  universityOptions,
  backHref = "/departments",
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deleting, setDeleting] = useState(false);

  const initial: DepartmentInput = {
    ...EMPTY_BASE,
    university_id:
      defaultValues?.university_id ?? universityOptions[0]?.id ?? 0,
    ...defaultValues,
  };

  const form = useForm<DepartmentInput, unknown, DepartmentOutput>({
    resolver: zodResolver(departmentSchema),
    defaultValues: initial,
  });

  function onSubmit(values: DepartmentOutput) {
    startTransition(async () => {
      if (mode === "create") {
        const r = await createDepartment(values);
        if (!r.ok) {
          toast.error("등록 실패", { description: r.error });
          return;
        }
        toast.success("등록되었습니다.");
        navigateBackOrTo(router, backHref);
      } else if (deptId != null) {
        const r = await updateDepartment(deptId, values);
        if (r.ok) {
          toast.success("저장되었습니다.");
          navigateBackOrTo(router, backHref);
        } else {
          toast.error("저장 실패", { description: r.error });
        }
      }
    });
  }

  async function handleDelete() {
    if (deptId == null) return;
    setDeleting(true);
    const r = await deleteDepartment(deptId);
    if (r && !r.ok) {
      toast.error("삭제 실패", { description: r.error });
      setDeleting(false);
    } else {
      toast.success("삭제되었습니다.");
      router.push(backHref);
      router.refresh();
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">학과 기본 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="university_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    소속 대학 <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <select
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                      className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs"
                    >
                      {universityOptions.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.emoji ?? "🎓"} {u.name_ko}
                        </option>
                      ))}
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid sm:grid-cols-3 gap-4">
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
                        placeholder="📚"
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
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name_ko"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      학과명 (한) <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="예: 자동차학과" />
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
                    <FormLabel>학과명 (베)</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>카테고리</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        placeholder="예: 자동차"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="course"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>코스 탭</FormLabel>
                    <FormControl>
                      <select
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(e.target.value || null)
                        }
                        className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm"
                      >
                        <option value="">— (모두에 노출)</option>
                        <option value="direct">direct (바로 진학)</option>
                        <option value="language">language (어학당 경유)</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="badge"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>뱃지</FormLabel>
                    <FormControl>
                      <select
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(e.target.value || null)
                        }
                        className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm"
                      >
                        <option value="">— 없음</option>
                        <option value="hot">hot (인기)</option>
                        <option value="good">good (추천)</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="degree_years"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>수학 기간 (년)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(e.target.value === "" ? null : e.target.value)
                        }
                        placeholder="예: 4"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dept_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>학과 홈페이지</FormLabel>
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">학비 / 장학금</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="tuition_ko"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>학비 (한)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        placeholder="예: 연 600만원"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tuition_vi"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>학비 (베)</FormLabel>
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
                name="scholarship_ko"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>장학금 (한)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        placeholder="예: 30% 감면"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="scholarship_vi"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>장학금 (베)</FormLabel>
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
              name="case_ids"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>관련 사례 IDs (선택)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      placeholder="쉼표 구분: 1,3,5"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          {mode === "edit" && deptId != null ? (
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
                  <DialogTitle>학과 삭제</DialogTitle>
                  <DialogDescription>
                    이 학과를 삭제하시겠습니까?
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
