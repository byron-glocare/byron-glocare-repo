import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/server";
import { sendNhnMms, uploadNhnAttachment } from "@/lib/nhn-sms";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// =============================================================================
// 자동 문자 발송 엔진 — Supabase pg_cron 이 10분마다 호출한다.
// (등록 SQL 은 supabase/migrations/0055_auto_sms.sql 하단 주석 참고)
//
// 룰별로 due(발송 시점 도래) 고객을 찾아 MMS 발송:
//   발송 예정 시각 = (기준 날짜 + offset_days) + (send_time ?? 09:00) [KST]
//   - send_time null(즉시): 시점이 도래해 있으면 다음 크론 틱에 바로 발송,
//     미래 날짜가 도래한 날에는 기본 09:00(KST) 발송
//   - 과거분 스킵: 발송 예정 "날짜"(KST)가 룰 생성일(KST) 이전이면 제외
//   - 지연 한도: 예정 시각에서 7일 지난 건은 발송하지 않음 (뒷북 방지)
//   - 중복 방지: auto_sms_sends(rule_id, customer_id) unique 로 1회만
// =============================================================================

const KST_MS = 9 * 60 * 60 * 1000;
const GRACE_DAYS = 7;

/** UTC Date → KST 기준 'YYYY-MM-DD' */
function kstDateStr(d: Date): string {
  return new Date(d.getTime() + KST_MS).toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD' + n일 */
function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** KST 의 날짜+시간('HH:MM') → UTC Date */
function kstToUtc(dateStr: string, timeStr: string): Date {
  return new Date(new Date(`${dateStr}T${timeStr}:00Z`).getTime() - KST_MS);
}

type RuleRow = {
  id: string;
  name: string;
  title: string | null;
  anchor_field: string;
  offset_days: number;
  send_time: string | null;
  body: string;
  image_path: string | null;
  created_at: string;
};

async function run() {
  const admin = createAdminClient();
  const now = new Date();

  const { data: rules, error: rulesError } = await admin
    .from("auto_sms_rules")
    .select(
      "id, name, title, anchor_field, offset_days, send_time, body, image_path, created_at"
    )
    .eq("is_active", true);
  if (rulesError) {
    return NextResponse.json({ error: rulesError.message }, { status: 500 });
  }

  const summary: Record<string, { due: number; sent: number; failed: number }> =
    {};

  for (const rule of (rules ?? []) as RuleRow[]) {
    const stat = { due: 0, sent: 0, failed: 0 };
    summary[rule.name] = stat;

    // 기준 날짜 필드는 check 제약으로 화이트리스트가 보장돼 있어 select 에 직접 사용
    const { data: customers, error } = await admin
      .from("customers")
      .select(`id, name_kr, name_vi, phone, ${rule.anchor_field}`)
      .not(rule.anchor_field, "is", null)
      .not("phone", "is", null);
    if (error || !customers) continue;

    const effTime = rule.send_time ? rule.send_time.slice(0, 5) : "09:00";
    const ruleCreatedKstDate = kstDateStr(new Date(rule.created_at));

    // due 고객 추리기
    const due: { id: string; name: string; phone: string; dueAt: Date }[] = [];
    for (const c of customers as unknown as Record<string, string | null>[]) {
      const raw = c[rule.anchor_field];
      const phone = c.phone;
      if (!raw || !phone) continue;
      // created_at 은 timestamptz → KST 날짜로 변환, 나머지는 date 문자열 그대로
      const anchorDate =
        rule.anchor_field === "created_at"
          ? kstDateStr(new Date(raw))
          : raw.slice(0, 10);
      const targetDate = addDays(anchorDate, rule.offset_days);
      if (targetDate < ruleCreatedKstDate) continue; // 과거분 스킵
      const dueAt = kstToUtc(targetDate, effTime);
      if (now < dueAt) continue; // 아직 아님
      if (now.getTime() - dueAt.getTime() > GRACE_DAYS * 86400_000) continue;
      due.push({
        id: c.id as string,
        name: (c.name_kr || c.name_vi || "고객") as string,
        phone,
        dueAt,
      });
    }
    if (due.length === 0) continue;

    // unique(rule_id, customer_id) 선점 — 이번 실행이 insert 한 행만 발송 대상
    // (크론이 겹쳐 돌아도 중복 발송되지 않음)
    const { data: claimed, error: claimError } = await admin
      .from("auto_sms_sends")
      .upsert(
        due.map((c) => ({
          rule_id: rule.id,
          customer_id: c.id,
          due_at: c.dueAt.toISOString(),
          status: "pending",
        })),
        { onConflict: "rule_id,customer_id", ignoreDuplicates: true }
      )
      .select("id, customer_id");
    if (claimError || !claimed || claimed.length === 0) continue;
    stat.due = claimed.length;

    // 이미지 첨부 — 룰당 1회 NHN 업로드 후 fileId 재사용
    let attachFileIds: number[] | undefined;
    let attachError: string | null = null;
    if (rule.image_path) {
      const { data: blob, error: dlError } = await admin.storage
        .from("sms-images")
        .download(rule.image_path);
      if (dlError || !blob) {
        attachError = `이미지 다운로드 실패: ${dlError?.message ?? "unknown"}`;
      } else {
        const base64 = Buffer.from(await blob.arrayBuffer()).toString("base64");
        const fileName = rule.image_path.split("/").pop() ?? "image.jpg";
        const up = await uploadNhnAttachment({ fileName, base64Body: base64 });
        if (up.ok) attachFileIds = [up.fileId];
        else attachError = up.error;
      }
    }

    const dueById = new Map(due.map((c) => [c.id, c]));
    for (const row of claimed) {
      const c = dueById.get(row.customer_id);
      if (!c) continue;
      let result: { ok: true } | { ok: false; error: string };
      if (attachError) {
        // 이미지가 있어야 하는 문자인데 첨부 준비 실패 → 발송하지 않고 기록
        result = { ok: false, error: attachError };
      } else {
        result = await sendNhnMms({
          phone: c.phone,
          title: rule.title?.trim() || "[글로케어]",
          body: rule.body.replaceAll("{이름}", c.name),
          attachFileIds,
        });
      }
      await admin
        .from("auto_sms_sends")
        .update(
          result.ok
            ? { status: "sent", sent_at: new Date().toISOString(), error: null }
            : { status: "failed", error: result.error }
        )
        .eq("id", row.id);
      if (result.ok) stat.sent += 1;
      else stat.failed += 1;
    }
  }

  return NextResponse.json({ ok: true, at: now.toISOString(), summary });
}

function authorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  // fail-closed: 시크릿 미설정 시 무조건 거부
  return Boolean(cronSecret && auth === `Bearer ${cronSecret}`);
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return run();
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return run();
}
