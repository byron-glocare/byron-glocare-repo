/**
 * GET /api/center/students/template
 *   학생 일괄 등록용 .xlsx 양식 동적 생성·다운로드.
 *
 * 양식 = 운영자 엑셀 "Abroad Student List_Glocare.xlsx" 와 같은 모양 (2026-09-21).
 *   · 칸 정의 정본: lib/center/student-roster-columns.ts 의 ROSTER_INPUT_COLUMNS (내보내기 전용 칸 제외)
 *   · 머리글 2줄: 1줄 = 그룹, 2줄 = 하위 칸. 같은 그룹은 가로 병합, 하위 칸이 없으면 세로 병합.
 *   · 시트 이름 "Sinh viên", 데이터는 3행부터 (안내 행 없음).
 *   · 필수 칸은 머리글을 빨간색으로 + 셀 메모.
 */

import { NextResponse } from "next/server";
import ExcelJS from "exceljs";

import { verifyCenterSession } from "@/lib/center/dal";
import { ROSTER_INPUT_COLUMNS } from "@/lib/center/student-roster-columns";
import {
  optionsFor,
  REG_FIELDS,
  termOptions,
} from "@/lib/center/students/registration";

const TEMPLATE_VERSION = "v2";
const SHEET_NAME = "Sinh viên";
const DATA_FIRST_ROW = 3;
const DATA_LAST_ROW = 502; // 500행

/** 선택지 칸 (드롭다운) — 칸 id → 허용 값 */
function listFor(fieldId: string): string[] | null {
  if (fieldId === "desired_term") return termOptions().map((o) => o.value);
  const opts = optionsFor(fieldId);
  return opts ? opts.map((o) => o.value) : null;
}

/** 앞자리 0 이 있는 번호 칸 — 텍스트 서식으로 */
const TEXT_KEYS = new Set([
  "student_phone",
  "father_contact",
  "mother_contact",
  "national_id_no",
  "father_national_id",
  "mother_national_id",
  "passport_no",
]);

export async function GET() {
  await verifyCenterSession();

  const wb = new ExcelJS.Workbook();
  // 모든 metadata 채움 — exceljs 의 load 시 'company' undefined 버그 회피
  const now = new Date();
  wb.creator = "GLOCARE Center";
  wb.lastModifiedBy = "GLOCARE Center";
  wb.created = now;
  wb.modified = now;
  wb.company = "GLOCARE";
  wb.manager = "GLOCARE";
  wb.title = "GLOCARE Student Import Template";
  wb.subject = "Sinh viên — Đăng ký hàng loạt";
  wb.keywords = "glocare student import vietnamese";
  wb.category = "Template";
  wb.description = "Mẫu nhập sinh viên hàng loạt cho trung tâm du học";

  const ws = wb.addWorksheet(SHEET_NAME);
  const cols = ROSTER_INPUT_COLUMNS;

  ws.columns = cols.map((c) => ({ width: c.width ?? 14 }));

  const row1 = ws.getRow(1);
  const row2 = ws.getRow(2);
  cols.forEach((c, i) => {
    row1.getCell(i + 1).value = c.group;
    row2.getCell(i + 1).value = c.sub ?? null;
  });

  // 병합: 같은 그룹 연속(하위 칸 있음) → 1행 가로 병합 / 하위 칸 없음 → 1~2행 세로 병합
  let i = 0;
  while (i < cols.length) {
    const c = cols[i];
    if (!c.sub) {
      ws.mergeCells(1, i + 1, 2, i + 1);
      i += 1;
      continue;
    }
    let j = i;
    while (j + 1 < cols.length && cols[j + 1].sub && cols[j + 1].group === c.group) j += 1;
    if (j > i) ws.mergeCells(1, i + 1, 1, j + 1);
    i = j + 1;
  }

  // 머리글 스타일
  for (const r of [row1, row2]) {
    r.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    r.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  }
  row1.height = 42;
  row2.height = 28;
  cols.forEach((c, idx) => {
    for (const r of [1, 2]) {
      const cell = ws.getRow(r).getCell(idx + 1);
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        // 필수 표시: 하위 칸이 있으면 2행(하위 칸)만, 없으면 병합된 1행
        fgColor: { argb: c.required && (r === 2 || !c.sub) ? "FFB91C1C" : "FF1E293B" },
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FF94A3B8" } },
        left: { style: "thin", color: { argb: "FF94A3B8" } },
        bottom: { style: "thin", color: { argb: "FF94A3B8" } },
        right: { style: "thin", color: { argb: "FF94A3B8" } },
      };
    }
  });

  // 칸별 안내 메모 + 드롭다운 + 서식
  cols.forEach((c, idx) => {
    const colNo = idx + 1;
    const fieldId = c.special === "name" ? "name" : c.key;
    const notes: string[] = [];
    if (c.required) notes.push("Bắt buộc / 필수");

    let list: string[] | null = null;
    if (fieldId) {
      const f = REG_FIELDS[fieldId];
      if (f?.input === "date") notes.push("YYYY-MM-DD hoặc DD/MM/YYYY");
      if (f?.input === "number") notes.push("Số / 숫자");
      list = listFor(fieldId);
    }
    if (c.special === "final_school" || c.special === "final_admission" || c.special === "final_graduation") {
      notes.push(
        "Theo 'Học lực cao nhất': THPT → trường cấp 3, CĐ/ĐH → trường CĐ/ĐH\n최종학력이 고졸이면 고교, 전문대·대학이면 대학"
      );
    }
    if (c.special === "absence_total" || c.special === "income_total") {
      notes.push("Tự động tính — không cần nhập / 자동 계산 (입력 불필요)");
    }
    if (c.special === "seq") notes.push("Không bắt buộc / 선택");
    if (list && list.length > 0 && fieldId !== "desired_term") notes.push(list.join(" / "));
    if (fieldId === "desired_term") notes.push("VD: 2027-Spring (Spring/Summer/Fall/Winter)");

    const headerCell = ws.getRow(c.sub ? 2 : 1).getCell(colNo);
    if (notes.length > 0) {
      headerCell.note = { texts: [{ text: notes.join("\n") }], margins: { insetmode: "auto" } };
    }

    const isText = !!c.key && TEXT_KEYS.has(c.key);
    for (let r = DATA_FIRST_ROW; r <= DATA_LAST_ROW; r++) {
      const cell = ws.getCell(r, colNo);
      if (isText) cell.numFmt = "@";
      if (list && list.length > 0) {
        cell.dataValidation = {
          type: "list",
          // 지원 학기는 자유 입력도 허용 (목록은 제안)
          allowBlank: true,
          showErrorMessage: fieldId !== "desired_term",
          formulae: [`"${list.join(",")}"`],
        };
      }
    }
  });

  ws.views = [{ state: "frozen", ySplit: 2, xSplit: 0 }];

  const buffer = await wb.xlsx.writeBuffer();

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="glocare_student_template_${TEMPLATE_VERSION}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
