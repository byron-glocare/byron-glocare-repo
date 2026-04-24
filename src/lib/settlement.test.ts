import { describe, it, expect } from "vitest";
import {
  computeSettlementSummary,
  commissionSettlementMonth,
  isCommissionSettlementTargetFor,
  isCommissionDeduction,
  totalCommissionDeduction,
  computeWelcomePackAmounts,
  suggestWelcomePackInterim,
  computeCommissionReceived,
} from "./settlement";

// =============================================================================
// §5.2 — 4종 정산 상태
// =============================================================================

describe("computeSettlementSummary — §5.2", () => {
  it("모두 비어있으면 웰컴팩은 product 에 따라 '대상아님', 나머지는 '미완료'", () => {
    const r = computeSettlementSummary({
      customer: { product_type: null },
      reservationPayments: [],
      commissionPayments: [],
      eventPayments: [],
      welcomePackPayment: null,
    });
    expect(r.reservation).toBe("미완료");
    expect(r.commission).toBe("미완료");
    expect(r.event).toBe("대상아님");
    expect(r.welcomePack).toBe("대상아님");
  });

  it("예약금 payment_date 있으면 완료", () => {
    const r = computeSettlementSummary({
      customer: { product_type: "교육" },
      reservationPayments: [{ payment_date: "2026-04-01" }],
      commissionPayments: [],
      eventPayments: [],
      welcomePackPayment: null,
    });
    expect(r.reservation).toBe("완료");
  });

  it("소개비 레코드가 있으면 완료 (0007 이후 row 존재 = 완료 표식)", () => {
    const none = computeSettlementSummary({
      customer: { product_type: "교육" },
      reservationPayments: [],
      commissionPayments: [],
      eventPayments: [],
      welcomePackPayment: null,
    });
    expect(none.commission).toBe("미완료");

    const some = computeSettlementSummary({
      customer: { product_type: "교육" },
      reservationPayments: [],
      commissionPayments: [{ id: "commission-1" }],
      eventPayments: [],
      welcomePackPayment: null,
    });
    expect(some.commission).toBe("완료");
  });

  it("이벤트 레코드 있고 모두 gift_given 이면 완료", () => {
    const r = computeSettlementSummary({
      customer: { product_type: "교육" },
      reservationPayments: [],
      commissionPayments: [],
      eventPayments: [{ gift_given: true }, { gift_given: true }],
      welcomePackPayment: null,
    });
    expect(r.event).toBe("완료");
  });

  it("이벤트 중 하나라도 미지급이면 미완료", () => {
    const r = computeSettlementSummary({
      customer: { product_type: "교육" },
      reservationPayments: [],
      commissionPayments: [],
      eventPayments: [{ gift_given: true }, { gift_given: false }],
      welcomePackPayment: null,
    });
    expect(r.event).toBe("미완료");
  });

  it("product_type 이 웰컴팩/교육+웰컴팩이면 웰컴팩 대상", () => {
    const target = computeSettlementSummary({
      customer: { product_type: "웰컴팩" },
      reservationPayments: [],
      commissionPayments: [],
      eventPayments: [],
      welcomePackPayment: null,
    });
    expect(target.welcomePack).toBe("미완료");

    const combined = computeSettlementSummary({
      customer: { product_type: "교육+웰컴팩" },
      reservationPayments: [],
      commissionPayments: [],
      eventPayments: [],
      welcomePackPayment: { sales_reported: true },
    });
    expect(combined.welcomePack).toBe("완료");
  });

  it("product_type 이 '교육' 이면 웰컴팩은 대상아님 (결제 레코드 있더라도)", () => {
    const r = computeSettlementSummary({
      customer: { product_type: "교육" },
      reservationPayments: [],
      commissionPayments: [],
      eventPayments: [],
      welcomePackPayment: { sales_reported: true },
    });
    expect(r.welcomePack).toBe("대상아님");
  });
});

// =============================================================================
// §5.3 — 소개비 정산 대상 월
// =============================================================================

describe("commissionSettlementMonth — §5.3 (0007 이후 50/80일)", () => {
  it("주간반 3월 10일 개강 → 50일 뒤 4월 29일 → 4월", () => {
    const r = commissionSettlementMonth("2026-03-10", "weekday");
    expect(r).toEqual({ year: 2026, month: 4 });
  });

  it("야간반 2월 10일 개강 → 80일 뒤 5월 1일 → 5월", () => {
    const r = commissionSettlementMonth("2026-02-10", "night");
    expect(r).toEqual({ year: 2026, month: 5 });
  });

  it("일정 정보 없으면 null", () => {
    expect(commissionSettlementMonth(null, "weekday")).toBeNull();
    expect(commissionSettlementMonth("2026-03-15", null)).toBeNull();
  });

  it("isCommissionSettlementTargetFor 일치 판정", () => {
    expect(
      isCommissionSettlementTargetFor("2026-03-10", "weekday", 2026, 4)
    ).toBe(true);
    expect(
      isCommissionSettlementTargetFor("2026-03-10", "weekday", 2026, 3)
    ).toBe(false);
    expect(
      isCommissionSettlementTargetFor("2026-02-10", "night", 2026, 5)
    ).toBe(true);
  });
});

