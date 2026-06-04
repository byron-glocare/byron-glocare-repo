/**
 * GET /api/center/students/template
 *   학생 일괄 등록용 .xlsx 양식 동적 생성·다운로드.
 *
 * 사양: docs/specs/B1_student_excel_template.md §2 (`Sinh viên` 시트 12컬럼)
 *   - 이번 라운드 = `Sinh viên` 1시트 (기본 9컬럼)
 *   - 후속: `Hướng dẫn` / `Mã tham chiếu` 시트 + 대학·학과 코드 컬럼
 */

import { NextResponse } from "next/server";
import ExcelJS from "exceljs";

import { verifyCenterSession } from "@/lib/center/dal";

const TEMPLATE_VERSION = "v1";

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
  wb.language = "vi-VN";

  const ws = wb.addWorksheet("Sinh viên");

  ws.columns = [
    { header: "Họ và tên (이름) *", key: "name", width: 26 },
    { header: "Ngày sinh (생년월일) YYYY-MM-DD", key: "dob", width: 22 },
    { header: "Số hộ chiếu (여권번호)", key: "passport_no", width: 20 },
    { header: "Số điện thoại (전화)", key: "phone", width: 18 },
    { header: "Email (이메일)", key: "email", width: 26 },
    { header: "TOPIK (1-6, none)", key: "topik_level", width: 14 },
    { header: "Visa (D-4/D-2/none/other)", key: "current_visa", width: 22 },
    { header: "Vị trí (VN/KR/other)", key: "location", width: 18 },
    { header: "Ghi chú (메모)", key: "notes", width: 36 },
  ];

  // 헤더 스타일
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E293B" },
  };
  header.alignment = {
    vertical: "middle",
    horizontal: "center",
    wrapText: true,
  };
  header.height = 32;

  // 예제 row 먼저 추가 — row 2 (dataValidation 적용 전에)
  //   `[VÍ DỤ]` prefix 가 있는 행은 서버가 자동으로 skip. 지우지 않아도 안전.
  ws.addRow({
    name: "[VÍ DỤ] Nguyễn Văn A",
    dob: "2005-03-15",
    passport_no: "B12345678",
    phone: "+84 90 1234 5678",
    email: "vana@example.com",
    topik_level: "3",
    current_visa: "none",
    location: "VN",
    notes: "Hệ thống sẽ bỏ qua dòng có dấu [VÍ DỤ] — bạn có thể xóa hoặc giữ nguyên",
  });
  const example = ws.getRow(2);
  example.font = { italic: true, color: { argb: "FF94A3B8" } };
  example.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF8FAFC" },
  };
  // 예시 셀에 코멘트 추가 (이름 셀)
  ws.getCell("A2").note = {
    texts: [
      {
        text:
          "Đây là dòng ví dụ.\n" +
          "Dòng bắt đầu bằng [VÍ DỤ] sẽ tự động bị bỏ qua khi tải lên.\n" +
          "Bạn có thể xóa cả dòng, hoặc giữ nguyên — đều an toàn.",
      },
    ],
    margins: { insetmode: "auto" },
  };

  // 그 후 드롭다운을 row 2-500 에 적용 (예제 row 포함)
  for (let r = 2; r <= 500; r++) {
    ws.getCell(`F${r}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"1,2,3,4,5,6,none"'],
    };
    ws.getCell(`G${r}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"D-4,D-2,none,other"'],
    };
    ws.getCell(`H${r}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"VN,KR,other"'],
    };
  }

  ws.views = [{ state: "frozen", ySplit: 1 }];

  // 메타 row 행 추가는 생략 — 후속 라운드의 Hướng dẫn 시트로 분리

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
