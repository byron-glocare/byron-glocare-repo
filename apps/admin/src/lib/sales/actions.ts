"use server";

import { revalidatePath } from "next/cache";

import type { ConsultationType } from "@/types/database";
import { requireSales } from "./guard";
import type { IntakeDecision } from "./types";

type SalesResult = { ok: true } | { ok: false; error: string };

/**
 * 영업: 접수 '등록' 결정 설정.
 *   yes=등록 예, no=등록 아니오, persuade=설득 중, none=미선택.
 *   intake_confirmed / intake_abandoned / intake_persuading 세 플래그를 배타적으로 세팅.
 *   customer_statuses 행이 없으면 생성(upsert).
 */
export async function setSalesIntakeDecision(
  customerId: string,
  decision: IntakeDecision
): Promise<SalesResult> {
  let admin;
  try {
    ({ admin } = await requireSales());
  } catch {
    return { ok: false, error: "권한이 없습니다." };
  }

  const flags = {
    intake_confirmed: decision === "yes",
    intake_abandoned: decision === "no",
    intake_persuading: decision === "persuade",
  };

  const { error } = await admin
    .from("customer_statuses")
    .upsert({ customer_id: customerId, ...flags }, { onConflict: "customer_id" });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/sales/customers/${customerId}`);
  revalidatePath("/sales");
  revalidatePath(`/customers/${customerId}`);
  return { ok: true };
}

/**
 * 영업: 상담일지 추가 (AI 분석 없이 단순 기록).
 *   content 는 한국어 본문(content_kr)에 저장. author_id = 로그인 영업 계정.
 */
export async function addSalesConsultation(
  customerId: string,
  consultationType: ConsultationType,
  content: string
): Promise<SalesResult> {
  let admin, user;
  try {
    ({ admin, user } = await requireSales());
  } catch {
    return { ok: false, error: "권한이 없습니다." };
  }

  const body = content.trim();
  if (!body) return { ok: false, error: "상담 내용을 입력하세요." };

  const { error } = await admin.from("customer_consultations").insert({
    customer_id: customerId,
    consultation_type: consultationType,
    content_kr: body,
    tags: [],
    author_id: user.id,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/sales/customers/${customerId}`);
  revalidatePath(`/customers/${customerId}`);
  return { ok: true };
}
