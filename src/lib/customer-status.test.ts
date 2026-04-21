import { describe, it, expect } from "vitest";
import {
  computeBasicInfo,
  computeTrainingReservation,
  computeTraining,
  computeEmployment,
  computeWork,
  computeCustomerStatus,
  type StatusInputs,
} from "./customer-status";

// =============================================================================
// 픽스처 빌더
// =============================================================================

function buildInputs(overrides?: {
  customer?: Partial<StatusInputs["customer"]>;
  status?: Partial<StatusInputs["status"]>;
  reservationPayments?: StatusInputs["reservationPayments"];
  welcomePackPayment?: StatusInputs["welcomePackPayment"];
  smsMessages?: StatusInputs["smsMessages"];
  today?: string;
}): StatusInputs {
  return {
    customer: {
      name_vi: null,
      name_kr: null,
      phone: null,
      address: null,
      gender: null,
      birth_year: null,
      visa_type: null,
      training_center_id: null,
      training_class_id: null,
      care_home_id: null,
      class_start_date: null,
      class_end_date: null,
      work_start_date: null,
      work_end_date: null,
      visa_change_date: null,
      interview_date: null,
      is_waiting: false,
      termination_reason: null,
      ...(overrides?.customer ?? {}),
    },
    status: {
      intake_abandoned: false,
      study_abroad_consultation: false,
      training_center_finding: false,
      training_reservation_abandoned: false,
      certificate_acquired: false,
      training_dropped: false,
      welcome_pack_abandoned: false,
      care_home_finding: false,
      interview_passed: false,
      ...(overrides?.status ?? {}),
    },
    reservationPayments: overrides?.reservationPayments ?? [],
    welcomePackPayment: overrides?.welcomePackPayment ?? null,
    smsMessages: overrides?.smsMessages ?? [],
    today: overrides?.today ?? "2026-04-21",
  };
}

// =============================================================================
// §5.1.1 기초정보 수집
// =============================================================================

describe("computeBasicInfo — §5.1.1", () => {
  it("이름 없고 전화만 있으면 '없음'", () => {
    expect(
      computeBasicInfo({
        name_vi: null,
        name_kr: null,
        phone: "010-1111-2222",
        address: null,
        gender: null,
        birth_year: null,
        visa_type: null,
      } as StatusInputs["customer"])
    ).toBe("없음");
  });

  it("베트남 이름만 + 전화 → '핵심'", () => {
    expect(
      computeBasicInfo({
        name_vi: "Phạm Thị Dung",
        name_kr: null,
        phone: "010-1111-2222",
        address: null,
        gender: null,
        birth_year: null,
        visa_type: null,
      } as StatusInputs["customer"])
    ).toBe("핵심");
  });

  it("한국 이름 + 전화 → '핵심'", () => {
    expect(
      computeBasicInfo({
        name_vi: null,
        name_kr: "팜 티 중",
        phone: "010-1111-2222",
        address: null,
        gender: null,
        birth_year: null,
        visa_type: null,
      } as StatusInputs["customer"])
    ).toBe("핵심");
  });

  it("모든 개인정보 입력 시 '완벽'", () => {
    expect(
      computeBasicInfo({
        name_vi: "Phạm Thị Dung",
        name_kr: "팜 티 중",
        phone: "010-1111-2222",
        address: "서울시 강남구",
        gender: "여",
        birth_year: 1995,
        visa_type: "D-10",
      } as StatusInputs["customer"])
    ).toBe("완벽");
  });

  it("이름만 있고 전화 없으면 '없음'", () => {
    expect(
      computeBasicInfo({
        name_vi: "Phạm",
        name_kr: null,
        phone: null,
        address: null,
        gender: null,
        birth_year: null,
        visa_type: null,
      } as StatusInputs["customer"])
    ).toBe("없음");
  });

  it("공백만 있는 경우 '없음'", () => {
    expect(
      computeBasicInfo({
        name_kr: "   ",
        name_vi: null,
        phone: "  ",
        address: null,
        gender: null,
        birth_year: null,
        visa_type: null,
      } as StatusInputs["customer"])
    ).toBe("없음");
  });
});

// =============================================================================
// §5.1.2 교육 예약 단계
// =============================================================================

