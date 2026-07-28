/**
 * 규칙기반 자동 매핑 — v2 슬롯의 라벨 문맥(label_left/label_above)을 카탈로그와 매칭.
 *
 * v2 가 각 빈칸에 뽑아둔 "왼쪽/위 라벨"을 정규화해:
 *   1) 동의어 표(SYN)로 폼 라벨 → 카탈로그 key 직결
 *   2) 없으면 카탈로그 label_ko 정규화 포함매칭(가장 가까운 것)
 * 로 토큰을 정한다. 순수 함수(클라이언트 안전) — 서버 의존 없음.
 *   - date_part : 라벨이 생년월일/여권/비자 등 날짜필드면 그 key_{unit}, 아니면 today_{unit}(작성일)
 *   - char_grid : 등록번호 계열 → foreign_registration_no. 하이픈 뒤 두번째 격자는 앞 격자 토큰 승계
 *   - checkbox  : 학생 값과 일치하는 옵션을 체크 (studentValues 있을 때만)
 */

export type CatalogType = {
  key: string;
  label_ko: string;
  input_type: string;
  category: string;
};

export type AutoMapSlot = {
  index: number;
  kind: string;
  label_left?: string | null;
  label_above?: string | null;
  line_text?: string | null;
  template?: string | null;
  options?: string[];
  unit?: "year" | "month" | "day";
  boxes?: number;
};

