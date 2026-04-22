import { CalendarDays } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  daily: number;
  weekly: number;
  monthly: number;
};

export function NewCustomersCard({ daily, weekly, monthly }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarDays className="size-4" />
          신규 고객 수
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
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
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-3xl font-semibold mt-1">{value}</div>
      <div className="text-xs text-muted-foreground">명</div>
    </div>
  );
}
