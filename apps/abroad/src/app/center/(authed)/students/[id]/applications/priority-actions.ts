"use server";

/**
 * 지망 순위(0069 study_applications.priority) 변경 — 센터 학생 상세의 ↑/↓ 버튼.
 *   같은 학생 + 같은 학기의 취소되지 않은 지원끼리 순서를 바꾸고 1..n 으로 다시 매긴다.
 *   (DB check: 1~3. 옛 데이터로 4건 이상이면 4번째부터 null)
 *   관리자 참고용 — 결제·단계에는 영향 없음. RLS 가 본인 org 학생의 지원만 update 허용.
 */

import { revalidatePath } from "next/cache";

import { verifyCenterSession } from "@/lib/center/dal";
import { createCenterClient } from "@/lib/supabase/center";

import { compareByTermPriority, MAX_PRIORITY } from "./priority";

type Supa = Awaited<ReturnType<typeof createCenterClient>>;
type Row = {
  id: string;
  term: string | null;
  priority: number | null;
  status: string;
  created_at: string;
};

async function loadTermRows(
  supabase: Supa,
  studentId: string,
  term: string | null
): Promise<Row[]> {
  const base = supabase
    .from("study_applications")
    .select("id, term, priority, status, created_at")
    .eq("student_id", studentId);
  const { data } = await (term ? base.eq("term", term) : base.is("term", null));
  return ((data ?? []) as Array<Partial<Row> & { id: string }>).map((r) => ({
    id: r.id,
    term: r.term ?? null,
    priority: r.priority ?? null,
    status: r.status ?? "",
    created_at: r.created_at ?? "",
  }));
}

/** ordered 순서대로 1..n (최대 3, 초과분 null), 취소 건은 null 로 저장 — 바뀐 행만 update */
async function writeOrder(supabase: Supa, ordered: Row[], cancelled: Row[]) {
  const updates: Array<{ id: string; priority: number | null }> = [];
  ordered.forEach((r, i) => {
    const want = i < MAX_PRIORITY ? i + 1 : null;
    if (r.priority !== want) updates.push({ id: r.id, priority: want });
  });
  for (const r of cancelled) {
    if (r.priority != null) updates.push({ id: r.id, priority: null });
  }
  for (const u of updates) {
    await supabase
      .from("study_applications")
      .update({ priority: u.priority })
      .eq("id", u.id);
  }
}

function split(rows: Row[]) {
  const active = rows.filter((r) => r.status !== "cancelled").sort(compareByTermPriority);
  const cancelled = rows.filter((r) => r.status === "cancelled");
  return { active, cancelled };
}

/**
 * 한 학기의 순위를 1..n 으로 정리 (삭제·취소·학기 변경 뒤 빈 번호 메우기).
 *   순위 없는 건은 기존 순위 뒤, 만든 순서대로.
 */
export async function renumberTermPriorities(
  studentId: string,
  term: string | null
): Promise<void> {
  await verifyCenterSession();
  const supabase = await createCenterClient();
  const { active, cancelled } = split(await loadTermRows(supabase, studentId, term));
  await writeOrder(supabase, active, cancelled);
}

/** 지망 순위 한 칸 올리기/내리기 (같은 학기 안에서 이웃과 맞바꿈) */
export async function moveApplicationPriorityAction(
  applicationId: string,
  studentId: string,
  direction: "up" | "down",
  _formData?: FormData
): Promise<void> {
  await verifyCenterSession();
  const supabase = await createCenterClient();

  const { data: app } = await supabase
    .from("study_applications")
    .select("id, student_id, term, status")
    .eq("id", applicationId)
    .maybeSingle();
  if (!app || app.student_id !== studentId || app.status === "cancelled") {
    revalidatePath(`/center/students/${studentId}`);
    return;
  }

  const { active, cancelled } = split(
    await loadTermRows(supabase, studentId, app.term ?? null)
  );
  const idx = active.findIndex((r) => r.id === applicationId);
  const swapWith = direction === "up" ? idx - 1 : idx + 1;
  if (idx >= 0 && swapWith >= 0 && swapWith < active.length) {
    const tmp = active[idx];
    active[idx] = active[swapWith];
    active[swapWith] = tmp;
  }
  await writeOrder(supabase, active, cancelled);

  revalidatePath(`/center/students/${studentId}`);
}
