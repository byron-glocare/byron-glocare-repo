import { Award, BookOpenCheck, Briefcase } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Props = {
  trained: number;
  certified: number;
  working: number;
};

export function CumulativeStatsCard({ trained, certified, working }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <BookOpenCheck className="size-4" />
          누적 통계
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="grid grid-cols-3 gap-3">
          <Metric
            icon={<BookOpenCheck className="size-3" />}
            label="누적 교육생"
            value={trained}
          />
          <Metric
            icon={<Award className="size-3" />}
            label="자격증 취득"
            value={certified}
          />
          <Metric
            icon={<Briefcase className="size-3" />}
            label="근무 중"
            value={working}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-semibold mt-0.5 tabular-nums">{value}</div>
      <div className="text-[11px] text-muted-foreground">명</div>
    </div>
  );
}
