import { describe, it, expect } from "vitest";
import { computeCommissionAmount } from "./commission";

const CENTER = {
  tuition_fee_2026: 1200000,
  deduct_reservation_by_default: true,
};

describe("computeCommissionAmount — 환불 여부에 따른 공제", () => {
  it("교육원이 공제 OFF → 공제 0", () => {
    const r = computeCommissionAmount({
      center: { ...CENTER, deduct_reservation_by_default: false },
      reservationPayments: [
        { payment_date: "2026-04-01", refund_amount: 0, refund_date: null },
      ],
      welcomePackPayment: null,
      educationReservationAmount: 35000,
    });
    expect(r.defaultDeduction).toBe(0);
    expect(r.deductionReason).toContain("교육원");
  });

  it("웰컴팩 예약금 납입 → 교육 예약금 면제 → 공제 0", () => {
    const r = computeCommissionAmount({
      center: CENTER,
      reservationPayments: [
        { payment_date: "2026-04-01", refund_amount: 0, refund_date: null },
      ],
      welcomePackPayment: { reservation_date: "2026-04-02" },
      educationReservationAmount: 35000,
    });
    expect(r.defaultDeduction).toBe(0);
    expect(r.deductionReason).toContain("웰컴팩");
  });

  it("교육 예약금 미납 → 공제 0", () => {
    const r = computeCommissionAmount({
      center: CENTER,
      reservationPayments: [],
      welcomePackPayment: null,
      educationReservationAmount: 35000,
    });
    expect(r.defaultDeduction).toBe(0);
    expect(r.deductionReason).toBe("교육 예약금 미납");
  });

  it("교육 예약금 납입 + 환불 안 됨 → 공제 35,000", () => {
    const r = computeCommissionAmount({
      center: CENTER,
      reservationPayments: [
        { payment_date: "2026-04-01", refund_amount: 0, refund_date: null },
      ],
      welcomePackPayment: null,
      educationReservationAmount: 35000,
    });
    expect(r.defaultDeduction).toBe(35000);
    expect(r.deductionEligible).toBe(true);
    expect(r.deductionReason).toBe("교육 예약금 공제");
  });

  it("교육 예약금 납입 + refund_date 있음 → 공제 0 (환불됨)", () => {
    const r = computeCommissionAmount({
      center: CENTER,
      reservationPayments: [
        {
          payment_date: "2026-04-01",
          refund_amount: 35000,
          refund_date: "2026-04-15",
        },
      ],
      welcomePackPayment: null,
      educationReservationAmount: 35000,
    });
    expect(r.defaultDeduction).toBe(0);
    expect(r.deductionReason).toContain("환불됨");
  });

  it("교육 예약금 납입 + refund_amount>0 (refund_date 없음) → 공제 0", () => {
    const r = computeCommissionAmount({
      center: CENTER,
      reservationPayments: [
        { payment_date: "2026-04-01", refund_amount: 35000, refund_date: null },
      ],
      welcomePackPayment: null,
      educationReservationAmount: 35000,
    });
    expect(r.defaultDeduction).toBe(0);
    expect(r.deductionReason).toContain("환불됨");
  });

  it("납입 2건 — 1건은 환불, 1건은 보유 중 → 공제 35,000", () => {
    const r = computeCommissionAmount({
      center: CENTER,
      reservationPayments: [
        { payment_date: "2026-03-01", refund_amount: 35000, refund_date: "2026-03-15" },
        { payment_date: "2026-04-01", refund_amount: 0, refund_date: null },
      ],
      welcomePackPayment: null,
      educationReservationAmount: 35000,
    });
    expect(r.defaultDeduction).toBe(35000);
    expect(r.deductionReason).toBe("교육 예약금 공제");
  });

  it("tuitionBase = 수강료 × 25%", () => {
    const r = computeCommissionAmount({
      center: CENTER, // 1,200,000 × 0.25 = 300,000
      reservationPayments: [],
      welcomePackPayment: null,
      educationReservationAmount: 35000,
    });
    expect(r.tuitionBase).toBe(300000);
  });
});
