"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  Eye,
  Loader2,
  Search,
  Send,
} from "lucide-react";

import { sendNewStudentSms } from "@/app/(app)/sms/actions";
import { setClassIntakeSmsSent } from "@/app/(app)/customers/actions";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  buildNewStudentMessage,
  type NewStudentTemplateStudent,
} from "@/lib/sms-templates";
import { formatDate } from "@/lib/format";

type Center = {
  id: string;
  name: string;
  region: string | null;
  director_name: string | null;
  phone: string | null;
};

type Customer = {
  id: string;
  code: string;
  name_kr: string | null;
  name_vi: string | null;
  phone: string | null;
  visa_type: string | null;
  birth_year: number | null;
  topik_level: string | null;
  training_center_id: string | null;
  training_class_id: string | null;
  class_start_date: string | null;
};

type TrainingClass = {
  id: string;
  training_center_id: string;
  year: number;
  month: number;
  class_type: "weekday" | "night";
  start_date: string | null;
};

type Props = {
  centers: Center[];
  customers: Customer[];
  classes: TrainingClass[];
  /**
   * "이미 보냄" 판정 — 진행 단계 '강의 접수 메시지 발송' 플래그
   * (class_intake_sms_sent) 가 ON 인 학생 ID. 교육원 변경 시 이 플래그가
   * 자동 리셋되므로 새 교육원에서는 다시 발송 대상이 된다.
   */
  sentCustomerIds: string[];
  /**
   * default 체크 대상 — 현재 단계가 '강의 접수 메시지 발송 대기' 인 학생 ID.
   * (0022 — 기존엔 모든 pending 학생 체크 / 이제는 발송 대기 학생만)
   */
  readyToSendIds: string[];
  /** 학생별 예약금 합계 (reservation_payments.amount 합) — 메시지의 "예약금(시험비)" 항목용 */
  reservationAmountByCustomer: Record<string, number>;
};

export function SmsNewStudentView({
  centers,
  customers,
  classes,
  sentCustomerIds,
  readyToSendIds,
  reservationAmountByCustomer,
}: Props) {
  const router = useRouter();
  const sentSet = useMemo(() => new Set(sentCustomerIds), [sentCustomerIds]);
  const readySet = useMemo(
    () => new Set(readyToSendIds),
    [readyToSendIds]
  );
  const classMap = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);

  const [q, setQ] = useState("");

  // 교육원별로 그룹핑 (미발송 고객 위주로 표시)
  const groups = useMemo(() => {
    const byCenter = new Map<string, Customer[]>();
    for (const c of customers) {
      if (!c.training_center_id) continue;
      const existing = byCenter.get(c.training_center_id);
      if (existing) existing.push(c);
      else byCenter.set(c.training_center_id, [c]);
    }

    return centers
      .map((center) => {
        const all = byCenter.get(center.id) ?? [];
        const pending = all.filter((c) => !sentSet.has(c.id));
        return { center, all, pending };
      })
      .filter((g) => g.all.length > 0)
      .sort((a, b) => b.pending.length - a.pending.length);
  }, [centers, customers, sentSet]);

  const filteredGroups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return groups;
    return groups.filter((g) => {
      const hay = [g.center.name, g.center.region, g.center.director_name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [groups, q]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-60 max-w-md">
          <label className="text-xs text-muted-foreground block mb-1">
            교육원 검색 (이름 · 지역 · 원장)
          </label>
          <div className="relative">
            <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="검색..."
              className="pl-8"
            />
          </div>
        </div>
        <div className="text-xs text-muted-foreground pb-2">
          {filteredGroups.length} / {groups.length} 교육원
        </div>
      </div>

      {filteredGroups.length === 0 ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">
          {q.trim()
            ? "조건에 맞는 교육원이 없습니다."
            : "매칭된 교육생이 있는 교육원이 없습니다."}
        </Card>
      ) : (
        filteredGroups.map(({ center, all, pending }) => (
          <CenterGroupCard
            key={center.id}
            center={center}
            allStudents={all}
            pendingStudents={pending}
            classMap={classMap}
            sentSet={sentSet}
            readySet={readySet}
            reservationAmountByCustomer={reservationAmountByCustomer}
            onSent={() => router.refresh()}
          />
        ))
      )}
    </div>
  );
}

