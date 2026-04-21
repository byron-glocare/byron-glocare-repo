import { describe, it, expect } from "vitest";
import {
  buildNewStudentMessage,
  buildCommissionSettlementMessage,
} from "./sms-templates";

describe("buildNewStudentMessage", () => {
  it("교육생 1명 + 강의 정보 + 추가 메모", () => {
    const msg = buildNewStudentMessage({
      centerName: "대구 미래 교육원",
      classStartDate: "2026-05-01",
      classType: "weekday",
      students: [
        {
          name_kr: "팜 티 중",
          name_vi: "Phạm Thị Dung",
          phone: "010-1234-5678",
          visa_type: "D-10",
          birth_year: 1995,
        },
      ],
      extraNote: "교재는 첫 수업 때 배부됩니다.",
    });

    expect(msg).toContain("대구 미래 교육원");
    expect(msg).toContain("2026-05-01");
    expect(msg).toContain("(주간)");
    expect(msg).toContain("팜 티 중");
    expect(msg).toContain("1995년생");
    expect(msg).toContain("D-10");
    expect(msg).toContain("010-1234-5678");
    expect(msg).toContain("교재는 첫 수업");
  });

  it("야간반 강의 표시", () => {
    const msg = buildNewStudentMessage({
      centerName: "서울 교육원",
      classStartDate: "2026-03-15",
      classType: "night",
      students: [
        {
          name_kr: null,
          name_vi: "Nguyen",
          phone: null,
          visa_type: null,
          birth_year: null,
        },
      ],
    });
    expect(msg).toContain("(야간)");
    expect(msg).toContain("Nguyen");
  });

  it("강의일자 없으면 generic 문구", () => {
    const msg = buildNewStudentMessage({
      centerName: "X",
      classStartDate: null,
      classType: null,
      students: [
        { name_kr: "홍길동", name_vi: null, phone: null, visa_type: null, birth_year: null },
      ],
    });
    expect(msg).toContain("이번 개강 수업에");
  });

  it("학생 없으면 0명", () => {
    const msg = buildNewStudentMessage({
      centerName: "X",
      classStartDate: null,
      classType: null,
      students: [],
    });
    expect(msg).toContain("0명");
  });
});

describe("buildCommissionSettlementMessage", () => {
  it("2명 + 공제 + 입금계좌", () => {
    const msg = buildCommissionSettlementMessage({
      centerName: "대구 미래 교육원",
      bankName: "국민은행",
      bankAccount: "123-456-789012",
      year: 2026,
      month: 4,
      items: [
        {
          customerName: "팜 티 중",
          totalAmount: 250000,
          deductionAmount: 35000,
          receivedAmount: 215000,
        },
        {
          customerName: "Nguyen",
          totalAmount: 300000,
          deductionAmount: 0,
          receivedAmount: 300000,
        },
      ],
    });
    expect(msg).toContain("대구 미래 교육원");
    expect(msg).toContain("2026년 4월");
    expect(msg).toContain("2명");
    expect(msg).toContain("팜 티 중");
    expect(msg).toContain("Nguyen");
    // 공제가 있는 항목은 공제/수령 함께 표시
    expect(msg).toContain("공제 35,000원");
    expect(msg).toContain("수령 215,000원");
    // 합계
    expect(msg).toContain("총 소개비: 550,000원");
    expect(msg).toContain("총 공제액: 35,000원");
    expect(msg).toContain("최종 입금 요청: 515,000원");
    // 계좌
    expect(msg).toContain("국민은행 123-456-789012");
  });

  it("공제 0 이면 공제/수령 줄 생략", () => {
    const msg = buildCommissionSettlementMessage({
      centerName: "X",
      bankName: null,
      bankAccount: null,
      year: 2026,
      month: 4,
      items: [
        {
          customerName: "홍",
          totalAmount: 300000,
          deductionAmount: 0,
          receivedAmount: 300000,
        },
      ],
    });
    expect(msg).not.toContain("공제 ");
    expect(msg).not.toContain("수령 ");
    // 단, 합계에 "총 공제액" 은 0 이므로 생략됨
    expect(msg).not.toContain("총 공제액");
  });

  it("계좌 정보 없으면 계좌 줄 생략", () => {
    const msg = buildCommissionSettlementMessage({
      centerName: "X",
      bankName: null,
      bankAccount: null,
      year: 2026,
      month: 4,
      items: [
        {
          customerName: "A",
          totalAmount: 100000,
          deductionAmount: 0,
          receivedAmount: 100000,
        },
      ],
    });
    expect(msg).not.toContain("입금 계좌");
  });
});
