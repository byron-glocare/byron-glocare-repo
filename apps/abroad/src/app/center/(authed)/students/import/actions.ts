"use server";

import { getLocale, trAsync } from "@/lib/i18n";

import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";

import { verifyCenterSession } from "@/lib/center/dal";
import { createCenterClient } from "@/lib/supabase/center";
import { createServiceClient } from "@/lib/supabase/service";
import { createStudentSchema } from "@/lib/center/students/schema";
import {
  ROSTER_COLUMNS,
  ROSTER_INPUT_COLUMNS,
  type RosterColumn,
} from "@/lib/center/student-roster-columns";
import {
  REG_FIELDS,
  normalizeRegistration,
  rosterRowToRaw,
} from "@/lib/center/students/registration";
import {
  loadKnownDataKeys,
  writeRegistrationValues,
} from "@/lib/center/students/save-registration";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_ROWS = 500;
const SHEET_NAME = "Sinh viên";
const EXAMPLE_RE = /^\s*\[VÍ DỤ\]/i;
/** 머리글 글자로 찾은 칸이 이보다 적으면 양식이 다른 파일로 본다 */
const MIN_TEXT_MATCHES = 5;

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

// ──────────────────────────────────────────────────────────────
// 머리글(2줄) 해석
// ──────────────────────────────────────────────────────────────

