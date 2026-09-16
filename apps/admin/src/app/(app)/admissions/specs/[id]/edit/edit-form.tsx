"use client";

/**
 * 모집요강 편집 — 탭 껍데기 + 기본 탭 폼.
 *   기본: 전형 이름·상태·원본 파일·온라인 접수·공통 자격·기타·작성서류/미연결 옛 줄 (통째 저장 = updateSpecAction)
 *   학과 / 학기: 서버 컴포넌트가 만들어 넘긴 패널 (각자 개별 저장)
 *   탭 패널은 keepMounted — 탭을 오가도 입력이 사라지지 않게.
 */

import { useActionState, useMemo, useState } from "react";
import { Check, Loader2 } from "lucide-react";

import { updateSpecAction, type UpdateSpecState } from "./update-action";
import { Card } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RequiredDocumentsField, type RequiredDocument } from "@/components/admission/required-documents-field";
import { EligibilityField, type Eligibility } from "@/components/admission/eligibility-field";
import { MetadataField, type Metadata } from "@/components/admission/metadata-field";

const STATUS_OPTIONS = [
  { value: "draft", label: "초안" },
  { value: "reviewing", label: "검수 중" },
  { value: "approved", label: "승인" },
  { value: "archived", label: "보관" },
] as const;

export type EditTab = "basic" | "departments" | "terms";

export type EditableSpec = {
  id: string;
  university_id: number;
  admission_category: string | null;
  status: string;
  source_file_url: string | null;
  is_online_submission: boolean;
  online_form_url: string | null;
  online_guide_url: string | null;
  eligibility: unknown;
  metadata: unknown;
};

