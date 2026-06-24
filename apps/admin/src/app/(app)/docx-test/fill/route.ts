import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { isGlocareAdmin } from "@/lib/admin-guard";
import { tokenizeAndFillDocx, normLabel } from "@/lib/docx/fill";

export const runtime = "nodejs";

/** 라벨 키워드 → 그럴듯한 더미값 (테스트 표시용) */
function sampleFor(label: string): string {
  const l = label.replace(/\s+/g, "");
  if (/영문|english/i.test(l)) return "TRAN THI HUONG";
  if (/이름|성명|name/i.test(l)) return "쩐 티 흐엉";
  if (/생년월일|생일|dob|birth/i.test(l)) return "2004-07-12";
  if (/여권/.test(l)) return "C45678901";
  if (/전화|연락처|휴대|phone/i.test(l)) return "+84 90 1234 5678";
  if (/이메일|메일|email/i.test(l)) return "huong@example.com";
  if (/주소|address/i.test(l)) return "Hà Nội, Việt Nam";
  if (/국적/.test(l)) return "베트남";
  if (/주민/.test(l)) return "040712-5XXXXXX";
  if (/학과|전공/.test(l)) return "간호학과";
  if (/비자/.test(l)) return "D-2";
  return `[${label}]`;
}

/** POST: .docx 업로드 → 자동 토큰화 + 더미값 채움 → 채워진 .docx 반환 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isGlocareAdmin(user))
    return new NextResponse("Forbidden", { status: 403 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0)
    return new NextResponse("파일을 선택하세요.", { status: 400 });
  if (!file.name.toLowerCase().endsWith(".docx"))
    return new NextResponse(".docx 파일만 가능합니다. (.doc/.hwp 는 변환 후)", {
      status: 400,
    });

  // 표준데이터(데이터 메뉴) 카탈로그 → 라벨/별칭 매칭 맵
  const { data: types } = await supabase
    .from("study_student_data_types")
    .select("key, label_ko, label_vi, aliases");
  const matchMap = new Map<string, { dummy: string }>();
  for (const t of types ?? []) {
    const dummy = sampleFor(t.label_ko ?? t.key);
    const add = (s: string | null | undefined) => {
      if (s && s.trim()) matchMap.set(normLabel(s), { dummy });
    };
    add(t.label_ko);
    add(t.label_vi);
    const aliases = Array.isArray(t.aliases) ? (t.aliases as string[]) : [];
    for (const a of aliases) add(a);
  }

  const buf = Buffer.from(await file.arrayBuffer());
  let result: ReturnType<typeof tokenizeAndFillDocx>;
  try {
    result = tokenizeAndFillDocx(buf, (n) => matchMap.get(n) ?? null);
  } catch (e) {
    return new NextResponse(e instanceof Error ? e.message : "처리 실패", {
      status: 500,
    });
  }

  const fname = encodeURIComponent(
    file.name.replace(/\.docx$/i, "") + "_채움예시.docx"
  );

  return new NextResponse(result.filled as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename*=UTF-8''${fname}`,
      "X-Matched": encodeURIComponent(JSON.stringify(result.matched)),
      "X-Unmatched": encodeURIComponent(JSON.stringify(result.unmatched)),
      "Cache-Control": "no-store",
    },
  });
}
