"use client";

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
};

export function StageDistributionChart({ distribution }: Props) {
  const total = distribution.reduce((sum, d) => sum + d.count, 0);

  if (total === 0) {
    return (
      <div className="text-center py-12 text-sm text-muted-foreground">
        아직 등록된 고객이 없습니다.
      </div>
    );
  }

  const data = distribution.map((d) => ({
    name: d.stage,
    value: d.count,
    color: COLORS[d.stage] ?? "#9CA3AF",
  }));

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
              <TableHead className="text-right">고객 수</TableHead>
              <TableHead className="text-right w-16">비율</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((d) => (
              <TableRow key={d.name}>
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
