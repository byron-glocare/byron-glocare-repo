"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  saveRequiredSubmissionAction,
  type SaveRequiredSubmissionState,
} from "@/app/(app)/admissions/[universityId]/submissions-actions";

type Issuance = {
  issuer?: string;
  validity_days?: number;
  lead_time_days?: number;
  needs_notarization?: boolean;
  needs_translation?: boolean;
  notes?: string;
};

type Sub = {
  id: string;
  university_id: number | null;
  department_id: number | null;
  base_submission_id: string | null;
  name_ko: string;
  name_vi: string | null;
  target_person: string | null;
  target_person_note: string | null;
  sample_image_url: string | null;
  issuance_requirements: Issuance;
  required_data_type_keys: string[];
  aliases: string[];
  applies_to_languages: string[];
  applies_to_locations: string[];
  sort_order: number;
  is_active: boolean;
  status: string;
};

const TARGET_OPTIONS = [
  { v: "", label: "— 없음" },
  { v: "self", label: "본인" },
  { v: "father", label: "아버지" },
  { v: "mother", label: "어머니" },
  { v: "other", label: "기타" },
];
const STATUS_OPTIONS = [
  { v: "draft", label: "초안(미등록)" },
  { v: "approved", label: "승인(사용)" },
  { v: "archived", label: "보관(미사용)" },
];

