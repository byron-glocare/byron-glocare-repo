"use server";

import { revalidatePath } from "next/cache";

import { generateCode } from "@/lib/code-generator";
import {
  trainingCenterSchema,
  careHomeSchema,
  type TrainingCenterInput,
  type CareHomeInput,
} from "@/lib/validators";
import { requireCeo } from "./guard";

// "use server" 파일은 async 함수만 export 가능 → 타입은 로컬로 둔다.
type CeoResult = { ok: true; id: string } | { ok: false; error: string };

/**
 * 대표님: 교육원 등록 + 선택한 발굴필요 고객의 플래그 해제.
 *   resolveCustomerIds = 이 등록으로 "교육원 발굴 필요"를 해소할 고객들.
 *   (매칭은 하지 않고 training_center_finding 플래그만 false 로 — 요청 확정 사항)
 */
export async function createCeoTrainingCenter(
  input: TrainingCenterInput,
  resolveCustomerIds: string[]
): Promise<CeoResult> {
  let admin;
  try {
    ({ admin } = await requireCeo());
  } catch {
    return { ok: false, error: "권한이 없습니다." };
  }

  const parsed = trainingCenterSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const code = await generateCode(admin, "training_centers");
  const { data, error } = await admin
    .from("training_centers")
    .insert({ ...parsed.data, code })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  if (resolveCustomerIds.length > 0) {
    const { error: e2 } = await admin
      .from("customer_statuses")
      .update({ training_center_finding: false })
      .in("customer_id", resolveCustomerIds);
    if (e2) {
      return {
        ok: false,
        error: `교육원은 등록됐지만 발굴필요 해제 중 오류: ${e2.message}`,
      };
    }
  }

  revalidatePath("/ceo");
  revalidatePath("/training-centers");
  revalidatePath("/");
  return { ok: true, id: data.id as string };
}

/**
 * 대표님: 요양원 등록 + 선택한 발굴필요 고객의 플래그 해제(care_home_finding).
 */
export async function createCeoCareHome(
  input: CareHomeInput,
  resolveCustomerIds: string[]
): Promise<CeoResult> {
  let admin;
  try {
    ({ admin } = await requireCeo());
  } catch {
    return { ok: false, error: "권한이 없습니다." };
  }

  const parsed = careHomeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const code = await generateCode(admin, "care_homes");
  const { data, error } = await admin
    .from("care_homes")
    .insert({ ...parsed.data, code })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  if (resolveCustomerIds.length > 0) {
    const { error: e2 } = await admin
      .from("customer_statuses")
      .update({ care_home_finding: false })
      .in("customer_id", resolveCustomerIds);
    if (e2) {
      return {
        ok: false,
        error: `요양원은 등록됐지만 발굴필요 해제 중 오류: ${e2.message}`,
      };
    }
  }

  revalidatePath("/ceo");
  revalidatePath("/care-homes");
  revalidatePath("/");
  return { ok: true, id: data.id as string };
}
