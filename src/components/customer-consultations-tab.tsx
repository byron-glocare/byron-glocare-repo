"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Hospital, GraduationCap, Languages, Loader2, Send } from "lucide-react";

import { createConsultation } from "@/app/(app)/customers/actions";
import type { Consultation } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { formatDateTime } from "@/lib/format";

type Props = {
  customerId: string;
  consultations: Consultation[];
};

type ConsultationType = "training_center" | "care_home";

export function CustomerConsultationsTab({ customerId, consultations }: Props) {
  return (
    <Tabs defaultValue="training_center" className="w-full">
      <TabsList>
        <TabsTrigger value="training_center">
          <GraduationCap className="size-4" />
          교육원 상담
        </TabsTrigger>
        <TabsTrigger value="care_home">
          <Hospital className="size-4" />
          요양원 상담
        </TabsTrigger>
      </TabsList>

      <TabsContent value="training_center" className="mt-4">
        <ConsultationSection
          customerId={customerId}
          type="training_center"
          consultations={consultations.filter(
            (c) => c.consultation_type === "training_center"
          )}
        />
      </TabsContent>

      <TabsContent value="care_home" className="mt-4">
        <ConsultationSection
          customerId={customerId}
          type="care_home"
          consultations={consultations.filter(
            (c) => c.consultation_type === "care_home"
          )}
        />
      </TabsContent>
    </Tabs>
  );
}

function ConsultationSection({
  customerId,
  type,
  consultations,
}: {
  customerId: string;
  type: ConsultationType;
  consultations: Consultation[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [translating, setTranslating] = useState(false);
  const [vi, setVi] = useState("");
  const [kr, setKr] = useState("");

  async function handleTranslate() {
    if (!vi.trim()) {
      toast.error("베트남어 내용을 먼저 입력하세요.");
      return;
    }
    setTranslating(true);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: vi, target: "ko", source: "vi" }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast.error("번역 실패", {
          description: json.error ?? `HTTP ${res.status}`,
        });
        return;
      }
      const json = (await res.json()) as { translation: string };
      setKr(json.translation);
      toast.success("번역 완료");
    } catch (e) {
      toast.error("번역 실패", {
        description: e instanceof Error ? e.message : "알 수 없는 오류",
      });
    } finally {
      setTranslating(false);
    }
  }

  function handleSubmit() {
    if (!vi.trim() && !kr.trim()) {
      toast.error("상담 내용을 입력해주세요.");
      return;
    }
    startTransition(async () => {
      const result = await createConsultation(customerId, {
        consultation_type: type,
        content_vi: vi.trim() || null,
        content_kr: kr.trim() || null,
      });
      if (result.ok) {
        toast.success("상담 일지가 저장되었습니다.");
        setVi("");
        setKr("");
        router.refresh();
      } else {
        toast.error("저장 실패", { description: result.error });
      }
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">새 상담 일지</CardTitle>
          <CardDescription>
            베트남어 원문 입력 후 AI 번역으로 한국어 초안을 자동 생성할 수 있습니다.
            한국어는 직접 수정 가능합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">베트남어 원문</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleTranslate}
                  disabled={translating || pending || !vi.trim()}
                >
                  {translating ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Languages className="size-3" />
                  )}
                  AI 번역 →
                </Button>
              </div>
              <Textarea
                value={vi}
                onChange={(e) => setVi(e.target.value)}
                rows={6}
                placeholder="Tiếng Việt..."
                disabled={pending}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">한국어 (자동 번역 또는 직접 입력)</Label>
              <Textarea
                value={kr}
                onChange={(e) => setKr(e.target.value)}
                rows={6}
                placeholder="한국어 내용 또는 AI 번역 결과"
                disabled={pending}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={pending || (!vi.trim() && !kr.trim())}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              저장
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            이전 상담 이력 ({consultations.length}건)
          </CardTitle>
          <CardDescription>삭제 불가 — 모든 상담은 이력으로 누적됩니다.</CardDescription>
        </CardHeader>
        <CardContent>
          {consultations.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border rounded-md">
              이전 상담 기록이 없습니다.
            </p>
          ) : (
            <ol className="space-y-3">
              {consultations
                .slice()
                .sort(
                  (a, b) =>
                    new Date(b.created_at).getTime() -
                    new Date(a.created_at).getTime()
                )
                .map((c) => (
                  <li
                    key={c.id}
                    className="rounded-md border border-border bg-card p-4 space-y-2"
                  >
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline">
                        {formatDateTime(c.created_at)}
                      </Badge>
                    </div>
                    {c.content_kr && (
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">
                          한국어
                        </div>
                        <p className="text-sm whitespace-pre-wrap">
                          {c.content_kr}
                        </p>
                      </div>
                    )}
                    {c.content_vi && (
                      <details className="group">
                        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                          원문 보기 (Tiếng Việt)
                        </summary>
                        <p className="text-sm whitespace-pre-wrap mt-1 pl-3 border-l-2 border-border">
                          {c.content_vi}
                        </p>
                      </details>
                    )}
                  </li>
                ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
