import Link from "next/link";
import { GraduationCap, Handshake, Hospital } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Props = {
  trainingCenters: number;
  careHomes: number;
};

export function PartnersStatsCard({ trainingCenters, careHomes }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Handshake className="size-4" />
          제휴 업체
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="grid grid-cols-2 gap-3">
          <Metric
            href="/training-centers?status=active"
            icon={<GraduationCap className="size-3" />}
            label="교육원"
            value={trainingCenters}
          />
          <Metric
            href="/care-homes?status=active"
            icon={<Hospital className="size-3" />}
            label="요양원"
            value={careHomes}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({
  href,
  icon,
  label,
  value,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <Link
      href={href}
      className="block rounded-md hover:bg-accent/30 transition-colors -mx-1 px-1 py-0.5"
    >
      <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-semibold mt-0.5 tabular-nums">{value}</div>
      <div className="text-[11px] text-muted-foreground">제휴 중</div>
    </Link>
  );
}
