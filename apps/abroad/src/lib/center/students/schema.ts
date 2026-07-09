/**
 * 학생 도메인 zod 스키마.
 *   개별 등록(new) + 엑셀 일괄 업로드(import, 후속) 공용.
 *
 * 출처: B1_student_excel_template.md §3 + B1_schema.sql §4 (study_managed_students).
 */

import { z } from "zod";

export const TOPIK_VALUES = ["1", "2", "3", "4", "5", "6"] as const;
export const VISA_VALUES = ["D-4", "D-2", "none", "other"] as const;
export const LOCATION_VALUES = ["VN", "KR", "other"] as const;

/** 빈 문자열을 undefined 로 (HTML form 기본값 처리) */
export const emptyToUndef = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (v === "" || v === null ? undefined : v), schema);

/** 빈 문자열 또는 "none" 을 undefined 로 (TOPIK 의 'none' 선택지를 null 로 정규화) */
export const noneToUndef = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(
    (v) => {
      if (v === "" || v === null || v === undefined) return undefined;
      if (typeof v === "string" && v.toLowerCase() === "none") return undefined;
      return v;
    },
    schema
  );

export const createStudentSchema = z.object({
  name: z
    .string()
    .min(1, "Vui lòng nhập họ tên")
    .max(100, "Họ tên tối đa 100 ký tự"),
  dob: emptyToUndef(
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày sinh phải có dạng YYYY-MM-DD")
      .optional()
  ),
  passport_no: emptyToUndef(
    z
      .string()
      .regex(
        /^[A-Za-z0-9]{4,20}$/,
        "Số hộ chiếu 4–20 ký tự, chỉ chữ và số"
      )
      .optional()
  ),
  phone: emptyToUndef(
    z
      .string()
      .min(8, "Số điện thoại tối thiểu 8 ký tự")
      .max(20, "Số điện thoại tối đa 20 ký tự")
      .optional()
  ),
  email: emptyToUndef(
    z.string().email("Email không hợp lệ").optional()
  ),
  topik_level: noneToUndef(z.enum(TOPIK_VALUES).optional()),
  current_visa: emptyToUndef(z.enum(VISA_VALUES).optional()),
  location: emptyToUndef(z.enum(LOCATION_VALUES).optional()),
  notes: emptyToUndef(
    z.string().max(500, "Ghi chú tối đa 500 ký tự").optional()
  ),
  // 글로케어(본사) 계정 전용 — 학생을 소속시킬 유학센터(study_centers.id). 일반 센터 계정은 무시.
  target_study_center_id: emptyToUndef(
    z.coerce.number().int().positive().optional()
  ),
});

export type CreateStudentInput = z.infer<typeof createStudentSchema>;