export function EditSpecForm({
  spec,
  universityName,
  terms,
  docTypes = [],
  legacyDocs,
  initialTab = "basic",
  departmentsPanel,
  termsPanel,
  counts,
}: {
  spec: EditableSpec;
  universityName: string;
  terms: string[];
  docTypes?: Array<{ key: string; label_ko: string; label_vi?: string | null; aliases?: string[] | null; is_form_doc?: boolean | null }>;
  /** 옛 JSONB 중 작성서류·미연결 줄만 */
  legacyDocs: RequiredDocument[];
  initialTab?: EditTab;
  departmentsPanel: React.ReactNode;
  termsPanel: React.ReactNode;
  counts: { departments: number; terms: number };
}) {
  const bound = updateSpecAction.bind(null, spec.id);
  const [state, action, pending] = useActionState<UpdateSpecState, FormData>(bound, undefined);

  const [isOnline, setIsOnline] = useState(spec.is_online_submission);
  const [guide, setGuide] = useState<{ base64: string; name: string; type: string } | null>(null);
  const [guideReading, setGuideReading] = useState(false);

  async function onPickGuide(file: File) {
    setGuideReading(true);
    try {
      const dataUrl: string = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.onerror = () => rej(r.error);
        r.readAsDataURL(file);
      });
      const comma = dataUrl.indexOf(",");
      setGuide({ base64: comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl, name: file.name, type: file.type || "application/octet-stream" });
    } finally {
      setGuideReading(false);
    }
  }

  const initialEligibility = useMemo(
    () => (spec.eligibility && typeof spec.eligibility === "object" && Object.keys(spec.eligibility as object).length ? (spec.eligibility as Eligibility) : null),
    [spec.eligibility]
  );
  const initialMetadata = useMemo(() => (spec.metadata && typeof spec.metadata === "object" ? (spec.metadata as Metadata) : null), [spec.metadata]);

  const fieldErr = (k: string) => state?.fieldErrors?.[k];

  return (
    <Tabs defaultValue={initialTab}>
      <TabsList>
        <TabsTrigger value="basic">기본</TabsTrigger>
        <TabsTrigger value="departments">학과 ({counts.departments})</TabsTrigger>
        <TabsTrigger value="terms">학기 ({counts.terms})</TabsTrigger>
      </TabsList>

      <TabsContent value="basic" keepMounted className="mt-3">
        <Card className="p-6">
          <form
            action={(fd: FormData) => {
              if (isOnline && guide) {
                fd.set("guide_base64", guide.base64);
                fd.set("guide_name", guide.name);
                fd.set("guide_type", guide.type);
              }
              action(fd);
            }}
            className="space-y-5"
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="대학교" name="university">
                <div className="rounded-md border border-input bg-muted/40 px-3 py-2 text-sm">{universityName}</div>
              </Field>
              <Field label="학기 (학기 탭에서 관리)" name="terms">
                <div className="rounded-md border border-input bg-muted/40 px-3 py-2 text-sm">{terms.length ? terms.join(" · ") : "—"}</div>
              </Field>
              <Field label="전형 이름 (표시용)" name="admission_category" error={fieldErr("admission_category")}>
                <input
                  type="text"
                  name="admission_category"
                  defaultValue={spec.admission_category ?? ""}
                  maxLength={200}
                  placeholder="예: 외국인 특별전형"
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </Field>
              <Field label="상태" name="status" error={fieldErr("status")}>
                <select name="status" required defaultValue={spec.status} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="원본 파일 경로" name="source_file_url" error={fieldErr("source_file_url")} full>
                <input
                  type="text"
                  name="source_file_url"
                  defaultValue={spec.source_file_url ?? ""}
                  maxLength={500}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </Field>
            </div>

            {/* 온라인 접수 */}
            <div className="rounded-md border border-sky-200 bg-sky-50/60 p-4">
              <label className="flex items-start gap-2">
                <input type="checkbox" name="is_online_submission" className="mt-0.5" checked={isOnline} onChange={(e) => setIsOnline(e.target.checked)} />
                <span className="text-sm">
                  <strong>온라인 접수 대학</strong> — 학생 화면에서 양식 작성 대신 가이드 문서 + 제출서류만 안내됩니다.
                </span>
              </label>
              {isOnline ? (
                <div className="mt-3 grid grid-cols-1 gap-3 border-t border-sky-200 pt-3 md:grid-cols-2">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium">온라인 접수 폼 주소</span>
                    <input
                      type="url"
                      name="online_form_url"
                      defaultValue={spec.online_form_url ?? ""}
                      placeholder="https://..."
                      className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium">원서접수 가이드 문서</span>
                    {spec.online_guide_url ? (
                      <a href={spec.online_guide_url} target="_blank" rel="noreferrer" className="text-xs text-sky-700 underline">
                        현재 가이드 열기 ↗
                      </a>
                    ) : null}
                    <input
                      type="file"
                      accept=".pdf,.hwp,.hwpx,.docx,image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) onPickGuide(f);
                      }}
                      className="text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-secondary file:px-3 file:py-1.5 file:text-sm"
                    />
                    <span className="text-xs text-muted-foreground">
                      {guideReading ? "파일 읽는 중..." : guide ? `새 파일: ${guide.name} (저장 시 교체)` : "새 파일을 올리면 교체됩니다. 비워두면 기존 유지."}
                    </span>
                  </label>
                </div>
              ) : null}
            </div>

            <Section title="지원 자격 (요강 공통)" open error={fieldErr("spec_eligibility")}>
              <p className="mb-2 text-xs text-muted-foreground">학과별로 다른 자격은 학과 탭에서 따로 둘 수 있습니다. 여기는 요강 공통입니다.</p>
              <EligibilityField name="spec_eligibility" initial={initialEligibility} />
            </Section>

            <Section title={`작성서류·미연결 (옛 서류 줄 ${legacyDocs.length})`} error={fieldErr("spec_required_documents")}>
              <p className="mb-2 text-xs text-muted-foreground">
                작성서류(학교 양식)와 아직 표준에 연결되지 않은 서류입니다. 발급서류 항목은 학과 탭에서 학과마다 고릅니다. 미연결 서류에 서류 종류를 고르면
                저장할 때 모든 학과의 발급서류 항목에 추가됩니다.
              </p>
              <RequiredDocumentsField name="spec_required_documents" initial={legacyDocs} docTypes={docTypes} />
            </Section>

            <Section title="기타 정보 (선발·연락처·정부지정 등)" error={fieldErr("spec_metadata")}>
              <MetadataField name="spec_metadata" initial={initialMetadata} />
            </Section>

            {state?.error ? <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</div> : null}

            <div className="flex items-center gap-2 border-t border-border pt-4">
              <Button type="submit" disabled={pending}>
                {pending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    저장 중...
                  </>
                ) : (
                  <>
                    <Check className="size-4" />
                    기본 저장
                  </>
                )}
              </Button>
              <a href={`/admissions/specs/${spec.id}`} className={buttonVariants({ variant: "outline" })}>
                상세로
              </a>
            </div>
          </form>
        </Card>
      </TabsContent>

      <TabsContent value="departments" keepMounted className="mt-3">
        {departmentsPanel}
      </TabsContent>

      <TabsContent value="terms" keepMounted className="mt-3">
        {termsPanel}
      </TabsContent>
    </Tabs>
  );
}

function Section({ title, open, error, children }: { title: string; open?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <details open={open} className="rounded-md border border-input bg-muted/30">
      <summary className="cursor-pointer px-4 py-2 text-sm font-medium hover:bg-muted/50">{title}</summary>
      <div className="border-t border-input p-3">
        {children}
        {error ? <div className="mt-2 text-xs text-destructive">{error}</div> : null}
      </div>
    </details>
  );
}

function Field({ label, name, error, full, children }: { label: string; name: string; error?: string; full?: boolean; children: React.ReactNode }) {
  return (
    <label className={`flex flex-col gap-1.5 ${full ? "md:col-span-2" : ""}`}>
      <span className="text-sm font-medium" data-name={name}>
        {label}
      </span>
      {children}
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </label>
  );
}
