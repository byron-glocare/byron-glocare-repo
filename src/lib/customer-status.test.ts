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
      product_type: null,
      is_waiting: false,
      recontact_date: null,
      waiting_memo: null,
      termination_reason: null,
      ...(overrides?.customer ?? {}),
    },
    status: {
      intake_abandoned: false,
      // 0013: 기본 시나리오에서는 등록(=진행) 결정된 상태로 가정 (운영 데이터 backfill 과 동일)
      intake_confirmed: true,
      study_abroad_consultation: false,
      training_center_finding: false,
      class_schedule_confirmation_needed: false,
      training_reservation_abandoned: false,
      class_intake_sms_sent: false,
      certificate_acquired: false,
      training_dropped: false,
      welcome_pack_abandoned: false,
      health_check_completed: false,
      care_home_finding: false,
      resume_sent: false,
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
  it("4가지 조건 모두 만족 시 complete = true (교육원·강의·예약금·SMS)", () => {
    const r = computeTrainingReservation(
      buildInputs({
        customer: {
          training_center_id: "tc-1",
          training_class_id: "tcls-1",
        },
        status: { class_intake_sms_sent: true } as any,
        reservationPayments: [{ payment_date: "2026-04-01" }],
      })
    );
    expect(r.complete).toBe(true);
    expect(r.centerMatched).toBe(true);
    expect(r.classMatched).toBe(true);
    expect(r.reservationPaid).toBe(true);
    expect(r.smsSent).toBe(true);
  });

  it("4가지 중 하나 (예: SMS) 미충족 시 complete = false", () => {
    const r = computeTrainingReservation(
      buildInputs({
        customer: {
          training_center_id: "tc-1",
          training_class_id: "tcls-1",
        },
        // class_intake_sms_sent 기본값 false
        reservationPayments: [{ payment_date: "2026-04-01" }],
      })
    );
    expect(r.complete).toBe(false);
    expect(r.smsSent).toBe(false);
  });

  it("smsSent 는 0008 이후 수기 플래그 (status.class_intake_sms_sent)", () => {
    const r = computeTrainingReservation(
      buildInputs({
        status: { class_intake_sms_sent: true } as any,
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

  it("자격증 미취득 시 complete = false", () => {
    const r = computeTraining(
      buildInputs({
        customer: {
          class_start_date: "2026-02-01",
          class_end_date: "2026-03-15",
        },
        status: { certificate_acquired: false } as any,
        today: "2026-04-21",
      })
    );
    expect(r.complete).toBe(false);
    expect(r.certificateAcquired).toBe(false);
  });

  it("교육 드랍 플래그 — 완료와는 별개 (terminal 잠금은 stage-locks 책임)", () => {
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
        today: "2026-04-21",
      })
    );
    // 자격증 취득 = complete=true. 드랍 여부와 무관.
    expect(r.complete).toBe(true);
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

  it("웰컴팩 예약 포기 + 예약금 입금 — 포기는 terminal 책임, complete 와 별개", () => {
    const r = computeEmployment(
      buildInputs({
        customer: { care_home_id: "ch-1", product_type: "웰컴팩" },
        status: {
          interview_passed: true,
          welcome_pack_abandoned: true,
        } as any,
        welcomePackPayment: { reservation_date: "2026-03-01" },
      })
    );
    // welcomePackReservationPaid=true 이면 complete=true. 포기는 stage-locks 가 잠금.
    expect(r.complete).toBe(true);
    expect(r.welcomePackAbandoned).toBe(true);
  });

  it("상품='교육' 고객(자체취업)은 웰컴팩 요건 없이도 complete", () => {
    const r = computeEmployment(
      buildInputs({
        customer: { care_home_id: "ch-1", product_type: "교육" },
        status: { interview_passed: true } as any,
        welcomePackPayment: null, // 웰컴팩 예약 없음
      })
    );
    expect(r.complete).toBe(true);
  });

  it("상품='웰컴팩' 이면 예약금 없으면 complete = false", () => {
    const r = computeEmployment(
      buildInputs({
        customer: { care_home_id: "ch-1", product_type: "웰컴팩" },
        status: { interview_passed: true } as any,
        welcomePackPayment: null,
      })
    );
    expect(r.complete).toBe(false);
  });

  it("요양원 발굴 중 플래그는 careHomeFinding 만 노출, complete 직접 영향 없음", () => {
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
    // care_home_id 설정 → careHomeMatched=true → complete=true.
    // care_home_finding 은 자동 reset 트리거 대상 (서버 액션이 처리).
    expect(r.complete).toBe(true);
    expect(r.careHomeFinding).toBe(true);
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

  it("교육원 매칭 됐지만 강의 일정 확인 필요 → '강의 일정 확인'", () => {
    const r = computeCustomerStatus(
      buildInputs({
        customer: {
          name_kr: "홍",
          phone: "010-0000-0000",
          training_center_id: "tc-1",
        },
        status: { class_schedule_confirmation_needed: true } as any,
      })
    );
    expect(r.currentStage).toBe("교육예약중");
    expect(r.label).toBe("강의 일정 확인");
  });

  it("예약금 입금까지 완료 + 메시지 미발송 → '강의 접수 메시지 발송 대기'", () => {
    const r = computeCustomerStatus(
      buildInputs({
        customer: {
          name_kr: "홍",
          phone: "010-0000-0000",
          training_center_id: "tc-1",
          training_class_id: "cls-1",
        },
        reservationPayments: [{ payment_date: "2026-04-01" }],
      })
    );
    expect(r.trainingReservation.complete).toBe(false);
    expect(r.currentStage).toBe("교육예약중");
    expect(r.label).toBe("강의 접수 메시지 발송 대기");
  });

  it("자격증 취득 + 요양원 매칭됨 + 이력서 미발송 → '이력서 발송 대기'", () => {
    const r = computeCustomerStatus(
      buildInputs({
        customer: {
          name_kr: "홍",
          phone: "010-0000-0000",
          training_center_id: "tc-1",
          training_class_id: "cls-1",
          class_start_date: "2026-01-01",
          class_end_date: "2026-03-01",
          care_home_id: "ch-1",
          // 웰컴팩 미신청 (product_type='교육') 은 자격증 취득 시 종료 처리되므로
          // 취업 단계 cascade 검증에는 '교육+웰컴팩' 로 진행 흐름 사용
          product_type: "교육+웰컴팩",
        },
        status: {
          certificate_acquired: true,
          resume_sent: false,
        } as any,
        today: "2026-04-01",
      })
    );
    expect(r.currentStage).toBe("취업중");
    expect(r.label).toBe("이력서 발송 대기");
  });

  it("취업 모든 체크포인트 완료 + 근무 미시작 → '근무 시작 대기'", () => {
    const r = computeCustomerStatus(
      buildInputs({
        customer: {
          name_kr: "홍",
          phone: "010-0000-0000",
          training_center_id: "tc-1",
          training_class_id: "cls-1",
          class_start_date: "2026-01-01",
          class_end_date: "2026-03-01",
          care_home_id: "ch-1",
          interview_date: "2026-03-15",
          product_type: "교육+웰컴팩",
        },
        status: {
          certificate_acquired: true,
          resume_sent: true,
          interview_passed: true,
        } as any,
        welcomePackPayment: { reservation_date: "2026-03-20" },
        today: "2026-04-01",
      })
    );
    expect(r.currentStage).toBe("취업중");
    expect(r.label).toBe("근무 시작 대기");
  });

  it("교육만 신청 (product_type='교육') + 자격증 취득 → 종료 (웰컴팩 미신청)", () => {
    const r = computeCustomerStatus(
      buildInputs({
        customer: {
          name_kr: "홍",
          phone: "010-0000-0000",
          training_center_id: "tc-1",
          training_class_id: "cls-1",
          class_start_date: "2026-01-01",
          class_end_date: "2026-03-01",
          product_type: "교육",
        },
        status: {
          certificate_acquired: true,
        } as any,
        today: "2026-04-01",
      })
    );
    expect(r.currentStage).toBe("종료");
    expect(r.label).toBe("교육 완료 (웰컴팩 미신청)");
  });
});
