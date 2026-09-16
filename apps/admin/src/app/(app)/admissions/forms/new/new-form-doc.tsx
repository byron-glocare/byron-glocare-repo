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

const KIND_LABEL: Record<"language" | "regular", string> = { language: "어학당", regular: "일반학과" };

type Uni = { id: number; name_ko: string };
export type SpecDeptOption = {
  id: string;
  university_id: number;
  name_ko: string;
  kind: "language" | "regular";
  is_active: boolean;
  sort_order: number;
};

export function NewFormDoc({
  universities,
  specDepartments,
  preUniversityId,
  preSpecDepartmentId = "",
  preKey = "",
  preName = "",
}: {
  universities: Uni[];
  /** 요강 학과 (어학당 먼저) — 양식은 여기에 속한다 */
  specDepartments: SpecDeptOption[];
  preUniversityId: string;
  /** 모집요강 편집에서 넘어온 요강 학과 */
  preSpecDepartmentId?: string;
  /** 모집요강에서 넘어온 서류 종류 — 이 값이 곧 양식과 서류의 연결 고리다. */
  preKey?: string;
  preName?: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<UploadFormFileState, FormData>(
    uploadFormFileAction,
    undefined
  );

  // 요강 학과만 넘어왔으면 그 대학으로
  const preDept = specDepartments.find((d) => d.id === preSpecDepartmentId);
  const [uniId, setUniId] = useState(preUniversityId || (preDept ? String(preDept.university_id) : ""));
  // 기본값을 두지 않는다. 예전엔 '입학 지원서'가 미리 선택돼 있어서, 자기소개서
  // 양식을 올려도 입학 지원서로 저장되고(→ 해당 서류는 계속 미등록) 기존 입학
  // 지원서 양식까지 구버전으로 밀려났다.
  const [key, setKey] = useState(
    preKey && preKey in KEY_LABELS ? preKey : preKey ? "other" : ""
  );
  const [specDeptId, setSpecDeptId] = useState(preDept ? preDept.id : "");
  const [nameKo, setNameKo] = useState(preName);
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const submitted = useRef(false);

  const deptOptions = specDepartments.filter((d) => String(d.university_id) === uniId);
  const hasSpec = deptOptions.length > 0;

  useEffect(() => {
    if (!submitted.current) return;
    if (state?.error) {
      toast.error("업로드 실패", { description: state.error });
      submitted.current = false;
    } else if (state?.fieldErrors) {
      toast.error("입력을 확인하세요", {
        description: Object.values(state.fieldErrors).join(" / "),
      });
      submitted.current = false;
    } else if (state) {
      // 성공 (error/fieldErrors 없음)
      toast.success(
        state.analyzedKeys
          ? `업로드 완료 — AI가 ${state.analyzedKeys}개 항목 정리`
          : "업로드 완료"
      );
      if (state.warning) toast.warning(state.warning);
      // 진입한 대학 상세로 복귀(대학에서 들어온 경우), 아니면 입학서류 목록
      router.push(uniId ? `/universities/${uniId}` : "/admissions?tab=forms");
    }
  }, [state, router, uniId]);

  async function submit() {
    if (!uniId) return toast.error("대학을 선택하세요");
    if (hasSpec && !specDeptId) return toast.error("요강 학과를 선택하세요");
    if (!key) return toast.error("양식 종류를 선택하세요");
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
    fd.set("spec_department_id", specDeptId);
    fd.set("department_name", "");
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
              setSpecDeptId("");
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
          <span className="text-xs font-medium">요강 학과 *</span>
          <select
            value={specDeptId}
            onChange={(e) => setSpecDeptId(e.target.value)}
            disabled={!uniId || !hasSpec}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
          >
            <option value="">{!uniId ? "먼저 대학을 선택하세요" : hasSpec ? "— 선택 —" : "요강 학과 없음"}</option>
            {deptOptions.map((d) => (
              <option key={d.id} value={d.id}>
                [{KIND_LABEL[d.kind]}] {d.name_ko}
                {!d.is_active ? " (비활성)" : ""}
              </option>
            ))}
          </select>
          <span className="text-[11px] text-muted-foreground">
            {uniId && !hasSpec
              ? "이 대학은 모집요강(학과)이 없어 학과 없이 올라갑니다. 기존 양식은 내리지 않습니다."
              : "같은 학과·같은 종류의 기존 양식만 이전 버전으로 내려갑니다."}
          </span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium">양식 종류 *</span>
          <select
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">선택하세요</option>
            {Object.entries(KEY_LABELS).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
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
