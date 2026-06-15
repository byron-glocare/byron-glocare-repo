"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  uploadFormFileAction,
  type UploadFormFileState,
} from "@/app/(app)/universities/[id]/forms/actions";

const KEY_LABELS: Record<string, string> = {
  application_form: "입학 지원서",
  self_intro: "자기소개서",
  study_plan: "학업계획서",
  financial_pledge_form: "재정보증서",
  privacy_consent: "개인정보 동의서",
  academic_record_release: "성적 제공 동의서",
  recommendation_letter: "추천서",
  health_certificate: "건강진단서(양식)",
  other: "기타",
};

type Uni = { id: number; name_ko: string };
type Dept = { id: number; university_id: number; name_ko: string; active: boolean };

export function NewFormDoc({
  universities,
  departments,
  preUniversityId,
}: {
  universities: Uni[];
  departments: Dept[];
  preUniversityId: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<UploadFormFileState, FormData>(
    uploadFormFileAction,
    undefined
  );

  const [uniId, setUniId] = useState(preUniversityId);
  const [key, setKey] = useState("application_form");
  const [deptName, setDeptName] = useState(""); // "" = 모든 학과
  const [nameKo, setNameKo] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const submitted = useRef(false);

  const deptOptions = departments.filter(
    (d) => String(d.university_id) === uniId
  );

  useEffect(() => {
    if (!submitted.current) return;
    if (state?.error) {
      toast.error("업로드 실패", { description: state.error });
      submitted.current = false;
    } else if (state?.fieldErrors) {
      toast.error("입력을 확인하세요");
      submitted.current = false;
    } else if (state) {
      // 성공 (error/fieldErrors 없음)
      toast.success(
        state.analyzedKeys
          ? `업로드 완료 — AI가 ${state.analyzedKeys}개 항목 정리`
          : "업로드 완료"
      );
      // 진입한 대학 상세로 복귀(대학에서 들어온 경우), 아니면 입학서류 목록
      router.push(uniId ? `/universities/${uniId}` : "/admissions?tab=forms");
    }
  }, [state, router]);

  async function submit() {
    if (!uniId) return toast.error("대학을 선택하세요");
    if (!file) return toast.error("파일을 선택하세요");

    const dataUrl = await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = () => rej(r.error);
      r.readAsDataURL(file);
    });
    const comma = dataUrl.indexOf(",");
    const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;

    const fd = new FormData();
    fd.set("university_id", uniId);
    fd.set("key", key);
    fd.set("name_ko", nameKo.trim() || file.name.replace(/\.[^.]+$/, ""));
    fd.set("department_name", deptName);
    fd.set("file_base64", base64);
    fd.set("file_name", file.name);
    fd.set("file_size", String(file.size));
    fd.set("mime_type", file.type || "application/octet-stream");
    fd.set("auto_analyze", "on");
    submitted.current = true;
    startTransition(() => action(fd));
  }

  return (
    <Card className="max-w-2xl space-y-4 p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium">대학교 *</span>
          <select
            value={uniId}
            onChange={(e) => {
              setUniId(e.target.value);
              setDeptName("");
            }}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">— 선택 —</option>
            {universities.map((u) => (
              <option key={u.id} value={String(u.id)}>
                {u.name_ko}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium">양식 종류 *</span>
          <select
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            {Object.entries(KEY_LABELS).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium">적용 범위</span>
          <select
            value={deptName}
            onChange={(e) => setDeptName(e.target.value)}
            disabled={!uniId}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
          >
            <option value="">모든 학과</option>
            {deptOptions.map((d) => (
              <option key={d.id} value={d.name_ko}>
                {d.name_ko}
                {!d.active ? " (숨김)" : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium">서류명</span>
          <Input
            value={nameKo}
            onChange={(e) => setNameKo(e.target.value)}
            placeholder="비우면 파일명 사용"
          />
        </label>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium">양식 파일 *</span>
        <input
          ref={fileRef}
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-secondary/80"
        />
        {file ? (
          <span className="text-xs text-muted-foreground">{file.name}</span>
        ) : null}
      </div>

      <div className="flex justify-end">
        <Button type="button" onClick={submit} disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {pending ? "업로드·분석 중…" : "업로드"}
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        업로드 후 AI가 필요 표준데이터를 정리합니다(30~60초). 완료되면 목록에서 상세를 열어 편집·승인하세요.
      </p>
    </Card>
  );
}
