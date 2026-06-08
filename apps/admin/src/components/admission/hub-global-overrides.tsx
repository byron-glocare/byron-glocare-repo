"use client";

import { useState } from "react";
import { ChevronDown, ImageIcon, Pencil, Plus } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  SubmissionForm,
  type SubmissionRow,
  type DataTypeOption,
  type DepartmentOption,
} from "./required-submissions-manager";

const TARGET_PERSON_LABEL: Record<string, string> = {
  self: "학생 본인",
  father: "아버지",
  mother: "어머니",
  other: "기타",
};

/**
 * 대학 허브의 "공용 제출서류 (전체 공통)" 표시 + 대학별 세부요건(오버라이드).
 *   - 공용 마스터는 모든 대학에 기본 적용 (읽기 전용 참고).
 *   - 각 마스터마다 이 대학 전용 세부요건을 추가/편집 → base_submission_id 로 연결된
 *     오버라이드 행 생성·수정.
 */
export function HubGlobalOverrides({
  universityId,
  departments,
  dataTypes,
  masters,
  overridesByBase,
}: {
  universityId: number;
  departments: DepartmentOption[];
  dataTypes: DataTypeOption[];
  /** 공용 마스터 (university_id NULL) */
  masters: SubmissionRow[];
  /** base_submission_id → 이 대학의 오버라이드 행 */
  overridesByBase: Record<string, SubmissionRow>;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (masters.length === 0) {
    return (
      <Card className="p-4 text-sm text-muted-foreground">
        등록된 공용 제출서류가 없습니다. 입학서류 홈의 “공용 제출서류”에서
        추가하세요.
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b px-4 py-2.5 text-xs text-muted-foreground">
        공용 서류는 모든 대학에 기본 적용됩니다. 이 대학만의 발급 세부요건이 있으면
        “세부요건” 으로 덮어쓰세요.
      </div>
      <div className="divide-y divide-border">
        {masters.map((m) => {
          const iss = m.issuance_requirements ?? {};
          const ov = overridesByBase[m.id];
          const isOpen = openId === m.id;
          return (
            <div key={m.id}>
              <div className="flex items-start gap-3 px-4 py-3">
                {m.sample_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <a
                    href={m.sample_image_url}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0"
                  >
                    <img
                      src={m.sample_image_url}
                      alt={m.name_ko}
                      className="size-12 rounded border object-cover"
                    />
                  </a>
                ) : (
                  <div className="flex size-12 shrink-0 items-center justify-center rounded border border-dashed text-muted-foreground">
                    <ImageIcon className="size-4" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium">{m.name_ko}</span>
                    <Badge variant="outline" className="text-[10px]">
                      전체 공통
                    </Badge>
                    {m.target_person ? (
                      <Badge variant="secondary" className="text-[10px]">
                        대상:{" "}
                        {m.target_person === "other"
                          ? m.target_person_note || "기타"
                          : TARGET_PERSON_LABEL[m.target_person] ??
                            m.target_person}
                      </Badge>
                    ) : null}
                    {ov ? (
                      <Badge className="border-amber-200 bg-amber-50 text-amber-800 text-[10px]">
                        이 대학 세부요건 있음
                      </Badge>
                    ) : null}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                    {iss.issuer ? <span>발급처: {iss.issuer}</span> : null}
                    {iss.lead_time_days != null ? (
                      <span>리드타임: {iss.lead_time_days}일</span>
                    ) : null}
                    {iss.needs_notarization ? <span>공증</span> : null}
                    {iss.needs_translation ? <span>번역</span> : null}
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => setOpenId((c) => (c === m.id ? null : m.id))}
                >
                  {ov ? (
                    <>
                      <Pencil className="size-3" />
                      세부요건
                    </>
                  ) : (
                    <>
                      <Plus className="size-3" />
                      이 대학 세부요건
                    </>
                  )}
                  <ChevronDown
                    className={`size-3 transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                </Button>
              </div>

              {isOpen ? (
                <div className="border-t bg-muted/20 p-4">
                  <p className="mb-3 text-xs text-muted-foreground">
                    “{m.name_ko}” 의 <strong>{`이 대학(#${universityId}) 전용`}</strong>{" "}
                    세부요건입니다. 발급처·리드타임·공증/번역 등 대학마다 다른 부분을
                    채우세요. (공용 마스터는 그대로 유지됩니다.)
                  </p>
                  <SubmissionForm
                    universityId={universityId}
                    baseSubmissionId={m.id}
                    departments={departments}
                    dataTypes={dataTypes}
                    submission={
                      ov ??
                      // 신규 오버라이드는 마스터 이름/대상자를 초기값으로
                      ({
                        ...m,
                        id: "",
                        base_submission_id: m.id,
                        sample_image_url: null,
                      } as SubmissionRow)
                    }
                    onDone={() => setOpenId(null)}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
