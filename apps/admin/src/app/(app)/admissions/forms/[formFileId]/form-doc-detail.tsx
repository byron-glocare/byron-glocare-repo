"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, RefreshCw, Save, Upload } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  updateFormFileDetailAction,
  uploadFormFileAction,
  type UpdateFormDetailState,
  type UploadFormFileState,
} from "@/app/(app)/universities/[id]/forms/actions";

// 적용학기 후보: 2026~2030 × 4분기 (어학당 4학기 / 일반 봄·가을)
const QUARTERS: Array<{ q: string; ko: string }> = [
  { q: "Spring", ko: "봄" },
  { q: "Summer", ko: "여름" },
  { q: "Fall", ko: "가을" },
  { q: "Winter", ko: "겨울" },
];
const TERM_OPTIONS: Array<{ value: string; label: string }> = (() => {
  const out: Array<{ value: string; label: string }> = [];
  for (let y = 2026; y <= 2030; y++) {
    for (const { q, ko } of QUARTERS) {
      out.push({ value: `${y}-${q}`, label: `${y} ${ko}` });
    }
  }
  return out;
})();

type FormDoc = {
  id: string;
  university_id: number;
  university_name: string;
  key: string;
  name_ko: string;
  file_url: string;
  file_name: string;
  department_name: string | null;
  notes: string | null;
  uploaded_at: string;
  required_data_type_keys: string[];
  applies_to_terms: string[];
  applies_to_department_ids: number[];
};

type Dept = { id: number; name_ko: string; active: boolean };