describe("computeTrainingReservation — §5.1.2", () => {
  it("모든 조건 만족 시 complete = true", () => {
    const r = computeTrainingReservation(
      buildInputs({
        customer: {
          training_center_id: "tc-1",
          training_class_id: "tcls-1",
        },
        reservationPayments: [{ payment_date: "2026-04-01" }],
      })
    );
    expect(r.complete).toBe(true);
    expect(r.centerMatched).toBe(true);
    expect(r.classMatched).toBe(true);
    expect(r.reservationPaid).toBe(true);
  });

  it("교육원 발굴 플래그 true면 complete = false", () => {
    const r = computeTrainingReservation(
      buildInputs({
        status: { training_center_finding: true } as any,
        customer: {
          training_center_id: "tc-1",
          training_class_id: "tcls-1",
        },
        reservationPayments: [{ payment_date: "2026-04-01" }],
      })
    );
    expect(r.complete).toBe(false);
    expect(r.centerFinding).toBe(true);
  });

  it("예약 포기 시 complete = false", () => {
    const r = computeTrainingReservation(
      buildInputs({
        status: { training_reservation_abandoned: true } as any,
      })
    );
    expect(r.abandoned).toBe(true);
    expect(r.complete).toBe(false);
  });

  it("SMS 발송 이력이 있으면 smsSent = true", () => {
    const r = computeTrainingReservation(
      buildInputs({
        smsMessages: [{ message_type: "new_student" }],
      })
    );
    expect(r.smsSent).toBe(true);
  });
});

// =============================================================================
// §5.1.3 교육 단계
// =============================================================================

describe("computeTraining — §5.1.3", () => {
  it("강의일정 정보 없으면 phase = null", () => {
    const r = computeTraining(buildInputs());
    expect(r.phase).toBeNull();
  });

  it("오늘 < class_start_date → phase = '전'", () => {
    const r = computeTraining(
      buildInputs({
        customer: {
          class_start_date: "2026-05-01",
          class_end_date: "2026-07-01",
        },
        today: "2026-04-21",
      })
    );
    expect(r.phase).toBe("전");
  });

  it("오늘이 사이에 있으면 phase = '중'", () => {
    const r = computeTraining(
      buildInputs({
        customer: {
          class_start_date: "2026-04-01",
          class_end_date: "2026-07-01",
        },
        today: "2026-04-21",
      })
    );
    expect(r.phase).toBe("중");
  });

  it("오늘 >= class_end_date → phase = '완료'", () => {
    const r = computeTraining(
      buildInputs({
        customer: {
          class_start_date: "2026-02-01",
          class_end_date: "2026-03-15",
        },
        today: "2026-04-21",
      })
    );
    expect(r.phase).toBe("완료");
  });

  it("교육 완료 + SMS + 자격증 취득 시 complete = true", () => {
    const r = computeTraining(
      buildInputs({
        customer: {
          class_start_date: "2026-02-01",
          class_end_date: "2026-03-15",
        },
        status: { certificate_acquired: true } as any,
        smsMessages: [{ message_type: "new_student" }],
        today: "2026-04-21",
      })
    );
    expect(r.complete).toBe(true);
  });

  it("교육 드랍 플래그 시 complete = false", () => {
    const r = computeTraining(
      buildInputs({
        customer: {
          class_start_date: "2026-02-01",
          class_end_date: "2026-03-15",
        },
        status: {
          certificate_acquired: true,
          training_dropped: true,
        } as any,
        smsMessages: [{ message_type: "new_student" }],
        today: "2026-04-21",
      })
    );
    expect(r.complete).toBe(false);
    expect(r.dropped).toBe(true);
  });
});

// =============================================================================
// §5.1.4 취업 단계
// =============================================================================

describe("computeEmployment — §5.1.4", () => {
  it("요양원 매칭 + 면접합격 + 웰컴팩 예약 + 미포기 → complete", () => {
    const r = computeEmployment(
      buildInputs({
        customer: { care_home_id: "ch-1" },
        status: { interview_passed: true } as any,
        welcomePackPayment: { reservation_date: "2026-03-01" },
      })
    );
    expect(r.complete).toBe(true);
  });

  it("웰컴팩 예약 포기 시 complete = false", () => {
    const r = computeEmployment(
      buildInputs({
        customer: { care_home_id: "ch-1" },
        status: {
          interview_passed: true,
          welcome_pack_abandoned: true,
        } as any,
        welcomePackPayment: { reservation_date: "2026-03-01" },
      })
    );
    expect(r.complete).toBe(false);
  });

  it("요양원 발굴 중 플래그 true면 complete = false", () => {
    const r = computeEmployment(
      buildInputs({
        customer: { care_home_id: "ch-1" },
        status: {
          interview_passed: true,
          care_home_finding: true,
        } as any,
        welcomePackPayment: { reservation_date: "2026-03-01" },
      })
    );
    expect(r.complete).toBe(false);
  });

  it("면접일 이전 → interviewPhase = '전'", () => {
    const r = computeEmployment(
      buildInputs({
        customer: { interview_date: "2026-05-01" },
        today: "2026-04-21",
      })
    );
    expect(r.interviewPhase).toBe("전");
  });

  it("면접일 이후 → interviewPhase = '후'", () => {
    const r = computeEmployment(
      buildInputs({
        customer: { interview_date: "2026-04-01" },
        today: "2026-04-21",
      })
    );
    expect(r.interviewPhase).toBe("후");
  });
});