/** 공백·구두점 제거 + 소문자 (라벨 표기 흔들림 흡수: "이 메 일"→"이메일", "E-mail"→"email") */
export function norm(s: string | null | undefined): string {
  return (s ?? "")
    .replace(/[\s　 .:·,'"()\/\-_[\]{}※@]/g, "")
    .toLowerCase();
}

/** 정규화된 폼 라벨 → 카탈로그 key */
const SYN: Record<string, string> = {
  // 이름
  이름: "full_name_ko",
  성명: "full_name_ko",
  한글: "full_name_ko",
  한글이름: "full_name_ko",
  한글성명: "full_name_ko",
  국문: "full_name_ko",
  영문: "full_name_en",
  영문이름: "full_name_en",
  영문성명: "full_name_en",
  한자: "full_name_hanja",
  한자이름: "full_name_hanja",
  // 신원
  주민등록번호: "foreign_registration_no",
  주민번호: "foreign_registration_no",
  외국인등록번호: "foreign_registration_no",
  등록번호: "foreign_registration_no",
  여권번호: "passport_no",
  여권: "passport_no",
  국적: "nationality",
  생년월일: "birth_date",
  생일: "birth_date",
  성별: "gender",
  비자만기일: "visa_expiry_date",
  비자만료일: "visa_expiry_date",
  // 연락
  이메일: "student_email",
  이메일주소: "student_email",
  email: "student_email",
  전화번호: "student_phone",
  전화: "student_phone",
  휴대전화: "student_phone",
  휴대전화번호: "student_phone",
  휴대폰: "student_phone",
  핸드폰: "student_phone",
  연락처: "student_phone",
  연락처1: "home_country_phone_primary",
  연락처2: "korea_phone_secondary",
  주소: "korea_address",
  현주소: "korea_address",
  한국: "korea_address",
  한국주소: "korea_address",
  본국: "home_country_address",
  본국주소: "home_country_address",
  본국연락처: "home_country_phone_primary",
  카카오톡: "student_kakao",
  카카오톡id: "student_kakao",
  // 학력
  지원학과: "part_class_name",
  지망학과: "part_class_name",
  지원학과이름: "part_class_name",
  학과: "part_class_name",
  고등학교: "highschool_name",
  고등학교이름: "highschool_name",
  고교: "highschool_name",
  출신고교: "highschool_name",
  소재국명: "highschool_location",
  소재지: "highschool_location",
  재학기간: "highschool_period",
  중학교: "middle_school_name",
  중학교명: "middle_school_name",
  초등학교: "elementary_school_name",
  초등학교명: "elementary_school_name",
  // 가족
  아버지이름: "father_name",
  어머니이름: "mother_name",
  보호자: "guardian_name",
  보호자이름: "guardian_name",
  보호자성명: "guardian_name",
  관계: "guardian_relation",
  보호자관계: "guardian_relation",
  아버지연락처: "father_contact",
  // 재정
  은행명: "bank_name",
  은행: "bank_name",
  계좌번호: "bank_account_no",
  계좌: "bank_account_no",
  // 어학
  소속대학: "korean_language_institution",
  // 이미지
  서명: "signature",
  사진: "document_photo",
};

/** 날짜 서브분할 라벨 → 날짜 카탈로그 key (없으면 today) */
const DATE_SYN: Record<string, string> = {
  생년월일: "birth_date",
  생일: "birth_date",
  여권발급일: "passport_issued",
  여권만료일: "passport_expiry",
  비자만기일: "visa_expiry_date",
  졸업일: "highschool_grad_date",
};

const unitToken = (key: string, unit: "year" | "month" | "day") =>
  `${key}_${unit === "year" ? "year" : unit === "month" ? "month" : "day"}`;

/** 라벨 → 카탈로그 key (동의어 우선, 없으면 label_ko 포함매칭) */
function resolveKey(
  label: string | null | undefined,
  catalog: CatalogType[]
): string | null {
  const n = norm(label);
  if (!n) return null;
  if (SYN[n]) return SYN[n];
  // 정확 일치
  const exact = catalog.find((c) => norm(c.label_ko) === n);
  if (exact) return exact.key;
  // 포함매칭: 라벨이 카탈로그 라벨을 포함하거나 반대.
  //   catalog⊂form 은 안전(폼이 더 구체) / form⊂catalog 은 폼 라벨이 카탈로그의 상당부분
  //   (≥60%)일 때만 인정 → "수험번호⊂어학자격증수험번호", "한국⊂한국식이름" 같은 오탐 차단.
  let best: { key: string; score: number } | null = null;
  for (const c of catalog) {
    const cl = norm(c.label_ko);
    if (cl.length < 2) continue;
    let score = 0;
    if (n.includes(cl)) score = cl.length;
    else if (cl.includes(n) && n.length / cl.length >= 0.6)
      score = n.length - 0.5;
    if (score > 0 && (!best || score > best.score))
      best = { key: c.key, score };
  }
  return best?.key ?? null;
}

export function autoMap(
  slots: AutoMapSlot[],
  catalog: CatalogType[],
  validTokens: Set<string>,
  studentValues?: Record<string, string>
): { mapping: Record<number, string>; mappedCount: number } {
  const mapping: Record<number, string> = {};
  const catByKey = new Map(catalog.map((c) => [c.key, c]));
  let prevCharGridToken: string | null = null;

  for (const s of slots) {
    if (s.kind !== "char_grid") {
      // char_grid 연속성 끊김
    }

    if (s.kind === "checkbox_group") {
      prevCharGridToken = null;
      if (!studentValues || !s.options) continue;
      const vals = Object.values(studentValues)
        .map((v) => norm(v))
        .filter((v) => v.length >= 2);
      const idx = s.options.findIndex((o) => {
        const no = norm(o);
        return no.length >= 2 && vals.some((v) => v === no || v.includes(no) || no.includes(v));
      });
      if (idx >= 0) mapping[s.index] = `opt:${idx}`;
      continue;
    }

    // 필드 라벨은 왼쪽/위 라벨만 신뢰. line_text("년 월")·template("년월일 지원자…")는
    // 빈칸 자체의 텍스트라 오매칭을 유발하므로 제외 (anchor_split 만 template 추가 참고).
    const labels =
      s.kind === "anchor_split"
        ? [s.label_left, s.label_above, s.template]
        : [s.label_left, s.label_above];

    if (s.kind === "date_part" && s.unit) {
      let dkey: string | null = null;
      for (const l of labels) {
        const n = norm(l);
        if (DATE_SYN[n]) {
          dkey = DATE_SYN[n];
          break;
        }
        const rk = resolveKey(l, catalog);
        if (rk && catByKey.get(rk)?.input_type === "date") {
          dkey = rk;
          break;
        }
      }
      const tok = dkey ? unitToken(dkey, s.unit) : `today_${s.unit}`;
      if (validTokens.has(tok)) mapping[s.index] = tok;
      prevCharGridToken = null;
      continue;
    }

    if (s.kind === "char_grid") {
      let key: string | null = null;
      for (const l of labels) {
        const rk = resolveKey(l, catalog);
        if (rk) {
          key = rk;
          break;
        }
      }
      // 라벨이 "-" 등으로 매칭 실패 + 직전이 격자면 같은 번호(주민번호 뒷자리)로 승계
      const tok: string | null = key ?? prevCharGridToken;
      if (tok && validTokens.has(tok)) {
        mapping[s.index] = tok;
        prevCharGridToken = tok;
      } else {
        prevCharGridToken = null;
      }
      continue;
    }

    // text / underline_blank / anchor_split(텍스트)
    prevCharGridToken = null;
    let key: string | null = null;
    for (const l of labels) {
      const rk = resolveKey(l, catalog);
      if (rk) {
        key = rk;
        break;
      }
    }
    if (key && validTokens.has(key)) mapping[s.index] = key;
  }

  return { mapping, mappedCount: Object.keys(mapping).length };
}
