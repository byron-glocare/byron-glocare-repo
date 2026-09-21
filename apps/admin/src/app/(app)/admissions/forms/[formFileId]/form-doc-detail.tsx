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
import { DeleteFormFileButton } from "@/components/admission/delete-form-file-button";

const KIND_LABEL: Record<"language" | "regular", string> = { language: "어학당", regular: "일반학과" };

type FormDoc = {
  id: string;
  university_id: number;
  university_name: string;
  key: string;
  name_ko: string;
  file_url: string;
  file_name: string;
  /** 옛 표시용 컬럼 */
  department_name: string | null;
  /** 양식이 속한 요강 학과 (0067). null = 옛 행 — 여기서 지정해 고친다. */
  spec_department_id: string | null;
  is_current: boolean;
  notes: string | null;
  uploaded_at: string;
  required_data_type_keys: string[];
};

export type SpecDeptChoice = {
  id: string;
  name_ko: string;
  kind: "language" | "regular";
  is_active: boolean;
  sort_order: number;
};

export function FormDocDetail({
  form,
  specDepartments,
  docNameOptions,
}: {
  form: FormDoc;
  /** 대학 요강의 학과 (어학당 먼저) */
  specDepartments: SpecDeptChoice[];
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
  const [specDeptId, setSpecDeptId] = useState(form.spec_department_id ?? "");

  const currentDept = specDepartments.find((d) => d.id === form.spec_department_id) ?? null;

  useEffect(() => {
    if (state?.success) {
      toast.success("기본정보를 저장했습니다.");
      // 페이지에 머문다 — 서술형·빈칸 배치 등 다른 카드의 미저장 입력이 날아가지 않도록.
      router.refresh();
    } else if (state?.error) {
      toast.error("저장 실패", { description: state.error });
    }
  }, [state, router]);

  useEffect(() => {
    if (!upSubmitted.current) return;
    if (upState?.error) {
      toast.error("파일 교체 실패", { description: upState.error });
      upSubmitted.current = false;
    } else if (upState?.fieldErrors) {
      toast.error("파일 교체 실패", {
        description: Object.values(upState.fieldErrors).join(" / "),
      });
      upSubmitted.current = false;
    } else if (upState) {
      toast.success("파일을 교체했습니다. 이전 파일은 버전 기록에 남습니다.");
      if (upState.warning) toast.warning(upState.warning);
      upSubmitted.current = false;
      router.push(
        upState.formFileId
          ? `/admissions/forms/${upState.formFileId}`
          : `/universities/${form.university_id}`
      );
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
    // 이 행을 교체 — 이 행만 이전 버전이 되고(superseded_by=새 행), 새 행이
    // 학과·서류명·종류·필요데이터·서술형 설정을 서버에서 물려받는다.
    fd.set("replaces_form_file_id", form.id);
    fd.set("spec_department_id", form.spec_department_id ?? "");
    fd.set("department_name", form.department_name ?? "");
    fd.set("name_ko", form.name_ko);
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

  return (
    <form
      action={(fd) => {
        fd.set("form_file_id", form.id);
        fd.set("university_id", String(form.university_id));
        fd.set("name_ko", nameKo);
        fd.set("notes", notes);
        if (specDeptId !== (form.spec_department_id ?? "")) {
          fd.set("spec_department_id", specDeptId);
        }
        action(fd);
      }}
      className="space-y-6"
    >
      {/* 기본 정보 */}
      <Card className="p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold">기본 정보</h2>
          {currentDept ? (
            <>
              <Badge variant="outline">{KIND_LABEL[currentDept.kind]}</Badge>
              <span className="text-sm">{currentDept.name_ko}</span>
            </>
          ) : (
            <Badge variant="outline" className="border-amber-300 text-amber-700">
              요강 학과 미지정
            </Badge>
          )}
          {!form.is_current ? (
            <Badge variant="secondary">이전 버전</Badge>
          ) : null}
          {form.key && form.key !== "other" ? (
            <span className="text-[11px] text-muted-foreground" title="0070 이전에 쓰던 양식 종류 — 지금은 분류에 쓰지 않습니다">
              옛 종류: {form.key}
            </span>
          ) : null}
        </div>

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

        {/* 요강 학과 */}
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium">요강 학과</span>
          <select
            value={specDeptId}
            onChange={(e) => setSpecDeptId(e.target.value)}
            disabled={specDepartments.length === 0}
            className="h-9 max-w-md rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
          >
            <option value="">{specDepartments.length === 0 ? "요강 학과 없음 (모집요강 먼저)" : "— 미지정 —"}</option>
            {specDepartments.map((d) => (
              <option key={d.id} value={d.id}>
                [{KIND_LABEL[d.kind]}] {d.name_ko}
                {!d.is_active ? " (비활성)" : ""}
              </option>
            ))}
          </select>
          <span className="text-[11px] text-muted-foreground">
            양식은 요강 학과에 속하는 독립 문서입니다. 같은 학과에 여러 양식을 둘 수 있고, 서류명으로 구분합니다.
            {form.department_name ? ` (옛 적용범위: ${form.department_name})` : ""}
          </span>
        </label>

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
            <div className="flex flex-wrap items-center gap-2">
            {form.is_current ? (
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
              <span className="text-xs text-muted-foreground">
                이전 버전입니다 — 아래 버전 기록에서 복원한 뒤 교체할 수 있습니다.
              </span>
            )}
            <DeleteFormFileButton formFileId={form.id} universityId={form.university_id} name={form.name_ko} afterHref="/admissions?tab=forms" label="이 양식 삭제" />
            </div>
          ) : (
            <div className="space-y-2 rounded-md border border-input p-3">
              <p className="text-sm font-medium">새 파일로 변경하시겠습니까?</p>
              <p className="text-xs text-muted-foreground">
                이 양식만 이전 버전으로 내려가고, 새 파일이 같은 학과·서류명·서술형 설정을 이어받습니다.
                같은 학과의 다른 양식은 그대로입니다.
              </p>
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
                &lsquo;함께 교체&rsquo;는 새 파일로 AI가 필요 표준데이터를 다시 정리합니다(30~60초).
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* 메모 */}
      <Card className="p-6 space-y-4">
        <h2 className="text-base font-semibold">메모</h2>
        <p className="-mt-2 text-xs text-muted-foreground">
          필요 표준데이터는 아래 “문서 자동화 설정”에서 박스를 배치·연결하면
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
