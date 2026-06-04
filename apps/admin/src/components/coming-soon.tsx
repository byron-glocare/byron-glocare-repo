import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";

type Props = {
  phase: string;
  description?: string;
};

export function ComingSoon({ phase, description }: Props) {
  return (
    <div className="p-6">
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <div className="size-12 rounded-full bg-warning/10 text-warning flex items-center justify-center">
            <Construction className="size-6" />
          </div>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{phase}</span> 에서
            구현될 화면입니다.
          </p>
          {description && (
            <p className="text-xs text-muted-foreground max-w-md">
              {description}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
