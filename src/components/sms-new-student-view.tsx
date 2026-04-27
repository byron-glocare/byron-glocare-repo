"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, Loader2, Send } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { buildNewStudentMessage } from "@/lib/sms-templates";
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
  sentCustomerIds: string[];
};

const NOTE_STORAGE_KEY = "glocare:sms:new-student:note";

export function SmsNewStudentView({
  centers,
  customers,
  classes,
  sentCustomerIds,
}: Props) {
  const router = useRouter();
  const sentSet = useMemo(() => new Set(sentCustomerIds), [sentCustomerIds]);
  const classMap = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);

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

  return (
    <div className="space-y-6">
      {groups.length === 0 ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">
          매칭된 교육생이 있는 교육원이 없습니다.
        </Card>
      ) : (
        groups.map(({ center, all, pending }) => (
          <CenterGroupCard
            key={center.id}
            center={center}
            allStudents={all}
            pendingStudents={pending}
            classMap={classMap}
            sentSet={sentSet}
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
  onSent,
}: {
  center: Center;
  allStudents: Customer[];
  pendingStudents: Customer[];
  classMap: Map<string, TrainingClass>;
  sentSet: Set<string>;
  onSent: () => void;
}) {
  // 마지막 입력값 자동 완성
  const [note, setNote] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(NOTE_STORAGE_KEY) ?? "";
  });
  const [selectedIds, setSelectedIds] = useState<string[]>(
    pendingStudents.map((p) => p.id)
  );
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  // 발송 후 "강의 접수 메시지 발송 플래그 ON 으로 변경할까요?" 확인 다이얼로그
  const [sentPromptIds, setSentPromptIds] = useState<string[] | null>(null);
  const [flagPending, startFlagTransition] = useTransition();

  const selectedStudents = pendingStudents.filter((p) =>
    selectedIds.includes(p.id)
  );

  // 강의 정보 추론 — 선택된 학생들의 class_id 중 가장 많이 등장하는 것
  const classInfo = useMemo(() => {
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

  const message = buildNewStudentMessage({
    centerName: center.name,
    classStartDate: classInfo?.start_date ?? selectedStudents[0]?.class_start_date ?? null,
    classType: classInfo?.class_type ?? null,
    students: selectedStudents.map((s) => ({
      name_kr: s.name_kr,
      name_vi: s.name_vi,
      phone: s.phone,
      visa_type: s.visa_type,
      birth_year: s.birth_year,
    })),
    extraNote: note,
  });

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function handleSend() {
    if (selectedStudents.length === 0) {
      toast.error("발송할 교육생을 선택하세요.");
      return;
    }
    if (typeof window !== "undefined") {
      window.localStorage.setItem(NOTE_STORAGE_KEY, note);
    }

    startTransition(async () => {
      const ids = selectedStudents.map((s) => s.id);
      const result = await sendNewStudentSms({
        centerId: center.id,
        customerIds: ids,
        extraNote: note,
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
            <span className="text-warning font-medium">{pendingStudents.length}명</span>
          </CardDescription>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPreviewOpen(true)}
            disabled={selectedStudents.length === 0}
          >
            <Eye className="size-3" />
            미리보기
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSend}
            disabled={pending || selectedStudents.length === 0}
          >
            {pending ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Send className="size-3" />
            )}
            발송
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 학생 체크리스트 */}
        {pendingStudents.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center border border-dashed border-border rounded-md">
            미발송 교육생이 없습니다. (이미 전체 발송 완료)
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {pendingStudents.map((s) => (
              <label
                key={s.id}
                className="flex items-center gap-2 rounded-md border border-border px-3 py-2 cursor-pointer hover:bg-accent/30"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(s.id)}
                  onChange={() => toggleSelect(s.id)}
                  className="shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {s.name_kr || s.name_vi || "(이름 없음)"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {s.code}
                    {s.class_start_date && ` · ${formatDate(s.class_start_date)}`}
                  </div>
                </div>
              </label>
            ))}
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

        {/* 추가 메모 */}
        <div>
          <label className="text-xs text-muted-foreground block mb-1">
            추가 메모 (마지막 입력값이 저장됩니다)
          </label>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="특이사항, 강의 준비물 등"
          />
        </div>
      </CardContent>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>메시지 미리보기</DialogTitle>
            <DialogDescription>
              {center.name} 원장 {center.phone} 으로 발송 예정
            </DialogDescription>
          </DialogHeader>
          <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-md max-h-96 overflow-y-auto">
            {message}
          </pre>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPreviewOpen(false)}>
              닫기
            </Button>
            <Button type="button" onClick={handleSend} disabled={pending}>
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