export function FormDocDetail({
  form,
  departments,
  docNameOptions,
}: {
  form: FormDoc;
  departments: Dept[];
  docNameOptions: string[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<UpdateFormDetailState, FormData>(
    updateFormFileDetailAction,
    undefined
  );
  const [upState, upAction, upPending] = useActionState<
    UploadFormFileState,
    FormData
  >(uploadFormFileAction, undefined);

  // 파일 교체
  const replaceRef = useRef<HTMLInputElement>(null);
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const upSubmitted = useRef(false);

  const [nameKo, setNameKo] = useState(form.name_ko);
  const [notes, setNotes] = useState(form.notes ?? "");
  const [allDepts, setAllDepts] = useState(form.applies_to_department_ids.length === 0);
  const [deptIds, setDeptIds] = useState<number[]>(form.applies_to_department_ids);
  const [terms, setTerms] = useState<string[]>(form.applies_to_terms);

  useEffect(() => {
    if (state?.success) {
      toast.success("저장되었습니다.");
      // 저장 후 대학교 상세로 복귀
      router.push(`/universities/${form.university_id}`);
    } else if (state?.error) {
      toast.error("저장 실패", { description: state.error });
    }
  }, [state, router, form.university_id]);

  useEffect(() => {
    if (!upSubmitted.current) return;
    if (upState?.error) {
      toast.error("파일 교체 실패", { description: upState.error });
      upSubmitted.current = false;
    } else if (upState?.fieldErrors) {
      toast.error("파일 교체 실패");
      upSubmitted.current = false;
    } else if (upState) {
      toast.success("파일을 교체했습니다.");
      router.push(`/universities/${form.university_id}`);
    }
  }, [upState, router, form.university_id]);

  async function doReplace(withAi: boolean) {
    if (!replaceFile) return toast.error("교체할 파일을 선택하세요");
    const dataUrl = await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = () => rej(r.error);
      r.readAsDataURL(replaceFile);
    });
    const comma = dataUrl.indexOf(",");
    const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
    const fd = new FormData();
    fd.set("university_id", String(form.university_id));
    fd.set("key", form.key); // 같은 종류·범위로 새 버전 생성(기존 supersede)
    fd.set("department_name", form.department_name ?? "");
    fd.set("name_ko", nameKo.trim() || form.name_ko);
    fd.set("file_base64", base64);
    fd.set("file_name", replaceFile.name);
    fd.set("file_size", String(replaceFile.size));
    fd.set("mime_type", replaceFile.type || "application/octet-stream");
    // 파일만 교체 = 기존 필요데이터 유지·AI 미실행 / 함께 교체 = AI 재분석
    fd.set("required_data_type_keys", JSON.stringify(form.required_data_type_keys));
    fd.set("auto_analyze", withAi ? "on" : "off");
    upSubmitted.current = true;
    startTransition(() => upAction(fd));
  }

  const toggle = <T,>(arr: T[], v: T): T[] =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  return (
    <form
      action={(fd) => {
        fd.set("form_file_id", form.id);
        fd.set("university_id", String(form.university_id));
        fd.set("name_ko", nameKo);
        fd.set("notes", notes);
        fd.set("applies_to_terms", JSON.stringify(terms));
        fd.set(
          "applies_to_department_ids",
          JSON.stringify(allDepts ? [] : deptIds)
        );
        action(fd);
      }}
      className="space-y-6"
    >
      {/* 기본 정보 */}
      <Card className="p-6 space-y-4">
        <h2 className="text-base font-semibold">기본 정보</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium">서류명</span>
            <Input
              list="doc-name-options"
              value={nameKo}
              onChange={(e) => setNameKo(e.target.value)}
              placeholder="예: 입학지원서"
            />
            <datalist id="doc-name-options">
              {docNameOptions.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
            {docNameOptions.length > 0 ? (
              <span className="text-[11px] text-muted-foreground">
                모집요강 제출서류에서 선택하거나 직접 입력
              </span>
            ) : null}
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium">대학교</span>
            <Input value={form.university_name} disabled />
            <span className="text-[11px] text-muted-foreground">
              대학 이동은 현재 미지원 (대학교 메뉴에서 관리)
            </span>
          </label>
        </div>

        {/* 적용학과 */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium">적용 학과</span>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={allDepts}
              onChange={(e) => setAllDepts(e.target.checked)}
              className="size-4"
            />
            모든 학과
          </label>
          {!allDepts ? (
            <div className="flex flex-wrap gap-1.5">
              {departments.length === 0 ? (
                <span className="text-xs text-muted-foreground">
                  등록된 학과가 없습니다.
                </span>
              ) : (
                departments.map((d) => {
                  const on = deptIds.includes(d.id);
                  return (
                    <button
                      type="button"
                      key={d.id}
                      onClick={() => setDeptIds((cur) => toggle(cur, d.id))}
                      className={`rounded-md border px-2 py-1 text-xs ${
                        on
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-input hover:bg-muted"
                      }`}
                    >
                      {d.name_ko}
                      {!d.active ? " (숨김)" : ""}
                    </button>
                  );
                })
              )}
            </div>
          ) : null}
        </div>

        {/* 적용학기 */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium">
            적용 학기{" "}
            <span className="font-normal text-muted-foreground">
              (선택 없음 = 전체 학기 · 어학당 4학기/일반 봄·가을)
            </span>
          </span>
          <div className="flex flex-wrap gap-1.5">
            {TERM_OPTIONS.map((t) => {
              const on = terms.includes(t.value);
              return (
                <button
                  type="button"
                  key={t.value}
                  onClick={() => setTerms((cur) => toggle(cur, t.value))}
                  className={`rounded-md border px-2 py-1 text-xs ${
                    on
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-input hover:bg-muted"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium">업로드 일자</span>
            <span className="text-sm">
              {new Date(form.uploaded_at).toLocaleDateString("ko-KR")}
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium">다운로드</span>
            <div className="flex flex-wrap gap-2">
              <a
                href={form.file_url}
                target="_blank"
                rel="noreferrer"
                download
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <Download className="size-4" />
                원본 ({form.file_name})
              </a>
            </div>
          </div>
        </div>

        {/* 파일 교체 */}
        <div className="border-t pt-4">
          {!replaceOpen ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setReplaceOpen(true)}
            >
              <RefreshCw className="size-4" />
              파일 교체
            </Button>
          ) : (
            <div className="space-y-2 rounded-md border border-input p-3">
              <p className="text-sm font-medium">새 파일로 변경하시겠습니까?</p>
              <input
                ref={replaceRef}
                type="file"
                onChange={(e) => setReplaceFile(e.target.files?.[0] ?? null)}
                className="text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-secondary/80"
              />
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={upPending || !replaceFile}
                  onClick={() => doReplace(false)}
                >
                  {upPending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                  파일만 교체
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={upPending || !replaceFile}
                  onClick={() => doReplace(true)}
                >
                  {upPending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                  양식과 파일 함께 교체 (AI)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={upPending}
                  onClick={() => {
                    setReplaceOpen(false);
                    setReplaceFile(null);
                  }}
                >
                  취소
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                '함께 교체'는 새 파일로 AI가 필요 표준데이터를 다시 정리합니다(30~60초).
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* 메모 */}
      <Card className="p-6 space-y-4">
        <h2 className="text-base font-semibold">메모</h2>
        <p className="-mt-2 text-xs text-muted-foreground">
          양식 종류·필요 표준데이터는 아래 “문서 자동화 설정”에서 박스를 배치·연결하면
          자동으로 정해집니다.
        </p>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium">메모</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          저장
        </Button>
      </div>
    </form>
  );
}
