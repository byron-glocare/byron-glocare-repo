/**
 * /calendar — 모집 일정 달력 (유학).
 *   승인된 모집요강의 학기 일정(원서·서류·면접·발표·납부·개강 …)을 월 달력으로 모아 본다.
 *   대학별로 흩어진 일정을 한눈에 보고 마감을 놓치지 않으려는 화면(2026-10-30 요청).
 */

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { loadScheduleCalendar, SCHEDULE_STAGES } from "@/lib/admission/schedule-calendar";
import { todayKstStr } from "@/lib/training-class-schedule";
import { CalendarView } from "./calendar-view";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const supabase = await createClient();
  const { items, events } = await loadScheduleCalendar(supabase);

  return (
    <>
      <PageHeader
        title="모집 일정"
        description="승인된 모집요강의 일정을 달력으로 — 왼쪽에서 모집요강·단계를 골라 넣고 뺄 수 있습니다"
        breadcrumbs={[{ label: "모집 일정" }]}
      />
      <div className="p-6">
        <CalendarView items={items} events={events} stages={SCHEDULE_STAGES} today={todayKstStr()} />
      </div>
    </>
  );
}