function norm(s: string): string {
  return s
    .normalize("NFC")
    .toLowerCase()
    .replace(/[\s·.,\-_()*:'"’]+/g, "");
}

/** 머리글 글자와 정의 라벨이 같은 칸인가 — "한국어 / Tiếng Việt" 중 한쪽만 맞아도 인정 */
function labelMatches(header: string, label: string): boolean {
  const h = header.trim();
  if (!h) return false;
  if (norm(h) === norm(label)) return true;
  const hParts = h.split("/").map(norm).filter(Boolean);
  const lParts = label.split("/").map(norm).filter(Boolean);
  return hParts.some((p) => lParts.includes(p));
}

type HeaderCell = { group: string; sub: string };

function headerMatches(h: HeaderCell | undefined, c: RosterColumn): boolean {
  if (!h) return false;
  if (!labelMatches(h.group, c.group)) return false;
  if (c.sub) return labelMatches(h.sub, c.sub);
  return !h.sub || norm(h.sub) === norm(h.group);
}

function cellText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString();
  return String(v).trim();
}

function isBlank(v: unknown): boolean {
  return cellText(v) === "";
}

export async function uploadStudentsAction(
  _prev: ImportState,
  formData: FormData
): Promise<ImportState> {
  const session = await verifyCenterSession();
  const locale = await getLocale();

  const file = formData.get("file");
  if (!file || !(file instanceof File) || file.size === 0) {
    return { error: await trAsync("엑셀 파일(.xlsx)을 선택하세요", "Vui lòng chọn file Excel (.xlsx)") };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { error: await trAsync(`파일이 너무 큽니다 (>${MAX_FILE_SIZE / 1024 / 1024}MB)`, `File quá lớn (>${MAX_FILE_SIZE / 1024 / 1024}MB)`) };
  }
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return { error: await trAsync(".xlsx 파일만 올릴 수 있습니다", "Chỉ chấp nhận file .xlsx") };
  }

  // 1. 파싱 — SheetJS (xlsx) 사용. exceljs 의 load() 호환성 문제 회피.
  const ab = await file.arrayBuffer();
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(ab, { type: "array", cellDates: true });
  } catch (e) {
    return {
      error: `${await trAsync("파일을 읽지 못했습니다", "Không đọc được file")} (${e instanceof Error ? e.message : "?"}).`,
    };
  }

  // 시트: "Sinh viên" 우선, 없으면 첫 시트 (운영자 원본 파일 이름이 다를 수 있음)
  const ws = wb.Sheets[SHEET_NAME] ?? wb.Sheets[wb.SheetNames[0]];
  if (!ws || !ws["!ref"]) {
    return {
      error: await trAsync(
        `"${SHEET_NAME}" 시트를 찾을 수 없습니다. 공식 양식을 사용하세요.`,
        `Không tìm thấy sheet "${SHEET_NAME}". Vui lòng dùng mẫu chính thức.`
      ),
    };
  }

  // 시트 좌표 그대로 (A1 부터) 읽기 → 배열 index = 엑셀 행-1 / 열-1
  const ref = XLSX.utils.decode_range(ws["!ref"]);
  const grid = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    range: { s: { r: 0, c: 0 }, e: ref.e },
    defval: "",
    blankrows: true,
    raw: true,
  });

  // 2. 머리글 2줄 — 병합 셀은 왼쪽 위 셀에만 값이 있으므로 병합 범위로 채운다
  const width = Math.max(ref.e.c + 1, 0);
  const top: string[] = [];
  const sub: string[] = [];
  for (let c = 0; c < width; c++) {
    top[c] = cellText(grid[0]?.[c]);
    sub[c] = cellText(grid[1]?.[c]);
  }
  for (const m of ws["!merges"] ?? []) {
    if (m.s.r > 1) continue;
    const v = cellText(grid[m.s.r]?.[m.s.c]);
    for (let r = m.s.r; r <= Math.min(m.e.r, 1); r++) {
      for (let c = m.s.c; c <= m.e.c; c++) {
        if (r === 0 && !top[c]) top[c] = v;
        if (r === 1 && !sub[c]) sub[c] = v;
      }
    }
  }
  const headers: HeaderCell[] = top.map((g, c) => ({ group: g, sub: sub[c] }));

  // 3. 칸 찾기 — ① 그룹+하위 글자 ② 못 찾으면 위치(운영자 원본 = 전체 칸 / 우리 양식 = 입력 칸)
  const claimed = new Set<number>();
  const colIndex = new Map<RosterColumn, number>();
  for (const col of ROSTER_INPUT_COLUMNS) {
    const idx = headers.findIndex((h, i) => !claimed.has(i) && headerMatches(h, col));
    if (idx >= 0) {
      colIndex.set(col, idx);
      claimed.add(idx);
    }
  }
  const textMatches = colIndex.size;
  if (textMatches < MIN_TEXT_MATCHES) {
    return {
      error: await trAsync(
        "머리글이 양식과 맞지 않습니다. '양식 다운로드'로 받은 새 양식(머리글 2줄)을 사용하세요.",
        "Tiêu đề không khớp với mẫu. Vui lòng tải mẫu mới (tiêu đề 2 dòng) và nhập lại."
      ),
    };
  }
  const layoutScore = (layout: RosterColumn[]) =>
    layout.reduce((n, col, i) => n + (headerMatches(headers[i], col) ? 1 : 0), 0);
  const layout =
    layoutScore(ROSTER_COLUMNS) >= layoutScore(ROSTER_INPUT_COLUMNS)
      ? ROSTER_COLUMNS
      : ROSTER_INPUT_COLUMNS;
  for (const col of ROSTER_INPUT_COLUMNS) {
    if (colIndex.has(col)) continue;
    const pos = layout.indexOf(col);
    if (pos >= 0 && pos < width && !claimed.has(pos)) {
      colIndex.set(col, pos);
      claimed.add(pos);
    }
  }

  // 4. 데이터 행 (3행부터). 뒤쪽 빈 행은 잘라낸다.
  const valueCols = ROSTER_INPUT_COLUMNS.filter(
    (c) => c.special !== "seq" && c.special !== "absence_total" && c.special !== "income_total"
  );
  type RawRow = { rowNumber: number; cells: Array<{ column: RosterColumn; value: unknown }> };
  const dataRows: RawRow[] = [];
  for (let r = 2; r < grid.length; r++) {
    const row = grid[r] ?? [];
    const cells = valueCols
      .filter((c) => colIndex.has(c))
      .map((c) => ({ column: c, value: row[colIndex.get(c)!] }));
    dataRows.push({ rowNumber: r + 1, cells });
  }
  while (dataRows.length > 0 && dataRows[dataRows.length - 1].cells.every((c) => isBlank(c.value))) {
    dataRows.pop();
  }

  if (dataRows.length === 0) {
    return { error: await trAsync("데이터가 없습니다 (머리글만 있습니다).", "File không có dữ liệu (chỉ có dòng tiêu đề).") };
  }
  const nonEmpty = dataRows.filter((r) => r.cells.some((c) => !isBlank(c.value))).length;
  if (nonEmpty > MAX_ROWS) {
    return {
      error: await trAsync(
        `${nonEmpty}행 — 한 번에 ${MAX_ROWS}행까지입니다. 나눠서 올려 주세요.`,
        `File có ${nonEmpty} dòng — vượt giới hạn ${MAX_ROWS}. Vui lòng chia nhỏ.`
      ),
    };
  }

  // 5. 행별 처리
  const supabase = await createCenterClient();
  const svc = createServiceClient();
  const knownKeys = await loadKnownDataKeys(svc, [
    ...Object.keys(REG_FIELDS).filter((k) => k !== "name"),
    "home_country_address",
    "full_name_vi",
  ]);

  const results: ImportRowResult[] = [];
  let okCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const r of dataRows) {
    const raw = rosterRowToRaw(r.cells);
    const nameText = cellText(raw.name);

    // 5-1. 완전히 빈 행 skip
    if (r.cells.every((c) => isBlank(c.value))) {
      results.push({ rowNumber: r.rowNumber, status: "skipped", message: await trAsync("빈 행", "Dòng trống") });
      skippedCount++;
      continue;
    }

    // 5-2. [VÍ DỤ] 예시 행 skip
    if (EXAMPLE_RE.test(nameText)) {
      results.push({
        rowNumber: r.rowNumber,
        status: "skipped",
        message: await trAsync("예시 행 (자동으로 건너뜀)", "Dòng ví dụ (đã bỏ qua tự động)"),
        name: nameText,
      });
      skippedCount++;
      continue;
    }

    // 5-3. 정규화 + 필수 검사 + 학생 기본 칸 형식 검사
    const reg = normalizeRegistration(raw, locale);
    const msgs = Object.values(reg.errors);
    const parsed = createStudentSchema.safeParse({
      name: reg.student.name,
      dob: reg.student.dob ?? "",
      passport_no: reg.student.passport_no ?? "",
      phone: reg.student.phone ?? "",
      email: reg.student.email ?? "",
      topik_level: reg.student.topik_level ?? "",
    });
    if (!parsed.success) {
      const label: Record<string, string> = {
        name: REG_FIELDS.name.id,
        dob: "birth_date",
        passport_no: "passport_no",
        phone: "student_phone",
        email: "student_email",
      };
      for (const [k, v] of Object.entries(parsed.error.flatten().fieldErrors)) {
        const m = (v as string[] | undefined)?.[0];
        const fid = label[k] ?? k;
        if (m && !reg.errors[fid]) {
          const f = REG_FIELDS[fid];
          msgs.push(`${f ? (locale === "ko" ? f.ko : f.vi) : k}: ${m}`);
        }
      }
    }
    if (msgs.length > 0 || !parsed.success) {
      results.push({
        rowNumber: r.rowNumber,
        status: "error",
        message: msgs.join("; ") || (await trAsync("올바르지 않은 데이터", "Dữ liệu không hợp lệ")),
        name: nameText || undefined,
      });
      errorCount++;
      continue;
    }

    // 5-4. INSERT (org_id 서버 강제)
    const d = parsed.data;
    const { data: inserted, error: insertErr } = await supabase
      .from("study_managed_students")
      .insert({
        org_id: session.org.id,
        name: d.name,
        dob: d.dob ?? null,
        passport_no_encrypted: d.passport_no ?? null,
        phone: d.phone ?? null,
        email: d.email ?? null,
        topik_level: d.topik_level ?? null,
      })
      .select("id")
      .single();

    if (insertErr || !inserted) {
      results.push({
        rowNumber: r.rowNumber,
        status: "error",
        message: `DB: ${insertErr?.message ?? "no id"}`,
        name: d.name,
      });
      errorCount++;
      continue;
    }

    // 5-5. 데이터 항목 저장 (작성서류용). 실패하면 학생 행 되돌림.
    const saved = await writeRegistrationValues(svc, {
      studentId: inserted.id,
      values: reg.values,
      filledBy: session.authUserId,
      knownKeys,
    });
    if (!saved.ok) {
      await svc.from("study_managed_students").delete().eq("id", inserted.id);
      results.push({
        rowNumber: r.rowNumber,
        status: "error",
        message: `DB: ${saved.error}`,
        name: d.name,
      });
      errorCount++;
      continue;
    }

    results.push({ rowNumber: r.rowNumber, status: "ok", name: d.name });
    okCount++;
  }

  // 6. 목록 캐시 갱신 (성공 row 있을 때만)
  if (okCount > 0) {
    revalidatePath("/center/students");
  }

  return {
    totalRows: dataRows.length,
    okCount,
    skippedCount,
    errorCount,
    rows: results,
  };
}
