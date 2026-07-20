/** strings.json (한국어) → vi.json (베트남어 사전). 배치로 나눠 Claude 호출. */
const fs = require("node:fs");
const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({ apiKey: process.env.AKEY });
const MODEL = "claude-sonnet-4-5";

const SYS = `당신은 한국 대학 유학 업무 시스템의 **유학센터 담당자용 매뉴얼**을 베트남어로 번역합니다.
독자는 베트남 현지 유학센터 직원입니다.

# 규칙
1. 자연스럽고 정중한 베트남어. 매뉴얼 문체(간결·명확).
2. **화면 UI 용어는 실제 화면의 베트남어를 그대로 사용**하세요:
   - 학생=Sinh viên, 대학/학교=Trường, 지원=Đăng ký/Nguyện vọng, 서류/자료=Giấy tờ / Hồ sơ
   - 탭: 개요=Tổng quan, 대학 선택=Chọn trường, 서류 등록=Tải giấy tờ,
     정보 입력=Nhập thông tin, 최종 서류=Hồ sơ cuối
   - 버튼: 필수=cần, 도구=Công cụ, 제출=Nộp, KR 번역=Dịch KR, EN 번역=Dịch EN, 되돌리기=Hoàn tác
3. 한국어 UI 라벨이 괄호로 병기된 경우(예: "Tổng quan (개요)") 그 형태를 유지하세요.
4. **고유명사·이메일·URL·숫자·파일형식(PDF, JPG)은 그대로** 두세요. (예: help@glocare.co.kr, youstudyinkorea.com/center, GLOCARE)
5. 화살표(→), 중점(·), 기호(⌄, ▲, ①②), 이모지는 그대로 유지.
6. 줄바꿈(\\n)이 있으면 위치를 그대로 유지.

# 출력
입력은 JSON 배열입니다. **같은 길이의 JSON 배열만** 출력하세요. i번째 원소는 입력 i번째의 베트남어 번역입니다.
설명·코드블록·다른 텍스트 금지. JSON 배열만.`;

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

(async () => {
  const src = JSON.parse(fs.readFileSync("strings.json", "utf8"));
  const batches = chunk(src, 30);
  const result = [];
  for (let b = 0; b < batches.length; b++) {
    const batch = batches[b];
    let parsed = null;
    for (let attempt = 1; attempt <= 3 && !parsed; attempt++) {
      const r = await client.messages.create({
        model: MODEL,
        max_tokens: 8000,
        system: [{ type: "text", text: SYS, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: [{ type: "text", text: JSON.stringify(batch, null, 1) }] }],
      });
      let t = (r.content.find((x) => x.type === "text") || {}).text || "";
      t = t.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
      try {
        const a = JSON.parse(t);
        if (Array.isArray(a) && a.length === batch.length) parsed = a;
        else console.log(`  batch${b} 길이불일치(${a.length}/${batch.length}) 재시도 ${attempt}`);
      } catch (e) {
        console.log(`  batch${b} JSON 실패 재시도 ${attempt}: ${e.message.slice(0, 60)}`);
      }
    }
    if (!parsed) { console.log(`  ! batch${b} 실패 → 원문 유지`); parsed = batch; }
    result.push(...parsed);
    console.log(`batch ${b + 1}/${batches.length} 완료 (${result.length}/${src.length})`);
  }

  const dict = {};
  src.forEach((k, i) => { dict[k] = result[i]; });
  fs.writeFileSync("vi.json", JSON.stringify(dict, null, 1), "utf8");
  console.log("✓ vi.json 생성:", Object.keys(dict).length, "개");
})().catch((e) => console.log("ERR", e.message));
