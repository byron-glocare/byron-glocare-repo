import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <Card className="w-full max-w-2xl">
        <CardHeader className="items-center text-center gap-4">
          <Image
            src="/glocare_logo.png"
            alt="Glocare"
            width={240}
            height={120}
            priority
          />
          <CardTitle className="text-2xl">교육생 관리 시스템</CardTitle>
          <CardDescription>
            Phase 1 (기반 구축) 완료 — Next.js · Tailwind · shadcn/ui · Pretendard ·
            브랜드 컬러 적용
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap gap-2 justify-center">
            <Badge>Primary</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="destructive">Danger</Badge>
            <Badge variant="outline">Outline</Badge>
          </div>
          <div className="flex gap-3 justify-center">
            <Button>브랜드 액션</Button>
            <Button variant="outline">보조</Button>
            <Button variant="ghost">고스트</Button>
          </div>
          <p className="text-sm text-muted-foreground text-center">
            다음 단계: <span className="text-foreground font-medium">Phase 2</span>{" "}
            — Supabase Auth & 공통 레이아웃 (사이드바 + 헤더)
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
