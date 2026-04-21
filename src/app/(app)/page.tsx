import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const PHASES = [
  { num: 1, title: "기반 구축", status: "done" },
  { num: 2, title: "인증 & 레이아웃", status: "done" },
  { num: 3, title: "DB 스키마", status: "done" },
  { num: 4, title: "교육원·요양원 CRUD", status: "in_progress" },
  { num: 5, title: "고객관리 핵심", status: "pending" },
  { num: 6, title: "정산 모듈", status: "pending" },
  { num: 7, title: "알림발송", status: "pending" },
  { num: 8, title: "설정", status: "pending" },
  { num: 9, title: "대시보드 위젯", status: "pending" },
  { num: 10, title: "더미데이터", status: "pending" },
  { num: 11, title: "QA", status: "pending" },
  { num: 12, title: "엑셀 마이그레이션", status: "pending" },
  { num: 13, title: "완성", status: "pending" },
] as const;

const STATUS_LABEL = {
  done: { label: "완료", className: "bg-success/10 text-success border-success/20" },
  in_progress: { label: "진행중", className: "bg-warning/10 text-warning border-warning/20" },
  pending: { label: "대기", className: "bg-muted text-muted-foreground border-border" },
} as const;

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="대시보드"
        description="개발 진행 상황과 처리해야 할 작업을 한눈에 확인합니다."
      />
      <div className="p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">개발 단계 (Phase) 진행 상황</CardTitle>
            <CardDescription>
              실제 대시보드 위젯(처리 작업 카드, 통계, 차트)은 Phase 9에서 구현됩니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
              {PHASES.map((p) => {
                const s = STATUS_LABEL[p.status];
                return (
                  <li
                    key={p.num}
                    className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2"
                  >
                    <span className="text-sm">
                      <span className="text-muted-foreground mr-2">
                        Phase {p.num}
                      </span>
                      <span className="font-medium">{p.title}</span>
                    </span>
                    <Badge variant="outline" className={s.className}>
                      {s.label}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
