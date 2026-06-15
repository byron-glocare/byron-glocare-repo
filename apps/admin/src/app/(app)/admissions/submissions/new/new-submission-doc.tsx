"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  saveRequiredSubmissionAction,
  type SaveRequiredSubmissionState,
} from "@/app/(app)/admissions/[universityId]/submissions-actions";

type Uni = { id: number; name_ko: string };
type Master = { id: string; name_ko: string; std_key: string | null };
type DocType = { key: string; label_ko: string };

export function NewSubmissionDoc({
  universities,
  masters,
  docTypes,
  defaultUniId = "",
  defaultName = "",
}: {
  universities: Uni[];
  masters: Master[];
  docTypes: DocType[];
  defaultUniId?: string;
  defaultName?: string;
}) {
  const router = useRouter();
  const bound = saveRequiredSubmissionAction.bind(null, null);
  const [state, action, pending] = useActionState<
    SaveRequiredSubmissionState,
    FormData
  >(bound, undefined);

  const [scope, setScope] = useState<"shared" | "university">(
    defaultUniId ? "university" : "shared"
  );
  const [uniId, setUniId] = useState(defaultUniId);
  const [baseId, setBaseId] = useState("");
  const [nameKo, setNameKo] = useState(defaultName);
  const [stdKey, setStdKey] = useState("");
  const submitted = useRef(false);

  // 공용 마스터 기반 선택 시 이름·정본키 자동완성
  function pickBase(id: string) {
    setBaseId(id);
    const m = masters.find((x) => x.id === id);
    if (m && !nameKo.trim()) setNameKo(m.name_ko);
    if (m?.std_key && !stdKey) setStdKey(m.std_key);
  }

  useEffect(() => {
    if (!submitted.current) return;
    if (state?.error) {
      toast.error("생성 실패", { description: state.error });
      submitted.current = false;
    } else if (state?.fieldErrors) {
      toast.error("입력을 확인하세요");
      submitted.current = false;
    } else if (state) {
      toast.success("발급서류가 생성되었습니다.");
      router.push("/admissions?tab=submissions");
    }
  }, [state, router]);

  function submit() {
    if (!nameKo.trim()) return toast.error("서류명을 입력하세요");
    if (scope === "university" && !uniId)
      return toast.error("대학을 선택하세요");

    const fd = new FormData();
    fd.set("university_id", scope === "university" ? uniId : "");
    fd.set("department_id", "");
    fd.set("name_ko", nameKo.trim());
    fd.set("name_vi", "");
    fd.set("std_key", stdKey);
    fd.set("status", "draft");
    fd.set("is_active", "on");
    fd.set("sort_order", "0");
    fd.set("iss_issuer", "");
    fd.set("iss_validity_days", "");
    fd.set("iss_lead_time_days", "");
    fd.set("iss_notes", "");
    fd.set("required_data_type_keys", "[]");
    fd.set("aliases", "[]");
    fd.set("applies_to_languages", "[]");
    fd.set("applies_to_locations", "[]");
    if (scope === "university" && baseId) fd.set("base_submission_id", baseId);
    submitted.current = true;
    startTransition(() => action(fd));
  }

  return (
    <Card className="max-w-2xl space-y-4 p-6">
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium">유형</span>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={scope === "shared"}
              onChange={() => setScope("shared")}
            />
            공용 (전체 대학 공통)
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={scope === "university"}
              onChange={() => setScope("university")}
            />
            대학별
          </label>
        </div>
      </div>

      {scope === "university" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium">대학교 *</span>
            <select
              value={uniId}
              onChange={(e) => setUniId(e.target.value)}
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
            <span className="text-xs font-medium">공용 마스터 기반 (선택)</span>
            <select
              value={baseId}
              onChange={(e) => pickBase(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">— 없음 (직접 입력)</option>
              {masters.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name_ko}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium">서류명 *</span>
        <Input value={nameKo} onChange={(e) => setNameKo(e.target.value)} />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium">표준 발급서류 매핑 (정본 키)</span>
        <select
          value={stdKey}
          onChange={(e) => setStdKey(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">— 매핑 안 함 (나중에 설정)</option>
          {docTypes.map((d) => (
            <option key={d.key} value={d.key}>
              {d.label_ko}
            </option>
          ))}
        </select>
        <span className="text-[11px] text-muted-foreground">
          표준데이터 '발급 서류' 카탈로그와 1:1 연결 — 공용↔대학별 자동 매칭 기준
        </span>
      </label>

      <div className="flex justify-end">
        <Button type="button" onClick={submit} disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          생성
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        생성 후 상세에서 샘플 이미지·발급요건·표준데이터 매핑을 편집하세요.
      </p>
    </Card>
  );
}
