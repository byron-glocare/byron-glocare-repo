"use server";

import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";

import { verifyCenterSession } from "@/lib/center/dal";
import { createCenterClient } from "@/lib/supabase/center";
import { createStudentSchema } from "@/lib/center/students/schema";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_ROWS = 500;
const SHEET_NAME = "Sinh viên";
const EXAMPLE_RE = /^\s*\[VÍ DỤ\]/i;

export type ImportRowResult = {
  rowNumber: number;
  status: "ok" | "skipped" | "error";
  message?: string;
  name?: string;
};

export type ImportState =
  | {
      error?: string;
      totalRows?: number;
      okCount?: number;
      skippedCount?: number;
      errorCount?: number;
      rows?: ImportRowResult[];
    }
  | undefined;

/** Excel cell value → string (Date · number 안전 변환) */
function cellToStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(v).trim();
}

export async function uploadStudentsAction(
  _prev: ImportState,
  formData: FormData
): Promise<ImportState> {
  const session = await verifyCenterSession();

  const file = formData.get("file");
  if (!file || !(file instanceof File) || file.size === 0) {
    return { error: "Vui lòng chọn file Excel (.xlsx)" };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { error: `File quá lớn (>${MAX_FILE_SIZE / 1024 / 1024}MB)` };
  }
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return { error: "Chỉ chấp nhận file .xlsx" };
  }

  // 1. 파싱 — SheetJS (xlsx) 사용. exceljs 의 load() 호환성 문제 회피.
  const ab = await file.arrayBuffer();
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(ab, { type: "array", cellDates: true });
  } catch (e) {
    return {
      error: `Không đọc được file (${e instanceof Error ? e.message : "lỗi không xác định"}). Vui lòng dùng mẫu chính thức.`,
    };
  }

  const ws = wb.Sheets[SHEET_NAME];
  if (!ws) {
    return {
      error: `Không tìm thấy sheet "${SHEET_NAME}". Vui lòng dùng mẫu chính thức.`,
    };
  }

  // 2. 행 수집 — header: [A,B,C,...] 위치 기반 매핑, 1행(헤더) skip
  type RawRow = {
    rowNumber: number;
    name: string;
    dob: string;
    passport_no: string;
    phone: string;
    email: string;
    topik_level: string;
    current_visa: string;
    location: string;
    notes: string;
  };

  const HEADER_KEYS = [
    "name",
    "dob",
    "passport_no",
    "phone",
    "email",
    "topik_level",
    "current_visa",
    "location",
    "notes",
  ] as const;

  const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    header: HEADER_KEYS as unknown as string[],
    range: 1, // 헤더 row(0) skip → 데이터는 row 1 부터, Excel 표시 행번호 = index+2
    defval: "",
    raw: false, // 숫자 등 모두 문자열로 (TOPIK '3' 같은 숫자 텍스트 보존)
  });

  const rawRows: RawRow[] = records.map((rec, idx) => ({
    rowNumber: idx + 2, // 사람이 보는 Excel 행번호 (헤더가 1, 데이터 첫 행이 2)
    name: cellToStr(rec.name),
    dob: cellToStr(rec.dob),
    passport_no: cellToStr(rec.passport_no),
    phone: cellToStr(rec.phone),
    email: cellToStr(rec.email),
    topik_level: cellToStr(rec.topik_level),
    current_visa: cellToStr(rec.current_visa),
    location: cellToStr(rec.location),
    notes: cellToStr(rec.notes),
  }));

  if (rawRows.length === 0) {
    return { error: "File không có dữ liệu (chỉ có dòng tiêu đề)." };
  }
  if (rawRows.length > MAX_ROWS) {
    return {
      error: `File có ${rawRows.length} dòng — vượt giới hạn ${MAX_ROWS}. Vui lòng chia nhỏ.`,
    };
  }

  // 3. 행별 처리
  const supabase = await createCenterClient();
  const results: ImportRowResult[] = [];
  let okCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const r of rawRows) {
    // 3-1. [VÍ DỤ] skip
    if (EXAMPLE_RE.test(r.name)) {
      results.push({
        rowNumber: r.rowNumber,
        status: "skipped",
        message: "Dòng ví dụ (đã bỏ qua tự động)",
        name: r.name,
      });
      skippedCount++;
      continue;
    }

    // 3-2. 완전히 빈 행 skip
    const hasAny =
      r.name ||
      r.dob ||
      r.passport_no ||
      r.phone ||
      r.email ||
      r.topik_level ||
      r.current_visa ||
      r.location ||
      r.notes;
    if (!hasAny) {
      results.push({
        rowNumber: r.rowNumber,
        status: "skipped",
        message: "Dòng trống",
      });
      skippedCount++;
      continue;
    }

    // 3-3. zod 검증
    const parsed = createStudentSchema.safeParse(r);
    if (!parsed.success) {
      const fe = parsed.error.flatten().fieldErrors;
      const msgs = Object.entries(fe)
        .map(([k, v]) => (v && v[0] ? `${k}: ${v[0]}` : null))
        .filter(Boolean)
        .join("; ");
      results.push({
        rowNumber: r.rowNumber,
        status: "error",
        message: msgs || "Dữ liệu không hợp lệ",
        name: r.name || undefined,
      });
      errorCount++;
      continue;
    }

    // 3-4. INSERT (org_id 서버 강제)
    const d = parsed.data;
    const { error: insertErr } = await supabase
      .from("study_managed_students")
      .insert({
        org_id: session.org.id,
        name: d.name,
        dob: d.dob ?? null,
        passport_no_encrypted: d.passport_no ?? null,
        phone: d.phone ?? null,
        email: d.email ?? null,
        topik_level: d.topik_level ?? null,
        current_visa: d.current_visa ?? null,
        location: d.location ?? null,
        notes: d.notes ?? null,
      });

    if (insertErr) {
      results.push({
        rowNumber: r.rowNumber,
        status: "error",
        message: `DB: ${insertErr.message}`,
        name: d.name,
      });
      errorCount++;
    } else {
      results.push({
        rowNumber: r.rowNumber,
        status: "ok",
        name: d.name,
      });
      okCount++;
    }
  }

  // 4. 목록 캐시 갱신 (성공 row 있을 때만)
  if (okCount > 0) {
    revalidatePath("/center/students");
  }

  return {
    totalRows: rawRows.length,
    okCount,
    skippedCount,
    errorCount,
    rows: results,
  };
}
