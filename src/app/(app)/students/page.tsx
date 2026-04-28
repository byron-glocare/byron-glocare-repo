import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import {
  StudyStatusEditor,
  MemoEditor,
} from "@/components/study-inbox-row";
import { dash, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const VALID_TABS = ["contacts", "insurance"] as const;
type TabKey = (typeof VALID_TABS)[number];

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  const tab: TabKey = VALID_TABS.includes(sp.tab as TabKey)
    ? (sp.tab as TabKey)
    : "contacts";

  const supabase = await createClient();

  const [{ data: contacts }, { data: claims }] = await Promise.all([
    supabase
      .from("study_contacts")
      .select("*")
      .order("submitted_at", { ascending: false }),
    supabase
      .from("study_insurance_claims")
      .select("*")
      .order("submitted_at", { ascending: false }),
  ]);

  const contactsCount = contacts?.length ?? 0;
  const contactsPending =
    contacts?.filter((c) => c.status === "미확인").length ?? 0;
  const claimsCount = claims?.length ?? 0;
  const claimsPending =
    claims?.filter((c) => c.status === "미확인").length ?? 0;

  return (
    <>
      <PageHeader
        title="유학생"
        description="유학 도메인 — 홈페이지 폼 제출 inbox"
        breadcrumbs={[{ label: "유학생" }]}
      />
      <div className="p-6">
        <Tabs defaultValue={tab} className="w-full">
          <TabsList className="grid grid-cols-2 w-full h-10">
            <TabsTrigger
              value="contacts"
              className="text-sm data-active:bg-primary data-active:text-primary-foreground data-active:font-semibold"
            >
              상담 신청{" "}
              <Badge variant="secondary" className="ml-1.5">
                {contactsCount}
              </Badge>
              {contactsPending > 0 && (
                <span className="ml-1 size-1.5 rounded-full bg-warning" />
              )}
            </TabsTrigger>
            <TabsTrigger
              value="insurance"
              className="text-sm data-active:bg-primary data-active:text-primary-foreground data-active:font-semibold"
            >
              보험 신청{" "}
              <Badge variant="secondary" className="ml-1.5">
                {claimsCount}
              </Badge>
              {claimsPending > 0 && (
                <span className="ml-1 size-1.5 rounded-full bg-warning" />
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="contacts" className="mt-6" keepMounted>
            {!contacts || contacts.length === 0 ? (
              <Card className="p-12 text-center text-sm text-muted-foreground">
                상담 신청 내역이 없습니다.
              </Card>
            ) : (
              <Card className="overflow-hidden p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-32">접수일</TableHead>
                      <TableHead className="w-28">이름</TableHead>
                      <TableHead className="w-32">전화</TableHead>
                      <TableHead className="w-44">이메일</TableHead>
                      <TableHead className="w-12 text-center">나이</TableHead>
                      <TableHead className="w-32">희망 학과</TableHead>
                      <TableHead className="w-32">소개 센터</TableHead>
                      <TableHead>메시지</TableHead>
                      <TableHead className="w-32 text-center">상태</TableHead>
                      <TableHead className="w-44">메모</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contacts.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="text-xs">
                          {formatDate(c.submitted_at)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {dash(c.name)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {dash(c.phone)}
                        </TableCell>
                        <TableCell className="text-xs">
                          {dash(c.email)}
                        </TableCell>
                        <TableCell className="text-center text-sm">
                          {c.age ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {dash(c.dept)}
                        </TableCell>
                        <TableCell className="text-xs">
                          {dash(c.center)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground truncate max-w-md">
                          {c.message}
                        </TableCell>
                        <TableCell>
                          <StudyStatusEditor
                            kind="contact"
                            id={c.id}
                            initialStatus={c.status}
                            initialMemo={c.memo}
                          />
                        </TableCell>
                        <TableCell>
                          <MemoEditor
                            kind="contact"
                            id={c.id}
                            status={c.status}
                            initialMemo={c.memo}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="insurance" className="mt-6" keepMounted>
            {!claims || claims.length === 0 ? (
              <Card className="p-12 text-center text-sm text-muted-foreground">
                보험 신청 내역이 없습니다.
              </Card>
            ) : (
              <Card className="overflow-hidden p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-32">접수일</TableHead>
                      <TableHead className="w-28">이름</TableHead>
                      <TableHead className="w-40">외국인등록번호</TableHead>
                      <TableHead className="w-32">Zalo</TableHead>
                      <TableHead className="w-24 text-center">마케팅 동의</TableHead>
                      <TableHead className="w-32 text-center">상태</TableHead>
                      <TableHead className="w-44">메모</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {claims.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="text-xs">
                          {formatDate(c.submitted_at)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {dash(c.name)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {dash(c.alien_no)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {dash(c.zalo)}
                        </TableCell>
                        <TableCell className="text-center">
                          {c.marketing === "Y" ? (
                            <Badge variant="outline">동의</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <StudyStatusEditor
                            kind="claim"
                            id={c.id}
                            initialStatus={c.status}
                            initialMemo={c.memo}
                          />
                        </TableCell>
                        <TableCell>
                          <MemoEditor
                            kind="claim"
                            id={c.id}
                            status={c.status}
                            initialMemo={c.memo}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
