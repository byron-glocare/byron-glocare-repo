# B1 QA 체크리스트

작성: 2026-05-27 · 범위: Plan B Phase B1 (외부 어드민 기반 + 학생 도메인 + 모집요강 조회)
관련: [B1_schema.sql](./B1_schema.sql) · [B1_external_admin.md](./B1_external_admin.md) · [B1_student_excel_template.md](./B1_student_excel_template.md) · [B1_admission_extraction_poc.md](./B1_admission_extraction_poc.md) · [B2_admission_schema.md](./B2_admission_schema.md)

> 회귀 테스트 + B1 완료 검증 목적. 사용자 검증 시 각 케이스의 "실제 결과" / "상태" 채워 사용. 모든 라벨은 베트남어 (운영 UI 기준).

## 사전 준비

| # | 조건 | 확인 |
|---|---|---|
| P-1 | Supabase 인스턴스 동일 (`oczjvsxmlbuicyhheelc`), study_* 11테이블 생성 | `SELECT count(*) FROM information_schema.tables WHERE table_name LIKE 'study_%';` → 11 |
| P-2 | 본인 `auth.users` row 에 `raw_app_meta_data->>'role' = 'glocare_admin'` | `SELECT raw_app_meta_data FROM auth.users WHERE email='byron@glocare.co.kr';` |
| P-3 | `study_center_orgs` 에 테스트 org 1개 (status='active') | `SELECT * FROM study_center_orgs WHERE status='active';` |
| P-4 | `study_center_users` 에 본인 매핑 (`auth_user_id` + active) | `SELECT * FROM study_center_users WHERE auth_user_id = (SELECT id FROM auth.users WHERE email='byron@glocare.co.kr');` |
| P-5 | `study_admission_specs` 에 시드 2건 (status='approved') | [B1_seed_admission_specs.sql](./B1_seed_admission_specs.sql) 실행 후 |
| P-6 | `.env.local` 에 `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `npx vercel env pull .env.local --environment=production` |
| P-7 | `npm run dev` 정상 시작 (port 3000) | `Ready in Xms` |

## 1. 인증 · 라우팅 (proxy + DAL)

| ID | 시나리오 | 입력 | 예상 결과 | 결과 | 상태 |
|---|---|---|---|---|---|
| A-1 | 미인증 + `/center` 접속 | 쿠키 클리어 후 GET `/center` | `/center/login` 으로 302 redirect, `?from=/center` 없음 |  |  |
| A-2 | 미인증 + `/center/students` 접속 | GET `/center/students` | `/center/login?from=/center/students` 로 redirect |  |  |
| A-3 | 미인증 + `/center/login` 직접 접속 | GET `/center/login` | 200, 베트남어 폼 표시 (Đăng nhập / Email / Mật khẩu) |  |  |
| A-4 | 잘못된 비밀번호 로그인 | 본인 이메일 + 임의 잘못된 비번 | 폼에 빨간 에러 "Email hoặc mật khẩu không đúng" |  |  |
| A-5 | 정상 로그인 | 본인 이메일 + 정확한 비밀번호 | `/center` 대시보드로 redirect, 환영 메시지 + org 이름 |  |  |
| A-6 | 로그인 후 `from` 쿼리 반영 | A-2 의 from 쿼리 보존한 채 로그인 | `/center/students` 로 redirect |  |  |
| A-7 | 인증된 상태에서 `Đăng xuất` 클릭 | `/center` 의 로그아웃 폼 submit | `/center/login` redirect, 쿠키 clear |  |  |
| A-8 | 인증됐지만 `study_center_users` 매핑 없는 계정 | 매핑 row 삭제 후 로그인 시도 | "Tài khoản chưa được kích hoạt..." 에러 + 자동 logOut |  |  |
| A-9 | DAL 세션 cache 확인 | `/center` page 안에서 `verifyCenterSession()` 여러 번 호출 | DB 쿼리는 1회 (브라우저 Network tab — Supabase 호출 1회) |  |  |

## 2. Chrome 분리 (route group)

| ID | 시나리오 | 입력 | 예상 결과 | 결과 | 상태 |
|---|---|---|---|---|---|
| C-1 | 공개 사이트 헤더가 외부 어드민에 안 보임 | `/center` 대시보드 캡처 | 상단에 GLOCARE 메뉴 (취업사례·제휴대학 등) 없음 |  |  |
| C-2 | 공개 사이트는 그대로 동작 | `/` `/apply` `/insurance` `/centers` `/universities` `/cases` `/about` | 모든 페이지 정상, 헤더·푸터 표시 |  |  |
| C-3 | 베트남어 디폴트 | `/center/login` HTML | `<html lang="vi">` |  |  |

## 3. 학생 CRUD

### 3-1. 학생 목록 (`/center/students`)

| ID | 시나리오 | 입력 | 예상 결과 | 결과 | 상태 |
|---|---|---|---|---|---|
| S-1 | 빈 상태 | 학생 0명 | "Chưa có sinh viên nào được đăng ký" + "+ Đăng ký sinh viên đầu tiên" 버튼 |  |  |
| S-2 | 학생 있음 | 학생 N명 | 표 형식 (Họ tên · Ngày sinh · TOPIK · Visa · Vị trí · Ghi chú) + 이름 클릭 → 상세 |  |  |
| S-3 | RLS 격리 | 다른 org 학생을 SQL 로 추가 후 본인 로그인 | 본인 org 학생만 표시 (다른 org 안 보임) |  |  |

### 3-2. 학생 개별 등록 (`/center/students/new`)

| ID | 시나리오 | 입력 | 예상 결과 | 결과 | 상태 |
|---|---|---|---|---|---|
| S-N1 | 이름만 등록 | `name = "Test 1"` 외 모두 비움 | INSERT 성공, `/center/students` redirect, 표에 행 추가 |  |  |
| S-N2 | 이름 빈 상태 제출 | name 비움 | 필드 에러 "Vui lòng nhập họ tên" |  |  |
| S-N3 | 잘못된 이메일 | `email = "abc"` | 필드 에러 "Email không hợp lệ" |  |  |
| S-N4 | 잘못된 여권번호 | `passport_no = "ab"` (3자 미만) | 필드 에러 "Số hộ chiếu 4–20 ký tự…" |  |  |
| S-N5 | 잘못된 전화번호 | `phone = "123"` (8자 미만) | 필드 에러 "Số điện thoại tối thiểu 8 ký tự" |  |  |
| S-N6 | 메모 500자 초과 | `notes = "a".repeat(501)` | 필드 에러 "Ghi chú tối đa 500 ký tự" (브라우저 maxLength 가 막지만 zod 도 백업) |  |  |
| S-N7 | 전 필드 정상 | 모든 필드 채움 | INSERT 성공, `target_department_id` 제외 모두 저장 확인 (학생 상세) |  |  |
| S-N8 | org_id 강제 | 임의로 hidden field `org_id` 주입 시도 | 무시됨, 세션 org 로 저장 (위변조 방지) |  |  |

### 3-3. 학생 상세 (`/center/students/[id]`)

| ID | 시나리오 | 입력 | 예상 결과 | 결과 | 상태 |
|---|---|---|---|---|---|
| S-D1 | 정상 학생 id | 등록된 학생 UUID | 학생 정보 + 빈 지원 의향 + "Chỉnh sửa" + "+ Thêm đơn" 버튼 |  |  |
| S-D2 | 존재하지 않는 id | 임의 UUID | Next 의 not-found (404 페이지) |  |  |
| S-D3 | 다른 org 학생 id (RLS) | SQL 로 알아낸 다른 org 의 id | not-found (RLS 가 0건 반환) |  |  |
| S-D4 | TOPIK 표시 | 등록 시 `topik_level = "3"` | "Cấp 3" 표시 |  |  |
| S-D5 | Visa·위치 라벨 | `current_visa = "D-2"` `location = "VN"` | "D-2 (Du học)" / "Việt Nam" 라벨 |  |  |

### 3-4. 학생 편집 (`/center/students/[id]/edit`)

| ID | 시나리오 | 입력 | 예상 결과 | 결과 | 상태 |
|---|---|---|---|---|---|
| S-E1 | 폼 초기값 | 학생 상세에서 "Chỉnh sửa" 클릭 | 폼이 기존 값으로 채워짐 |  |  |
| S-E2 | 이름 변경 후 저장 | `name = "Test 1 Updated"` | UPDATE 성공, 상세로 redirect, 새 이름 표시, 목록도 갱신 |  |  |
| S-E3 | 빈 필드 → null 변환 | TOPIK 등 dropdown 을 "Chưa có" 로 변경 후 저장 | DB 컬럼 null, 상세에 "—" 표시 |  |  |

## 4. 학생 일괄 업로드 (`/center/students/import`)

### 4-1. 양식 다운로드

| ID | 시나리오 | 입력 | 예상 결과 | 결과 | 상태 |
|---|---|---|---|---|---|
| X-T1 | 다운로드 | "⬇ Tải mẫu" 클릭 | `glocare_student_template_v1.xlsx` 다운로드 |  |  |
| X-T2 | 양식 구조 | 다운로드한 파일 열기 | 헤더 9컬럼 (Họ và tên ~ Ghi chú), row 2 = `[VÍ DỤ] Nguyễn Văn A` 회색 이탤릭 |  |  |
| X-T3 | 드롭다운 | TOPIK·Visa·Vị trí 셀 클릭 | dropdown 표시 (TOPIK: 1-6, none / Visa: D-4,D-2,none,other / Vị trí: VN,KR,other) |  |  |
| X-T4 | 코멘트 | row 2의 A2 셀 마우스오버 | "Đây là dòng ví dụ…" 노트 표시 |  |  |

### 4-2. 업로드 + 파싱 + 검증

| ID | 시나리오 | 입력 | 예상 결과 | 결과 | 상태 |
|---|---|---|---|---|---|
| X-U1 | 빈 파일 (헤더만) | 데이터 행 모두 삭제 | "File không có dữ liệu" 에러 |  |  |
| X-U2 | 예시 행만 그대로 | row 2 [VÍ DỤ] 유지, 다른 행 없음 | Tổng 1 / Skipped 1 / Ok 0 / Error 0 |  |  |
| X-U3 | 4행 (예시 + 정상 + 이메일오류 + 날짜오류) | 캡처대로 입력 | Tổng 4 / Ok 1 / Skipped 1 / Error 2, 상세 표에 각 사유 |  |  |
| X-U4 | TOPIK = "none" 행 | `topik_level = none` 그 외 정상 | Ok 1, DB 의 topik_level 컬럼 null |  |  |
| X-U5 | 500행 초과 | 501행 | "vượt giới hạn 500" 에러 |  |  |
| X-U6 | 5MB 초과 파일 | 큰 파일 | "File quá lớn" 에러 |  |  |
| X-U7 | .xlsx 가 아닌 파일 | `.csv` 또는 `.txt` 업로드 시도 | 브라우저 file input `accept` 가 막거나 서버에서 "Chỉ chấp nhận file .xlsx" |  |  |
| X-U8 | 시트명 다른 파일 | 다른 양식 (`Sheet1`) 업로드 | "Không tìm thấy sheet 'Sinh viên'" 에러 |  |  |
| X-U9 | 부분 성공 결과 표시 | X-U3 후 결과 | 통계 4개 박스 + Stat badges (Thành công/Bỏ qua/Lỗi) + 상세 table |  |  |
| X-U10 | 성공 학생 목록 반영 | X-U3 후 `/center/students` | 새 학생 행 추가 (revalidatePath 동작) |  |  |

## 5. 모집요강 조회 (`/center/admissions`)

| ID | 시나리오 | 입력 | 예상 결과 | 결과 | 상태 |
|---|---|---|---|---|---|
| M-1 | 빈 상태 | approved spec 없음 | "Chưa có hồ sơ tuyển sinh nào được công bố" |  |  |
| M-2 | 시드 2건 후 | seed SQL 실행 후 | 표에 2건 (Trường·Khoa / Chương trình / Học kỳ / Cập nhật) |  |  |
| M-3 | 동남보건 학과 표시 | row hover | "글로벌 헬스케어과 (요양보호) · 글로벌 헬스케어과 (바이오제약) · 글로벌 헬스케어과 (뷰티케어)" 표시 |  |  |
| M-4 | program_type 라벨 | `associate_2yr` | "Cao đẳng 2 năm" 표시 |  |  |
| M-5 | RLS: draft spec 안 보임 | spec 1건의 status를 `draft` 로 변경 후 새로고침 | 그 spec 안 보임 (approved 만) |  |  |

## 6. 지원 의향 등록 (`/center/students/[id]/applications/new`)

| ID | 시나리오 | 입력 | 예상 결과 | 결과 | 상태 |
|---|---|---|---|---|---|
| AP-1 | spec 없을 때 폼 진입 | spec 0건 상태 | "Chưa có hồ sơ tuyển sinh nào được duyệt" 빈 상태 + 뒤로 가기 링크 |  |  |
| AP-2 | spec dropdown 표시 | spec 2건 시드 후 | 2 option (학교명 · admission_category · term) |  |  |
| AP-3 | 학과 자동 선택 (단일) | 서정대 spec (학과 1개) 선택 | "Ngành" 이 readonly + "글로벌요양복지과" 표시 |  |  |
| AP-4 | 학과 dropdown (복수) | 동남보건 spec (학과 3개) 선택 | "Ngành" dropdown 활성화, 3개 옵션 |  |  |
| AP-5 | spec 변경 시 학과 첫 옵션 자동 | 서정 → 동남보건 변경 | 학과가 "요양보호" 로 자동 |  |  |
| AP-6 | INSERT 성공 | 학과 선택 후 submit | study_applications row 생성, 학생 상세로 redirect, 지원 list 에 표시 |  |  |
| AP-7 | next_action / next_deadline 옵션 | 비워서 submit | 정상 (DB null) |  |  |
| AP-8 | 학생 상세에 표시 | AP-6 후 학생 상세 새로고침 | "Đơn tuyển sinh" 섹션에 학과명 + "Đang chuẩn bị" |  |  |

## 7. 회귀 — 공개 사이트 (route group 이동 영향 X)

| ID | 시나리오 | 입력 | 예상 결과 | 결과 | 상태 |
|---|---|---|---|---|---|
| R-1 | 홈 | `/` | hero + cases + universities + centers + insurance + apply 섹션 정상 |  |  |
| R-2 | 상담 신청 폼 | `/apply` 작성·제출 | 기존 동작 그대로 (study_contacts INSERT) |  |  |
| R-3 | 보험 환급 | `/insurance` 작성·제출 | 기존 동작 (study_insurance_claims INSERT) |  |  |
| R-4 | 다국어 토글 | LangBar 클릭 (VI ↔ KO) | cookie locale 변경, 전체 사이트 다국어 |  |  |
| R-5 | 대학 상세 | `/universities/[id]` | 기존 동작 |  |  |

## 8. 후속 (B1+ 보강 대상)

다음 라운드 작업 표 (현재 미완):

| 작업 | 우선순위 | 비고 |
|---|---|---|
| 학생 삭제 (confirm + cascade) | M | study_applications 도 cascade 삭제 정책 확인 |
| 지원 의향 편집·삭제 | M | 학생 상세에서 inline |
| 지원 상태 변경 (preparing → submitted 등 단계 progression) | H | 운영 흐름 |
| 학생 목록 검색·필터 (단계·대학·마감일) | H | 사양상 B1 |
| 학생 일괄 import 의 실패 행 .xlsx 재다운로드 | L | UX 보강 |
| i18n.ts 의 center.* 키 통합 (인라인 → dict) | M | 한국어 토글 도입 시 필수 |
| 학생 일괄 import 후 `[VÍ DỤ]` 시각 차별화 (회색 배경 등) | L | 이미 시각 처리됨 — 회귀 |
| Chrome 의 공개 사이트 메뉴 강조 | L |  |
| QA 자동화 — Playwright 또는 Vitest | M | 본 매트릭스를 e2e 테스트화 |

---

## 검증 결과 요약 (사용자 채움)

| 일자 | 라운드 | 검증자 | 결과 | 비고 |
|---|---|---|---|---|
| 2026-05-27 | B1 초기 | byron@glocare.co.kr | A-5/X-U3/AP-6 동작 확인 | (전 케이스 미검증) |
| | | | | |