function CenterGroupCard({
  center,
  allStudents,
  pendingStudents,
  classMap,
  sentSet,
  readySet,
  reservationAmountByCustomer,
  onSent,
}: {
  center: Center;
  allStudents: Customer[];
  pendingStudents: Customer[];
  classMap: Map<string, TrainingClass>;
  sentSet: Set<string>;
  readySet: Set<string>;
  reservationAmountByCustomer: Record<string, number>;
  onSent: () => void;
}) {
  // default collapsed — 정산 예정 카드와 동일한 UX
  const [expanded, setExpanded] = useState(false);
  // 0022: default 체크 = 현재 단계가 '강의 접수 메시지 발송 대기' 인 학생만
  const [selectedIds, setSelectedIds] = useState<string[]>(
    pendingStudents.filter((p) => readySet.has(p.id)).map((p) => p.id)
  );
  // 학생별 특이사항 — 학생 id → 텍스트
  const [studentNotes, setStudentNotes] = useState<Record<string, string>>({});
  const [previewOpen, setPreviewOpen] = useState(false);
  // 미리보기에서 운영자가 직접 본문을 수정할 수 있도록 — 열때마다 템플릿으로 reset
  const [editedBody, setEditedBody] = useState<string>("");
  // 수신자 전화번호 — 기본값은 교육원 전화번호, 다이얼로그 열때마다 reset
  const [editedPhone, setEditedPhone] = useState<string>(center.phone ?? "");
  const [pending, startTransition] = useTransition();
  // 발송 후 "강의 접수 메시지 발송 플래그 ON 으로 변경할까요?" 확인 다이얼로그
  const [sentPromptIds, setSentPromptIds] = useState<string[] | null>(null);
  const [flagPending, startFlagTransition] = useTransition();

  const selectedStudents = pendingStudents.filter((p) =>
    selectedIds.includes(p.id)
  );

  // 대표 class 정보 (가장 많이 등장하는 class_id) — 학생의 class 가 비어있을 때 fallback
  const fallbackClass = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of selectedStudents) {
      if (s.training_class_id) {
        counts.set(
          s.training_class_id,
          (counts.get(s.training_class_id) ?? 0) + 1
        );
      }
    }
    let top: TrainingClass | null = null;
    let max = 0;
    for (const [id, c] of counts) {
      if (c > max) {
        const cls = classMap.get(id);
        if (cls) {
          top = cls;
          max = c;
        }
      }
    }
    return top;
  }, [selectedStudents, classMap]);

  function resolveClassForStudent(s: Customer): {
    classStartDate: string | null;
    classType: "weekday" | "night" | null;
  } {
    const cls = s.training_class_id ? classMap.get(s.training_class_id) : null;
    if (cls) {
      return {
        classStartDate: cls.start_date ?? s.class_start_date ?? null,
        classType: cls.class_type,
      };
    }
    return {
      classStartDate: s.class_start_date ?? fallbackClass?.start_date ?? null,
      classType: fallbackClass?.class_type ?? null,
    };
  }

  function studentToTemplate(s: Customer): NewStudentTemplateStudent {
    const cls = resolveClassForStudent(s);
    return {
      name_kr: s.name_kr,
      name_vi: s.name_vi,
      phone: s.phone,
      visa_type: s.visa_type,
      birth_year: s.birth_year,
      topik_level: s.topik_level,
      reservationAmount: reservationAmountByCustomer[s.id] ?? null,
      classStartDate: cls.classStartDate,
      classType: cls.classType,
      extraNote: studentNotes[s.id] ?? "",
    };
  }

  // 제목 월 — 가장 빠른 학생 class 의 월
  const monthLabel = useMemo(() => {
    const dates = selectedStudents
      .map((s) => resolveClassForStudent(s).classStartDate)
      .filter((d): d is string => !!d);
    if (dates.length === 0) return null;
    const earliest = dates.slice().sort()[0];
    const m = /^\d{4}-(\d{2})-\d{2}$/.exec(earliest);
    return m ? Number(m[1]) : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStudents, fallbackClass]);

  const generatedMessage = useMemo(() => {
    return buildNewStudentMessage({
      centerName: center.name,
      monthLabel,
      students: selectedStudents.map(studentToTemplate),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.name, monthLabel, selectedStudents, studentNotes, reservationAmountByCustomer]);

  // 미리보기 다이얼로그가 열릴 때 — 최신 템플릿으로 editedBody / editedPhone reset
  useEffect(() => {
    if (previewOpen) {
      setEditedBody(generatedMessage);
      setEditedPhone(center.phone ?? "");
    }
  }, [previewOpen, generatedMessage, center.phone]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function setStudentNote(id: string, value: string) {
    setStudentNotes((prev) => ({ ...prev, [id]: value }));
  }

  function handleSendPreview() {
    if (selectedStudents.length === 0) {
      toast.error("발송할 교육생을 선택하세요.");
      return;
    }
    if (!editedBody.trim()) {
      toast.error("본문이 비어있습니다.");
      return;
    }
    const phone = editedPhone.trim();
    if (!phone) {
      toast.error("수신 전화번호가 비어있습니다.");
      return;
    }

    startTransition(async () => {
      const ids = selectedStudents.map((s) => s.id);
      const result = await sendNewStudentSms({
        centerId: center.id,
        customerIds: ids,
        bodyOverride: editedBody,
        phoneOverride: phone,
      });
      if (result.ok) {
        if ("warning" in result && result.warning) {
          toast.warning(result.warning);
        } else {
          toast.success(
            `${center.name} 원장님께 ${selectedStudents.length}명 정보 발송 완료`
          );
        }
        setPreviewOpen(false);
        // 진행 단계의 "강의 접수 메시지 발송" 플래그를 자동 ON 할지 물어봄
        setSentPromptIds(ids);
      } else {
        toast.error("발송 실패", { description: result.error });
      }
    });
  }

  function handleConfirmFlag(value: boolean) {
    if (!sentPromptIds || sentPromptIds.length === 0) {
      setSentPromptIds(null);
      onSent();
      return;
    }
    if (!value) {
      // 사용자가 "아니오" — 플래그 변경 안 함
      setSentPromptIds(null);
      onSent();
      return;
    }
    startFlagTransition(async () => {
      const result = await setClassIntakeSmsSent(sentPromptIds, true);
      if (result.ok) {
        toast.success(
          `${result.data.updated}명의 '강의 접수 메시지 발송' 플래그 ON`
        );
      } else {
        toast.error("플래그 변경 실패", { description: result.error });
      }
      setSentPromptIds(null);
      onSent();
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-start gap-2 min-w-0 text-left hover:text-primary"
          aria-expanded={expanded}
        >
          <span className="shrink-0 mt-0.5">
            {expanded ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
          </span>
          <div className="min-w-0">
            <CardTitle className="text-base flex items-center gap-2 flex-wrap">
              {center.name}
              {center.region && (
                <Badge variant="outline">{center.region}</Badge>
              )}
            </CardTitle>
            <CardDescription>
              원장 {center.director_name ?? "—"} ·{" "}
              {center.phone ?? (
                <span className="text-destructive">전화번호 없음</span>
              )}{" "}
              · 전체 {allStudents.length}명 · 미발송{" "}
              <span className="text-warning font-medium">
                {pendingStudents.length}명
              </span>
            </CardDescription>
          </div>
        </button>
        <div className="flex gap-2 shrink-0">
          <Button
            type="button"
            size="sm"
            onClick={() => {
              if (!expanded) setExpanded(true);
              setPreviewOpen(true);
            }}
            disabled={selectedStudents.length === 0}
          >
            <Eye className="size-3" />
            미리보기 및 발송
          </Button>
        </div>
      </CardHeader>
      <CardContent className={expanded ? "space-y-4" : "hidden"}>
        {/* 학생 체크리스트 + 학생별 특이사항 */}
        {pendingStudents.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center border border-dashed border-border rounded-md">
            미발송 교육생이 없습니다. (이미 전체 발송 완료)
          </p>
        ) : (
          <div className="space-y-2">
            {pendingStudents.map((s) => {
              const checked = selectedIds.includes(s.id);
              return (
                <div
                  key={s.id}
                  className={`rounded-md border px-3 py-2 ${
                    checked ? "border-primary/40 bg-primary/5" : "border-border"
                  }`}
                >
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSelect(s.id)}
                      className="shrink-0"
                    />
                    <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-1">
                      <div className="text-sm font-medium truncate">
                        {s.name_kr || s.name_vi || "(이름 없음)"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {s.code}
                        {s.class_start_date && ` · ${formatDate(s.class_start_date)}`}
                        {s.topik_level && ` · 토픽 ${s.topik_level}`}
                        {reservationAmountByCustomer[s.id] != null &&
                          reservationAmountByCustomer[s.id] > 0 &&
                          ` · 예약금 ${reservationAmountByCustomer[s.id].toLocaleString("ko-KR")}원`}
                      </div>
                    </div>
                  </label>
                  {checked && (
                    <div className="mt-2 pl-6">
                      <label className="text-xs text-muted-foreground block mb-1">
                        특이사항 (학생별)
                      </label>
                      <Textarea
                        value={studentNotes[s.id] ?? ""}
                        onChange={(e) => setStudentNote(s.id, e.target.value)}
                        rows={2}
                        placeholder="예: 시험일정 변경 요청 / 출석 일정 조정 필요 등"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 이미 발송된 학생 (참고용) */}
        {allStudents.filter((s) => sentSet.has(s.id)).length > 0 && (
          <details className="group">
            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
              발송 완료 {allStudents.filter((s) => sentSet.has(s.id)).length}명 보기
            </summary>
            <div className="mt-2 flex flex-wrap gap-1">
              {allStudents
                .filter((s) => sentSet.has(s.id))
                .map((s) => (
                  <Badge key={s.id} variant="outline" className="text-xs text-muted-foreground">
                    {s.name_kr || s.name_vi || s.code}
                  </Badge>
                ))}
            </div>
          </details>
        )}
      </CardContent>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>메시지 미리보기 & 편집</DialogTitle>
            <DialogDescription>
              {center.name} 원장 — 수신 전화번호와 본문을 직접 수정한 뒤 발송할 수 있습니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {/* 수신자 전화번호 — 편집 가능 */}
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                수신 전화번호 (기본값: 교육원 대표 연락처
                {center.phone ? ` ${center.phone}` : " 없음"})
              </label>
              <input
                type="tel"
                value={editedPhone}
                onChange={(e) => setEditedPhone(e.target.value)}
                placeholder="010-0000-0000"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {center.phone && editedPhone.replace(/[^0-9]/g, "") !==
                center.phone.replace(/[^0-9]/g, "") && (
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-[11px] text-warning">
                    교육원에 등록된 번호와 다릅니다.
                  </span>
                  <button
                    type="button"
                    className="text-[11px] text-muted-foreground underline hover:text-foreground"
                    onClick={() => setEditedPhone(center.phone ?? "")}
                  >
                    원장님 번호로 되돌리기
                  </button>
                </div>
              )}
            </div>

            {/* 본문 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">
                  {selectedStudents.length}명 · 본문 {new TextEncoder().encode(editedBody).length} bytes / 2000
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditedBody(generatedMessage)}
                  disabled={pending}
                >
                  템플릿으로 되돌리기
                </Button>
              </div>
              <Textarea
                value={editedBody}
                onChange={(e) => setEditedBody(e.target.value)}
                rows={20}
                className="font-mono text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPreviewOpen(false)}>
              닫기
            </Button>
            <Button type="button" onClick={handleSendPreview} disabled={pending}>
              {pending ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />}
              이대로 발송
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 발송 후 진행 단계 플래그 ON 확인 */}
      <Dialog
        open={sentPromptIds !== null}
        onOpenChange={(v) => {
          if (!v) handleConfirmFlag(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>진행 단계 플래그 변경?</DialogTitle>
            <DialogDescription>
              발송한 {sentPromptIds?.length ?? 0}명의 진행 단계 탭에서{" "}
              <span className="font-medium text-foreground">
                강의 접수 메시지 발송
              </span>{" "}
              플래그를 ON 으로 변경할까요?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleConfirmFlag(false)}
              disabled={flagPending}
            >
              아니오
            </Button>
            <Button
              type="button"
              onClick={() => handleConfirmFlag(true)}
              disabled={flagPending}
            >
              {flagPending && <Loader2 className="size-3 animate-spin" />}
              예, 변경
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
