import "server-only";
import Anthropic from "@anthropic-ai/sdk";

import { createAdminClient } from "@/lib/supabase/server";
import { buildBindings, type CatalogRow } from "@/lib/test/bindings";
import { loadStudentValues } from "@/lib/test/student-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// 라벨→필드 분류 작업이라 빠른 haiku 로 충분(응답 30s+ 회피).
const MODEL = "claude-haiku-4-5-20251001";

/** AI 에게 넘길 슬롯 문맥(클라가 보냄) */
type AiSlot = {
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

const SYSTEM = `너는 한국 대학 입학원서(양식)의 '빈칸(슬롯)'에 어떤 학생 데이터 필드가 들어가는지 판단하는 분류기다.
각 슬롯에는 왼쪽/위 라벨 같은 문맥이 주어진다. 제공된 토큰 목록 안에서만 고르고, 확신이 없으면 그 슬롯은 생략한다(억지로 채우지 마라).
규칙:
- 일반 빈칸(text/char_grid/underline_blank/anchor_split): 라벨 의미에 맞는 필드 key 를 토큰으로. 주민등록번호/외국인등록번호 격자 → foreign_registration_no.
- 날짜 단위(date_part, unit=year|month|일): 원서 작성/서명/신청 날짜면 today_year/today_month/today_day. 특정 날짜필드(예: 생년월일)면 그 key_year/key_month/key_day.
- 체크박스(checkbox_group): 학생 데이터와 일치하는 옵션이 있으면 "opt:N"(N=0-based 옵션 인덱스). 동의/비동의 같은 약관 체크박스나 일치 항목이 없으면 생략.
- 수험번호·접수번호처럼 대학이 부여하는 값, 양식 고유 값은 매칭 필드가 없으면 생략.
출력은 오직 JSON: {"mapping": {"슬롯index": "토큰"}}. 설명 금지.`;

function stripFence(s: string): string {
  const m = s.match(/^```(?:json)?\s*\n([\s\S]*?)\n```\s*$/);
  return (m ? m[1] : s).trim();
}

export async function POST(req: Request): Promise<Response> {
  let slots: AiSlot[] = [];
  let studentId = "";
  try {
    const body = (await req.json()) as { slots?: AiSlot[]; studentId?: string };
    slots = Array.isArray(body.slots) ? body.slots : [];
    studentId = body.studentId ?? "";
  } catch {
    return Response.json({ error: "요청 파싱 실패" }, { status: 400 });
  }
  if (!slots.length) return Response.json({ mapping: {} });
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY 미설정" },
      { status: 500 }
    );
  }

  try {
    const supabase = createAdminClient();
    const { data: types } = await supabase
      .from("study_student_data_types")
      .select("key, label_ko, category, input_type")
      .eq("is_active", true)
      .order("category")
      .order("sort_order");
    const catalog = (types ?? []) as CatalogRow[];
    const { options } = buildBindings(catalog);
    const validTokens = new Set(options.map((o) => o.token));

    const realValues = studentId
      ? (await loadStudentValues(supabase, studentId)).values
      : {};

    // 카탈로그(토큰 후보) 텍스트
    const byCat = new Map<string, string[]>();
    for (const c of catalog) {
      const isDate = c.input_type === "date";
      const img =
        c.input_type === "signature" ||
        (c.input_type === "file" && /사진|photo|서명|signature/i.test(c.key));
      if (c.input_type === "file" && !img) continue; // 첨부파일은 제외
      const note = isDate ? " (날짜)" : img ? " (이미지)" : "";
      const line = `${c.key} — ${c.label_ko}${note}`;
      if (!byCat.has(c.category)) byCat.set(c.category, []);
      byCat.get(c.category)!.push(line);
    }
    const catalogText = [...byCat.entries()]
      .map(([cat, ls]) => `## ${cat}\n${ls.join("\n")}`)
      .join("\n");

    // 학생 값(체크박스·문맥용) — 긴 서술형 제외, 값 절단
    const studentText = Object.entries(realValues)
      .filter(([k]) => !/^essay_|work_experience|certifications/.test(k))
      .map(([k, v]) => `${k}: ${String(v).slice(0, 60)}`)
      .join("\n");

    const slotText = slots
      .map((s) => {
        const parts = [`#${s.index} [${s.kind}]`];
        if (s.label_left) parts.push(`왼쪽="${s.label_left}"`);
        if (s.label_above) parts.push(`위="${s.label_above}"`);
        if (s.kind === "date_part" && s.unit) parts.push(`단위=${s.unit}`);
        if (s.kind === "checkbox_group" && s.options?.length)
          parts.push(
            `옵션=[${s.options.map((o, i) => `${i}:${o}`).join(", ")}]`
          );
        if (s.kind === "anchor_split" && s.template)
          parts.push(`원문="${s.template.slice(0, 40)}"`);
        return parts.join(" ");
      })
      .join("\n");

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const resp = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: [
        { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
      ],
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                `# 사용 가능한 토큰(필드 key)\n${catalogText}\n\n` +
                `# 특수 토큰\ntoday, today_year, today_month, today_day (작성일/신청일/서명일)\n` +
                `날짜필드 K 는 K_year, K_month, K_day 도 가능\n` +
                `signature(서명), document_photo(사진) = 이미지\n\n` +
                (studentText ? `# 학생 데이터(체크박스 선택·문맥)\n${studentText}\n\n` : "") +
                `# 매핑할 슬롯\n${slotText}\n\n` +
                `# 작업\n각 슬롯에 맞는 토큰을 {"mapping":{"index":"토큰"}} JSON 으로만.`,
            },
          ],
        },
      ],
    });

    const textBlock = resp.content.find((b) => b.type === "text");
    const raw =
      textBlock && textBlock.type === "text" ? stripFence(textBlock.text) : "{}";
    let parsed: { mapping?: Record<string, unknown> };
    try {
      parsed = JSON.parse(raw) as { mapping?: Record<string, unknown> };
    } catch {
      return Response.json(
        { error: "AI 응답 JSON 파싱 실패", raw: raw.slice(0, 300) },
        { status: 502 }
      );
    }

    // 검증: 유효 토큰 / opt:N 범위
    const slotByIndex = new Map(slots.map((s) => [s.index, s]));
    const mapping: Record<number, string> = {};
    for (const [k, v] of Object.entries(parsed.mapping ?? {})) {
      const idx = Number(k);
      const slot = slotByIndex.get(idx);
      if (!slot || typeof v !== "string") continue;
      if (v.startsWith("opt:")) {
        const n = Number(v.slice(4));
        if (slot.kind === "checkbox_group" && slot.options && n >= 0 && n < slot.options.length)
          mapping[idx] = v;
        continue;
      }
      if (validTokens.has(v)) mapping[idx] = v;
    }

    return Response.json({
      mapping,
      model: MODEL,
      usage: resp.usage,
    });
  } catch (e) {
    return Response.json(
      { error: (e as Error).message ?? "AI 매핑 실패" },
      { status: 500 }
    );
  }
}