export function SubmissionDocDetail({
  sub,
  isShared,
  universityName,
  departments,
  docTypes,
}: {
  sub: Sub;
  isShared: boolean;
  universityName: string | null;
  departments: Array<{ id: number; name_ko: string; active: boolean }>;
  docTypes: Array<{ key: string; label_ko: string }>;
}) {
  const bound = saveRequiredSubmissionAction.bind(null, sub.id);
  const [state, action, pending] = useActionState<
    SaveRequiredSubmissionState,
    FormData
  >(bound, undefined);

  const iss = sub.issuance_requirements ?? {};
  const [nameKo, setNameKo] = useState(sub.name_ko);
  const [nameVi, setNameVi] = useState(sub.name_vi ?? "");
  const [targetPerson, setTargetPerson] = useState(sub.target_person ?? "");
  const [targetNote, setTargetNote] = useState(sub.target_person_note ?? "");
  const [deptId, setDeptId] = useState<string>(
    sub.department_id != null ? String(sub.department_id) : ""
  );
  const [issuer, setIssuer] = useState(iss.issuer ?? "");
  const [validity, setValidity] = useState(
    iss.validity_days != null ? String(iss.validity_days) : ""
  );
  const [lead, setLead] = useState(
    iss.lead_time_days != null ? String(iss.lead_time_days) : ""
  );
  const [notarize, setNotarize] = useState(!!iss.needs_notarization);
  const [translate, setTranslate] = useState(!!iss.needs_translation);
  const [issNotes, setIssNotes] = useState(iss.notes ?? "");
  const [mappedKey, setMappedKey] = useState(sub.required_data_type_keys[0] ?? "");
  const [status, setStatus] = useState(sub.status);
  const [isActive, setIsActive] = useState(sub.is_active);

  // 샘플 이미지
  const fileRef = useRef<HTMLInputElement>(null);
  const sampleUrl = sub.sample_image_url;
  const [newSample, setNewSample] = useState<{
    base64: string;
    name: string;
    type: string;
    preview: string;
  } | null>(null);

  useEffect(() => {
    if (state?.success) toast.success("저장되었습니다.");
    else if (state?.error) toast.error("저장 실패", { description: state.error });
  }, [state]);

  async function pickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("이미지 파일만 가능합니다.");
      return;
    }
    const dataUrl = await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = () => rej(r.error);
      r.readAsDataURL(file);
    });
    const comma = dataUrl.indexOf(",");
    setNewSample({
      base64: comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl,
      name: file.name,
      type: file.type,
      preview: dataUrl,
    });
  }

  const previewSrc = newSample?.preview ?? sampleUrl;

  return (
    <form
      action={(fd) => {
        fd.set("university_id", sub.university_id != null ? String(sub.university_id) : "");
        fd.set("department_id", isShared ? "" : deptId);
        fd.set("name_ko", nameKo);
        fd.set("name_vi", nameVi);
        fd.set("target_person", targetPerson);
        fd.set("target_person_note", targetNote);
        fd.set("status", status);
        if (isActive) fd.set("is_active", "on");
        fd.set("sort_order", String(sub.sort_order));
        fd.set("iss_issuer", issuer);
        fd.set("iss_validity_days", validity);
        fd.set("iss_lead_time_days", lead);
        if (notarize) fd.set("iss_needs_notarization", "on");
        if (translate) fd.set("iss_needs_translation", "on");
        fd.set("iss_notes", issNotes);
        fd.set(
          "required_data_type_keys",
          JSON.stringify(mappedKey ? [mappedKey] : [])
        );
        // 이 화면에서 안 다루는 값은 보존
        fd.set("aliases", JSON.stringify(sub.aliases));
        fd.set("applies_to_languages", JSON.stringify(sub.applies_to_languages));
        fd.set("applies_to_locations", JSON.stringify(sub.applies_to_locations));
        if (sub.base_submission_id) fd.set("base_submission_id", sub.base_submission_id);
        if (newSample) {
          fd.set("sample_base64", newSample.base64);
          fd.set("sample_name", newSample.name);
          fd.set("sample_type", newSample.type);
        }
        action(fd);
      }}
      className="space-y-6"
    >
      <div className="flex items-center gap-2">
        <Badge variant={isShared ? "secondary" : "outline"}>
          {isShared ? "공용" : universityName ?? "대학별"}
        </Badge>
        {sub.base_submission_id ? (
          <span className="text-xs text-muted-foreground">공용 마스터 기반 (대학별 설정)</span>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 기본 + 발급요건 */}
        <Card className="p-6 space-y-4">
          <h2 className="text-base font-semibold">상세 정보</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium">서류명 (한)</span>
              <Input value={nameKo} onChange={(e) => setNameKo(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium">서류명 (베)</span>
              <Input value={nameVi} onChange={(e) => setNameVi(e.target.value)} />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium">대상자</span>
              <select
                value={targetPerson}
                onChange={(e) => setTargetPerson(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {TARGET_OPTIONS.map((o) => (
                  <option key={o.v} value={o.v}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            {targetPerson === "other" ? (
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium">대상자 메모</span>
                <Input value={targetNote} onChange={(e) => setTargetNote(e.target.value)} />
              </label>
            ) : null}
          </div>

          {!isShared ? (
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium">적용 학과</span>
              <select
                value={deptId}
                onChange={(e) => setDeptId(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">전체 학과</option>
                {departments.map((d) => (
                  <option key={d.id} value={String(d.id)}>
                    {d.name_ko}
                    {!d.active ? " (숨김)" : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium">발급처</span>
              <Input value={issuer} onChange={(e) => setIssuer(e.target.value)} placeholder="예: 구청" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium">유효기간(일)</span>
              <Input type="number" value={validity} onChange={(e) => setValidity(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium">발급 소요(일)</span>
              <Input type="number" value={lead} onChange={(e) => setLead(e.target.value)} />
            </label>
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={notarize} onChange={(e) => setNotarize(e.target.checked)} className="size-4" />
              공증 필요
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={translate} onChange={(e) => setTranslate(e.target.checked)} className="size-4" />
              번역 필요
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium">비고</span>
            <textarea
              value={issNotes}
              onChange={(e) => setIssNotes(e.target.value)}
              rows={2}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium">
              표준데이터 매핑 (발급 서류 1:1)
            </span>
            <select
              value={mappedKey}
              onChange={(e) => setMappedKey(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">— 매핑 안 함</option>
              {docTypes.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.label_ko}
                </option>
              ))}
            </select>
            <span className="text-[11px] text-muted-foreground">
              학생이 업로드할 표준데이터 '발급 서류' 항목과 연결
            </span>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium">상태</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.v} value={o.v}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm pt-6">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="size-4" />
              활성(노출)
            </label>
          </div>
        </Card>

        {/* 샘플 이미지 */}
        <Card className="p-6 space-y-3">
          <h2 className="text-base font-semibold">샘플 이미지</h2>
          {previewSrc ? (
            <div className="space-y-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewSrc}
                alt="샘플"
                className="max-h-80 w-full rounded-md border object-contain"
              />
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <ImagePlus className="size-4" />
                변경
              </Button>
            </div>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <ImagePlus className="size-4" />
              샘플 이미지 업로드
            </Button>
          )}
          <input ref={fileRef} type="file" accept="image/*" onChange={pickImage} className="hidden" />
        </Card>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          저장
        </Button>
      </div>
    </form>
  );
}
