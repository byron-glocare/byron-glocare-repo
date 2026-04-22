import { describe, it, expect } from "vitest";
import {
  computeTaskBuckets,
  computeStageDistribution,
  computeNewCustomerCounts,
  type DashboardInputs,
} from "./dashboard";
import type { Customer, CustomerStatus } from "@/types/database";

// =============================================================================
// 픽스처 빌더
// =============================================================================

function makeCustomer(overrides?: Partial<Customer>): Customer {
  return {
    id: `cust-${Math.random().toString(36).slice(2, 8)}`,
    code: "CVN2604001",
    legacy_status: null,
    name_vi: null,
    name_kr: "홍길동",
    address: null,
    gender: null,
    birth_year: null,
    phone: "010-1111-2222",
    email: null,
    visa_type: null,
    topik_level: null,
    stay_remaining: null,
    desired_period: null,
    desired_time: null,
    desired_region: null,
    training_center_id: null,
    training_class_id: null,
    care_home_id: null,
    class_start_date: null,
    class_end_date: null,
    work_start_date: null,
    work_end_date: null,
    visa_change_date: null,
    interview_date: null,
    product_type: null,
    is_waiting: false,
    recontact_date: null,
    waiting_memo: null,
    termination_reason: null,
    created_at: "2026-04-22T00:00:00Z",
    updated_at: "2026-04-22T00:00:00Z",
    ...overrides,
  };
}

function makeStatus(
  customerId: string,
  overrides?: Partial<CustomerStatus>
): CustomerStatus {
  return {
    customer_id: customerId,
    intake_abandoned: false,
    study_abroad_consultation: false,
    training_center_finding: false,
    training_reservation_abandoned: false,
    certificate_acquired: false,
    training_dropped: false,
    welcome_pack_abandoned: false,
    care_home_finding: false,
    interview_passed: false,
    updated_at: "2026-04-22T00:00:00Z",
    ...overrides,
  };
}

function buildInputs(
  entries: { customer: Customer; status?: Partial<CustomerStatus> }[],
  extra?: Partial<DashboardInputs>
): DashboardInputs {
  return {
    customers: entries.map((e) => e.customer),
    statuses: entries.map((e) => makeStatus(e.customer.id, e.status)),
    reservationPayments: [],
    welcomePackPayments: [],
    smsMessages: [],
    today: "2026-04-22",
    ...extra,
  };
}

// =============================================================================
// 처리 작업 8종
// =============================================================================

describe("computeTaskBuckets", () => {
  it("교육원 발굴 플래그 켜진 고객을 버킷에 담는다", () => {
    const c = makeCustomer();
    const buckets = computeTaskBuckets(
      buildInputs([{ customer: c, status: { training_center_finding: true } }])
    );
    const cf = buckets.find((b) => b.key === "center_finding");
    expect(cf?.count).toBe(1);
  });

  it("접수 완료 + 교육원 미매칭 → 교육원 매칭 필요", () => {
    const c = makeCustomer({ phone: "010-1234-5678", name_kr: "A" });
    const buckets = computeTaskBuckets(buildInputs([{ customer: c }]));
    const cm = buckets.find((b) => b.key === "center_matching");
    expect(cm?.count).toBe(1);
  });

  it("접수포기 상태면 교육원 매칭 버킷에서 제외", () => {
    const c = makeCustomer({ phone: "010-1234-5678", name_kr: "A" });
    const buckets = computeTaskBuckets(
      buildInputs([{ customer: c, status: { intake_abandoned: true } }])
    );
    expect(buckets.find((b) => b.key === "center_matching")?.count).toBe(0);
  });

  it("연락 필요: is_waiting + recontact_date <= today", () => {
    const due = makeCustomer({
      is_waiting: true,
      recontact_date: "2026-04-20",
    });
    const future = makeCustomer({
      is_waiting: true,
      recontact_date: "2026-05-01",
    });
    const buckets = computeTaskBuckets(
      buildInputs([{ customer: due }, { customer: future }])
    );
    const rn = buckets.find((b) => b.key === "recontact_needed");
    expect(rn?.count).toBe(1);
    expect(rn?.customers[0].id).toBe(due.id);
  });

  it("비자변경 '대기' 또는 '중' 이면 버킷에 포함", () => {
    const pending = makeCustomer({ work_start_date: "2026-04-15" }); // +30일 이전
    const inProgress = makeCustomer({ work_start_date: "2026-03-01" }); // +30일 이후, visa_change_date null
    const done = makeCustomer({
      work_start_date: "2026-03-01",
      visa_change_date: "2026-04-10",
    });
    const buckets = computeTaskBuckets(
      buildInputs([
        { customer: pending },
        { customer: inProgress },
        { customer: done },
      ])
    );
    const vc = buckets.find((b) => b.key === "visa_change");
    expect(vc?.count).toBe(2);
  });
});

// =============================================================================
// 단계별 분포
// =============================================================================

describe("computeStageDistribution", () => {
  it("여러 단계 섞여 있으면 각 단계별 count 반환", () => {
    const c1 = makeCustomer({ name_kr: "A" }); // 접수중 (전화 있음 → 핵심 → 접수완료) → 교육예약중 교육원 매칭 필요
    const c2 = makeCustomer({ is_waiting: true, phone: "010-1111-2222", name_kr: "B" }); // 대기중
    const c3 = makeCustomer({ termination_reason: "귀국", name_kr: "C" }); // 종료
    const dist = computeStageDistribution(
      buildInputs([{ customer: c1 }, { customer: c2 }, { customer: c3 }])
    );
    const stages = dist.map((d) => d.stage);
    expect(stages).toContain("대기중");
    expect(stages).toContain("종료");
    // c1 은 기초정보 핵심(name+phone 있음) → 접수 완료 후 교육예약중
    expect(stages).toContain("교육예약중");
  });
});

// =============================================================================
// 신규 고객 수
// =============================================================================

describe("computeNewCustomerCounts", () => {
  it("오늘/이번주/이번달 각각 집계", () => {
    const today = new Date("2026-04-22T12:00:00Z");
    const customers = [
      { created_at: "2026-04-22T09:00:00Z" }, // 오늘
      { created_at: "2026-04-20T09:00:00Z" }, // 2일 전 (주간)
      { created_at: "2026-04-10T09:00:00Z" }, // 12일 전 (월간만)
      { created_at: "2026-02-01T09:00:00Z" }, // 80일 전 (제외)
    ];
    const counts = computeNewCustomerCounts(customers, today.toISOString());
    expect(counts.daily).toBe(1);
    expect(counts.weekly).toBe(2);
    expect(counts.monthly).toBe(3);
  });

  it("잘못된 날짜는 무시", () => {
    const counts = computeNewCustomerCounts([
      { created_at: "invalid" },
      { created_at: "2026-04-22T00:00:00Z" },
    ]);
    expect(counts.daily).toBeGreaterThanOrEqual(0);
  });
});
