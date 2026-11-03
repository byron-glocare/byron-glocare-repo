"use client";

import { useRouter } from "next/navigation";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";

import type { StageDistribution } from "@/lib/dashboard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Props = {
  distribution: StageDistribution;
};

// 단계별 컬러 (디자인 가이드와 톤 맞춤)
const COLORS: Record<string, string> = {
  접수중: "#3B82F6", // info
  접수완료_대기: "#6366F1",
  교육예약중: "#FF6060", // brand
  교육중: "#F59E0B", // warning
  취업중: "#10B981", // success
  근무중: "#059669",
  근무종료: "#6B7280", // muted
  대기중: "#F59E0B",
  종료: "#EF4444", // danger
  // 교육중 세부 라벨 — amber 계열 명암으로 한 묶음처럼
  "교육 대기": "#FCD34D",
  "교육 중": "#F59E0B",
  "자격증 취득 대기": "#D97706",
  "교육원 일정 문의 필요": "#FBBF24",
};

// 분포 항목 클릭 시 이동할 교육생 리스트 URL.
// 교육중 세부 라벨(key !== stage)은 라벨 필터(stage=), 그 외는 단계 그룹 필터(stageGroup=).
function hrefForEntry(key: string, stage: string): string {
  const params = new URLSearchParams();
  if (key === stage) params.set("stageGroup", stage);
  else params.set("stage", key);
  return `/customers?${params.toString()}`;
}

export function StageDistributionChart({ distribution }: Props) {
  return (
    <DistributionChart
      data={distribution.map((d) => ({
        name: d.key,
        value: d.count,
        color: COLORS[d.key] ?? COLORS[d.stage] ?? "#9CA3AF",
        href: hrefForEntry(d.key, d.stage),
      }))}
      emptyText="아직 등록된 고객이 없습니다."
      countLabel="고객 수"
      rowTitle="교육생 보기"
    />
  );
}

// 유학생 단계별 컬러 — 진행 순서대로 파랑 → 초록, 종료는 위와 같은 회색 계열
const STUDY_COLORS: Record<string, string> = {
  "지원 전": "#9CA3AF",
  "결제 전": "#3B82F6",
  "서류 작성 중": "#F59E0B",
  "서류 작성 완료": "#FF6060",
  "대학교 제출 완료": "#10B981",
  입학: "#059669",
  종료: "#EF4444",
};

export type StudyDistribution = { stage: string; count: number }[];

/** 유학생 단계 분포 — 칸을 누르면 그 단계의 유학생 목록으로 */
export function StudyDistributionChart({ distribution }: { distribution: StudyDistribution }) {
  return (
    <DistributionChart
      data={distribution.map((d) => ({
        name: d.stage,
        value: d.count,
        color: STUDY_COLORS[d.stage] ?? "#9CA3AF",
        href: `/managed-students?stage=${encodeURIComponent(d.stage)}`,
      }))}
      emptyText="아직 등록된 유학생이 없습니다."
      countLabel="학생 수"
      rowTitle="유학생 보기"
    />
  );
}

function DistributionChart({
  data,
  emptyText,
  countLabel,
  rowTitle,
}: {
  data: { name: string; value: number; color: string; href: string }[];
  emptyText: string;
  countLabel: string;
  rowTitle: string;
}) {
  const router = useRouter();
  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (total === 0) {
    return (
      <div className="text-center py-12 text-sm text-muted-foreground">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6 items-center">
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
              style={{ cursor: "pointer" }}
              onClick={(_, index) => {
                const item = data[index];
                if (item) router.push(item.href);
              }}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => [`${value}명`, ""]}
              contentStyle={{
                fontSize: "12px",
                border: "1px solid hsl(var(--border, 215 27% 90%))",
                borderRadius: "6px",
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: "12px" }}
              iconType="circle"
              iconSize={8}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="overflow-hidden rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>단계</TableHead>
              <TableHead className="text-right">{countLabel}</TableHead>
              <TableHead className="text-right w-16">비율</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((d) => (
              <TableRow
                key={d.name}
                className="cursor-pointer hover:bg-accent/40"
                onClick={() => router.push(d.href)}
                title={`${d.name.replace("_", " ")} ${rowTitle}`}
              >
                <TableCell className="flex items-center gap-2">
                  <span
                    className="inline-block size-3 rounded-sm shrink-0"
                    style={{ background: d.color }}
                  />
                  <span className="text-sm">{d.name.replace("_", " ")}</span>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {d.value}
                </TableCell>
                <TableCell className="text-right text-muted-foreground text-sm">
                  {((d.value / total) * 100).toFixed(1)}%
                </TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell className="font-medium">합계</TableCell>
              <TableCell className="text-right font-bold">{total}</TableCell>
              <TableCell className="text-right">100%</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