// =============================================================================
// §5.1.5 근무 단계
// =============================================================================

describe("computeWork — §5.1.5", () => {
  it("work_start_date 이전 → workPhase = '전'", () => {
    const r = computeWork(
      buildInputs({
        customer: { work_start_date: "2026-05-01" },
        today: "2026-04-21",
      })
    );
    expect(r.workPhase).toBe("전");
  });

  it("work_start_date 이후 + work_end_date null → workPhase = '중'", () => {
    const r = computeWork(
      buildInputs({
        customer: { work_start_date: "2026-03-01" },
        today: "2026-04-21",
      })
    );
    expect(r.workPhase).toBe("중");
  });

  it("work_end_date 존재 → workPhase = '종료'", () => {
    const r = computeWork(
      buildInputs({
        customer: {
          work_start_date: "2026-03-01",
          work_end_date: "2026-04-15",
        },
        today: "2026-04-21",
      })
    );
    expect(r.workPhase).toBe("종료");
  });

  it("work_start + 30일 이전 → visaChangePhase = '대기'", () => {
    const r = computeWork(
      buildInputs({
        customer: { work_start_date: "2026-04-01" },
        today: "2026-04-20",
      })
    );
    expect(r.visaChangePhase).toBe("대기");
  });

  it("work_start + 30일 이후 + visa_change_date null → '중'", () => {
    const r = computeWork(
      buildInputs({
        customer: { work_start_date: "2026-03-01" },
        today: "2026-04-21",
      })
    );
    expect(r.visaChangePhase).toBe("중");
  });

  it("visa_change_date 존재 → '완료'", () => {
    const r = computeWork(
      buildInputs({
        customer: {
          work_start_date: "2026-02-01",
          visa_change_date: "2026-03-15",
        },
        today: "2026-04-21",
      })
    );
    expect(r.visaChangePhase).toBe("완료");
  });
});

// =============================================================================
// 통합 — 플래그 체인 & 현재 단계
// =============================================================================

describe("computeCustomerStatus — 통합", () => {
  it("접수포기 → currentStage = '종료' / label = '접수 포기'", () => {
    const r = computeCustomerStatus(
      buildInputs({
        customer: {
          name_kr: "홍길동",
          phone: "010-0000-0000",
        },
        status: { intake_abandoned: true } as any,
      })
    );
    expect(r.currentStage).toBe("종료");
    expect(r.label).toBe("접수 포기");
  });

  it("유학상담 → currentStage = '종료'", () => {
    const r = computeCustomerStatus(
      buildInputs({
        customer: {
          name_kr: "홍길동",
          phone: "010-0000-0000",
        },
        status: { study_abroad_consultation: true } as any,
      })
    );
    expect(r.currentStage).toBe("종료");
  });

  it("기초정보 없음 → currentStage = '접수중'", () => {
    const r = computeCustomerStatus(
      buildInputs({
        customer: { name_kr: "A" }, // 전화 없음
      })
    );
    expect(r.currentStage).toBe("접수중");
  });

  it("근무중 + 비자변경 대기 → label 에 표시", () => {
    const r = computeCustomerStatus(
      buildInputs({
        customer: {
          name_kr: "홍",
          phone: "010-0000-0000",
          work_start_date: "2026-04-10",
        },
        today: "2026-04-21",
      })
    );
    expect(r.currentStage).toBe("근무중");
    expect(r.label).toContain("근무 중");
    expect(r.label).toContain("대기");
  });

  it("waiting=true 이면 currentStage = '대기중' (포기 상태보다 우선 아님)", () => {
    // 접수 완료 + waiting
    const r = computeCustomerStatus(
      buildInputs({
        customer: {
          name_kr: "홍",
          phone: "010-0000-0000",
          is_waiting: true,
        },
      })
    );
    expect(r.currentStage).toBe("대기중");
  });

  it("termination_reason 이 최우선", () => {
    const r = computeCustomerStatus(
      buildInputs({
        customer: {
          name_kr: "홍",
          phone: "010-0000-0000",
          is_waiting: true,
          termination_reason: "귀국",
        },
      })
    );
    expect(r.currentStage).toBe("종료");
    expect(r.label).toContain("귀국");
  });

  it("교육원 발굴 플래그 → label 에 '교육원 발굴 중'", () => {
    const r = computeCustomerStatus(
      buildInputs({
        customer: {
          name_kr: "홍",
          phone: "010-0000-0000",
        },
        status: { training_center_finding: true } as any,
      })
    );
    expect(r.currentStage).toBe("교육예약중");
    expect(r.label).toBe("교육원 발굴 중");
  });
});
