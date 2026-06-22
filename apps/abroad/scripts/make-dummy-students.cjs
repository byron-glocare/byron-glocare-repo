/* 학생 일괄 업로드 더미 파일 생성 — 현재 템플릿(Sinh viên, 9컬럼) 형식.
 * 실행: node apps/abroad/scripts/make-dummy-students.cjs  (abroad 디렉터리 기준 xlsx 의존) */
const XLSX = require("xlsx");

const headers = [
  "Họ và tên (이름) *",
  "Ngày sinh (생년월일) YYYY-MM-DD",
  "Số hộ chiếu (여권번호)",
  "Số điện thoại (전화)",
  "Email (이메일)",
  "TOPIK (1-6, none)",
  "Visa (D-4/D-2/none/other)",
  "Vị trí (VN/KR/other)",
  "Ghi chú (메모)",
];

const rows = [
  headers,
  [
    "Trần Thị Hương",
    "2004-07-12",
    "C45678901",
    "+84 91 234 5678",
    "huong.tran@example.com",
    "4",
    "none",
    "VN",
    "Dữ liệu mẫu 1 (더미 학생 1)",
  ],
  [
    "Lê Minh Quân",
    "2003-11-30",
    "D98765432",
    "+84 98 765 4321",
    "quan.le@example.com",
    "3",
    "D-4",
    "KR",
    "Dữ liệu mẫu 2 (더미 학생 2)",
  ],
];

const ws = XLSX.utils.aoa_to_sheet(rows);
ws["!cols"] = [
  { wch: 22 },
  { wch: 22 },
  { wch: 18 },
  { wch: 18 },
  { wch: 26 },
  { wch: 14 },
  { wch: 22 },
  { wch: 16 },
  { wch: 30 },
];
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Sinh viên");

const out = "C:/dev/glocare/student_import_dummy_2.xlsx";
XLSX.writeFile(wb, out);
console.log("WROTE", out);
