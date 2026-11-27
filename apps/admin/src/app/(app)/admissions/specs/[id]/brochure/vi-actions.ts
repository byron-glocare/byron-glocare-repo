"use server";

import { revalidatePath } from "next/cache";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isGlocareAdmin } from "@/lib/admin-guard";
import { translateTextsToVi } from "@/lib/admission/translate-vi";
import { refreshSpecLegacyCaches } from "@/lib/admission/spec-departments";
import type { ViTarget } from "@/lib/admission/brochure-vi-gaps";
import type { Json } from "@/types/database";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function guard(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user && isGlocareAdmin(user) ? null : "권한이 없습니다";
}

/** 빈 칸 AI 번역 — 저장하지 않는다. 화면 칸을 채우고 사람이 확인·저장. */
export async function translateViGapsAction(items: Array<{ where: string; text: string }>): Promise<Result<{ items: string[] }>> {
  const denied = await guard();
  if (denied) return { ok: false, error: denied };
  if (!Array.isArray(items) || items.length > 300) return { ok: false, error: "한 번에 번역할 칸이 너무 많습니다" };
  return translateTextsToVi(items);
}

/** 확인한 베트남어 저장 — 칸마다 원래 자리(대학·학과·장학금·학비·서류·양식)에 넣는다 */
export async function saveViGapsAction(
  specId: string,
  entries: Array<{ target: ViTarget; value: string }>
): Promise<Result<{ saved: number }>> {
  const denied = await guard();
  if (denied) return { ok: false, error: denied };
  const list = (entries ?? []).filter((e) => e && typeof e.value === "string" && e.value.trim());
  if (list.length === 0) return { ok: false, error: "저장할 베트남어가 없습니다" };

  const admin = createAdminClient();
  const [{ data: spec }, { data: depts }] = await Promise.all([
    admin.from("study_admission_specs").select("id, university_id").eq("id", specId).maybeSingle(),
    admin.from("study_spec_departments").select("id, department_id, tuition, scholarships").eq("spec_id", specId),
  ]);
  if (!spec) return { ok: false, error: "모집요강을 찾지 못했습니다" };
  const sdById = new Map((depts ?? []).map((d) => [d.id, { ...d }]));
  const deptIds = new Set((depts ?? []).map((d) => d.department_id));
  const touchedSd = new Set<string>();
  const uniPatch: { name_vi?: string; region_vi?: string; dormitory_desc_vi?: string } = {};

  for (const { target: t, value: raw } of list) {
    const value = raw.trim();
    switch (t.kind) {
      case "university":
        if (!["name_vi", "region_vi", "dormitory_desc_vi"].includes(t.field)) return { ok: false, error: "잘못된 대학 칸" };
        uniPatch[t.field] = value;
        break;
      case "department": {
        if (!deptIds.has(t.departmentId)) return { ok: false, error: "이 요강의 학과가 아닙니다" };
        const { error } = await admin.from("departments").update({ name_vi: value }).eq("id", t.departmentId);
        if (error) return { ok: false, error: `학과 이름 저장 실패: ${error.message}` };
        break;
      }
      case "scholarship": {
        const sd = sdById.get(t.sdId);
        const list = Array.isArray(sd?.scholarships) ? [...(sd!.scholarships as Array<Record<string, unknown>>)] : null;
        if (!sd || !list?.[t.index] || !["name_vi", "condition_vi", "benefit_vi", "duration_vi", "notes_vi"].includes(t.field))
          return { ok: false, error: "장학금을 찾지 못했습니다" };
        list[t.index] = { ...list[t.index], [t.field]: value };
        sd.scholarships = list as Json;
        touchedSd.add(sd.id);
        break;
      }
      case "faculty_fee":
      case "other_fee": {
        const sd = sdById.get(t.sdId);
        if (!sd) return { ok: false, error: "학과를 찾지 못했습니다" };
        const tuition = { ...((sd.tuition ?? {}) as Record<string, unknown>) };
        if (t.kind === "faculty_fee") {
          tuition.tuition_by_faculty_vi = { ...((tuition.tuition_by_faculty_vi ?? {}) as Record<string, string>), [t.key]: value };
        } else {
          const fees = Array.isArray(tuition.other_fees) ? [...(tuition.other_fees as Array<Record<string, unknown>>)] : [];
          if (!fees[t.index]) return { ok: false, error: "기타 비용을 찾지 못했습니다" };
          fees[t.index] = { ...fees[t.index], name_vi: value };
          tuition.other_fees = fees;
        }
        sd.tuition = tuition as Json;
        touchedSd.add(sd.id);
        break;
      }
      case "form": {
        const { error } = await admin
          .from("study_admission_form_files")
          .update({ name_vi: value })
          .eq("id", t.formId)
          .eq("university_id", spec.university_id);
        if (error) return { ok: false, error: `양식 이름 저장 실패: ${error.message}` };
        break;
      }
      case "doc_standard": {
        const { error } = await admin.from("study_doc_standards").update({ name_vi: value }).eq("key", t.key);
        if (error) return { ok: false, error: `서류 이름 저장 실패: ${error.message}` };
        break;
      }
      case "doc_guide": {
        if (!sdById.has(t.sdId)) return { ok: false, error: "학과를 찾지 못했습니다" };
        const { error } = await admin
          .from("study_spec_doc_items")
          .update({ guide_override_vi: value })
          .eq("spec_id", specId)
          .eq("spec_department_id", t.sdId)
          .eq("item_key", t.itemKey);
        if (error) return { ok: false, error: `서류 안내 저장 실패: ${error.message}` };
        break;
      }
      default:
        return { ok: false, error: "알 수 없는 칸" };
    }
  }

  if (Object.keys(uniPatch).length > 0) {
    const { error } = await admin.from("universities").update(uniPatch).eq("id", spec.university_id);
    if (error) return { ok: false, error: `대학 저장 실패: ${error.message}` };
  }
  for (const id of touchedSd) {
    const sd = sdById.get(id)!;
    const { error } = await admin
      .from("study_spec_departments")
      .update({ tuition: sd.tuition, scholarships: sd.scholarships, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return { ok: false, error: `학과 저장 실패: ${error.message}` };
  }
  if (touchedSd.size > 0) await refreshSpecLegacyCaches(admin, specId);

  revalidatePath(`/admissions/specs/${specId}`);
  revalidatePath(`/admissions/specs/${specId}/brochure`);
  return { ok: true, saved: list.length };
}
