import { CalendarDays } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  daily: number;
  weekly: number;
  monthly: number;
};

export function NewCustomersCard({ daily, weekly, monthly }: Props) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <CalendarDays className="size-4" />
          신규 고객 수
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3">
          <Metric label="오늘 (24h)" value={daily} />
          <Metric label="지난 7일" value={weekly} />
          <Metric label="지난 30일" value={monthly} />
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold mt-0.5 tabular-nums">{value}</div>
      <div className="text-[11px] text-muted-foreground">명</div>
    </div>
  );
}