// =============================================================================
// §5.4 — 예약금 처리
// =============================================================================

describe("isCommissionDeduction / totalCommissionDeduction — §5.4", () => {
  it("'소개비_공제' + 35000원 → 공제 대상", () => {
    expect(
      isCommissionDeduction({ amount: 35000, refund_reason: "소개비_공제" })
    ).toBe(true);
  });

  it("웰컴팩 예약자(100,000원)는 공제 대상 아님", () => {
    expect(
      isCommissionDeduction({ amount: 100000, refund_reason: "소개비_공제" })
    ).toBe(false);
  });

  it("'교육생환급_공제없음' 은 공제 대상 아님", () => {
    expect(
      isCommissionDeduction({
        amount: 35000,
        refund_reason: "교육생환급_공제없음",
      })
    ).toBe(false);
  });

  it("누적 공제액 합산", () => {
    expect(
      totalCommissionDeduction([
        { amount: 35000, refund_reason: "소개비_공제" },
        { amount: 35000, refund_reason: "중도탈락_매출인식" },
        { amount: 35000, refund_reason: "소개비_공제" },
        { amount: 100000, refund_reason: "소개비_공제" }, // 웰컴팩 예약
      ])
    ).toBe(70000);
  });
});

// =============================================================================
// §5.5 — 웰컴팩 계산
// =============================================================================

describe("computeWelcomePackAmounts — §5.5", () => {
  it("교육+웰컴팩 첫 예약 1,500,000 - 300,000 = 1,200,000", () => {
    // 1회차 100,000 + 2회차 300,000 = 2회차까지 400,000
    const { finalAmount, balanceAmount } = computeWelcomePackAmounts(
      1500000,
      300000,
      100000,
      300000
    );
    expect(finalAmount).toBe(1200000);
    expect(balanceAmount).toBe(800000);
  });

  it("2회차 350,000 (원거리)", () => {
    const r = computeWelcomePackAmounts(1500000, 300000, 100000, 350000);
    expect(r.balanceAmount).toBe(750000);
  });

  it("할인 없음 · 예약 없음 · 잔금1 없음 → balance = total", () => {
    const r = computeWelcomePackAmounts(1500000, 0, 0, 0);
    expect(r.finalAmount).toBe(1500000);
    expect(r.balanceAmount).toBe(1500000);
  });

  it("음수 결과는 0 으로 클램프", () => {
    const r = computeWelcomePackAmounts(100000, 200000, 0, 0);
    expect(r.finalAmount).toBe(0);
    expect(r.balanceAmount).toBe(0);
  });
});

describe("suggestWelcomePackInterim — 지역별 추천", () => {
  it("서울/경기/인천 → 25만원", () => {
    expect(suggestWelcomePackInterim("서울시 강남구")).toBe(250000);
    expect(suggestWelcomePackInterim("경기도 수원시")).toBe(250000);
    expect(suggestWelcomePackInterim("인천 연수")).toBe(250000);
  });

  it("대전/충남/충북/세종 → 30만원", () => {
    expect(suggestWelcomePackInterim("대전")).toBe(300000);
    expect(suggestWelcomePackInterim("충남 천안")).toBe(300000);
    expect(suggestWelcomePackInterim("세종시")).toBe(300000);
  });

  it("부산/대구/광주/경남 등 → 35만원", () => {
    expect(suggestWelcomePackInterim("부산 해운대")).toBe(350000);
    expect(suggestWelcomePackInterim("대구")).toBe(350000);
    expect(suggestWelcomePackInterim("광주")).toBe(350000);
    expect(suggestWelcomePackInterim("전남 순천")).toBe(350000);
    expect(suggestWelcomePackInterim("제주도")).toBe(350000);
  });

  it("null / 빈 문자열 / 매핑 안 되는 값 → null", () => {
    expect(suggestWelcomePackInterim(null)).toBeNull();
    expect(suggestWelcomePackInterim("")).toBeNull();
    expect(suggestWelcomePackInterim("   ")).toBeNull();
    expect(suggestWelcomePackInterim("일본 도쿄")).toBeNull();
  });
});

// =============================================================================
// 소개비 수령액
// =============================================================================

describe("computeCommissionReceived", () => {
  it("총액 - 공제 = 수령액", () => {
    expect(computeCommissionReceived(1000000, 35000)).toBe(965000);
  });
  it("공제가 총액보다 크면 0", () => {
    expect(computeCommissionReceived(10000, 35000)).toBe(0);
  });
});
