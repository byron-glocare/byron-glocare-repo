import { describe, it, expect } from "vitest";
import {
  buildNewStudentMessage,
  buildCommissionSettlementMessage,
} from "./sms-templates";

describe("buildNewStudentMessage", () => {
  it("교육생 1명 — 새 포맷 전체 항목", () => {
    const msg = buildNewStudentMessage({
      centerName: "대구 미래 교육원",
      students: [
        {
          name_kr: "응우옌티홍응안",
          name_vi: "Nguyễn Thị Hồng Ngân",
          phone: "010-2668-6845",
          visa_type: "D2",
          birth_year: 1999,
          topik_level: "2급",
          reservationAmount: 100000,
          classStartDate: "2026-04-17",
          classType: "weekday",
          extraNote: "시험일정 변경 요청 있음",
        },
      ],
    });

    // 제목 — 월 표기
    expect(msg).toContain("[4월 신규 교육생 안내]");
    // 인사 + 본문 헤더
    expect(msg).toContain("대구 미래 교육원 원장님께,");
    expect(msg).toContain("안녕하세요. 글로케어입니다.");
    expect(msg).toContain("대상 교육생: 1명");
    // 학생 블록
    expect(msg).toContain("- 이름: NGUYEN THI HONG NGAN / 응우옌티홍응안");
    expect(msg).toContain("- 희망 개강일: 26년 4월 17일 주간반");
    expect(msg).toContain("- 연락처: 010-2668-6845");
    expect(msg).toContain("- 토픽: 2급");
    expect(msg).toContain("- 비자: D2");
    expect(msg).toContain("- 예약금(시험비): 100,000원");
    expect(msg).toContain("- 특이사항: 시험일정 변경 요청 있음");
    // 푸터 안내 + 클로징
    expect(msg).toContain("※ 예약금은 교육생의 시험비");
    expect(msg).toContain("진행에 궁금하신 점이나");
  });

  it("야간반 라벨 표시", () => {
    const msg = buildNewStudentMessage({
      centerName: "서울 교육원",
      students: [
        {
          name_kr: null,
          name_vi: "Nguyen",
          phone: null,
          visa_type: null,
          birth_year: null,
          topik_level: null,
          reservationAmount: null,
          classStartDate: "2026-03-15",
          classType: "night",
        },
      ],
    });
    expect(msg).toContain("야간반");
    expect(msg).toContain("NGUYEN");
  });

  it("학생 2명 — 인덱스 표시 + 총 인원수", () => {
    const msg = buildNewStudentMessage({
      centerName: "X",
      monthLabel: 5,
      students: [
        {
          name_kr: "A",
          name_vi: null,
          phone: null,
          visa_type: null,
          birth_year: null,
          topik_level: null,
          reservationAmount: null,
          classStartDate: null,
          classType: null,
        },
        {
          name_kr: "B",
          name_vi: null,
          phone: null,
          visa_type: null,
          birth_year: null,
          topik_level: null,
          reservationAmount: null,
          classStartDate: null,
          classType: null,
        },
      ],
    });
    expect(msg).toContain("[5월 신규 교육생 안내]");
    expect(msg).toContain("대상 교육생: 2명");
    expect(msg).toContain("[1/2]");
    expect(msg).toContain("[2/2]");
  });

  it("학생 0명 — 제목 fallback + 0명 표시", () => {
    const msg = buildNewStudentMessage({
      centerName: "X",
      students: [],
    });
    expect(msg).toContain("[신규 교육생 안내]");
    expect(msg).toContain("대상 교육생: 0명");
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
