/**
 * 일회용 탐지 검증 CLI — 인증/앱과 무관하게 v1·v2 슬롯 탐지 엔진을 그대로 돌려
 * "몇 개·어떤 종류로 잡혔는지" 리포트한다. (게이트 밖 라우트 대신 안전한 독립 스크립트)
 *
 * 사용:
 *   cd apps/admin
 *   npx tsx scripts/detect-report.ts <파일.docx 또는 폴더>
 *   (인자 없으면 저장소 루트 _formtest_drop/ 안의 모든 .docx 를 스캔)
 *
 * 산출: 콘솔 리포트 + 같은 위치에 <파일>.slots.md (v2 슬롯 전수 표)
 */
import { promises as fs } from "node:fs";
import path from "node:path";

import { detectDocxSlots, type SlotV2 } from "../src/lib/docx/slot-detect-v2";
import { scanDocxSlots } from "../src/lib/docx/inline-slots";

const KIND_KO: Record<string, string> = {
  underscore: "밑줄",
  spaces: "공백",
  empty_cell: "빈 셀",
  text: "빈 셀(text)",
  char_grid: "글자칸 격자",
  checkbox_group: "체크박스",
  underline_blank: "밑줄+탭 빈칸",
  anchor_split: "앵커 분할",
  date_part: "날짜 단위",
};

function countKinds(kinds: string[]): Record<string, number> {
  const acc: Record<string, number> = {};
  for (const k of kinds) acc[k] = (acc[k] ?? 0) + 1;
  return acc;
}

function slotExtra(s: SlotV2): string {
  if (s.kind === "checkbox_group") return `옵션: ${JSON.stringify(s.options)}`;
  if (s.kind === "char_grid") return `${s.boxes}칸`;
  if (s.kind === "underline_blank")
    return `blanks=${s.blanks} · "${s.line_text ?? ""}"`;
  if (s.kind === "anchor_split") return `"${s.template ?? ""}"`;
  if (s.kind === "date_part")
    return `${s.unit} ← "${s.template ?? ""}"`;
  return "";
}

async function report(file: string): Promise<void> {
  const buf = Buffer.from(await fs.readFile(file));

  let v1Kinds: string[] = [];
  let v1Err = "";
  try {
    v1Kinds = scanDocxSlots(buf).slots.map((s) => s.kind);
  } catch (e) {
    v1Err = (e as Error).message;
  }

  let v2: SlotV2[] = [];
  let v2Err = "";
  try {
    v2 = detectDocxSlots(buf);
  } catch (e) {
    v2Err = (e as Error).message;
  }

  const line = "─".repeat(60);
  console.log(`\n${line}\n📄 ${path.basename(file)}\n${line}`);
  console.log(
    `v1 (정규식)   총 ${v1Kinds.length}개  ${v1Err ? "⚠ " + v1Err : JSON.stringify(countKinds(v1Kinds))}`
  );
  console.log(
    `v2 (구조적)   총 ${v2.length}개  ${v2Err ? "⚠ " + v2Err : JSON.stringify(countKinds(v2.map((s) => s.kind)))}`
  );
  const delta = v2.length - v1Kinds.length;
  console.log(`▶ v2 가 v1 대비 ${delta >= 0 ? "+" : ""}${delta}개 더 잡음`);

  if (v2.length) {
    console.log("\n[v2 슬롯]");
    for (const s of v2) {
      const a = Array.isArray(s.addr) ? `${s.addr[0]}(+${s.addr.length - 1})` : s.addr;
      const label =
        [s.label_left && `←${s.label_left}`, s.label_above && `↑${s.label_above}`]
          .filter(Boolean)
          .join(" ") || "(문맥없음)";
      console.log(
        `  ${s.id}  ${(KIND_KO[s.kind] ?? s.kind).padEnd(12)} ${String(a).padEnd(16)} ${label}  ${slotExtra(s)}`
      );
    }
  }

  // 마크다운 리포트 저장
  const md: string[] = [
    `# 슬롯 탐지 리포트 — ${path.basename(file)}`,
    "",
    `- v1(정규식): **${v1Kinds.length}개** ${v1Err ? `(오류: ${v1Err})` : "· " + JSON.stringify(countKinds(v1Kinds))}`,
    `- v2(구조적): **${v2.length}개** ${v2Err ? `(오류: ${v2Err})` : "· " + JSON.stringify(countKinds(v2.map((s) => s.kind)))}`,
    "",
    "| id | 종류 | 좌표 | 왼쪽라벨 | 위라벨 | 상세 |",
    "|---|---|---|---|---|---|",
    ...v2.map((s) => {
      const a = Array.isArray(s.addr) ? `${s.addr[0]} (+${s.addr.length - 1})` : s.addr;
      return `| ${s.id} | ${KIND_KO[s.kind] ?? s.kind} | ${a} | ${s.label_left ?? ""} | ${s.label_above ?? ""} | ${slotExtra(s).replace(/\|/g, "\\|")} |`;
    }),
    "",
  ];
  const out = file.replace(/\.docx$/i, "") + ".slots.md";
  await fs.writeFile(out, md.join("\n"), "utf8");
  console.log(`\n💾 리포트 저장: ${out}`);
}

async function main(): Promise<void> {
  const arg = process.argv[2];
  const targets: string[] = [];
  if (!arg) {
    const drop = path.resolve(process.cwd(), "..", "..", "_formtest_drop");
    try {
      const names = await fs.readdir(drop);
      for (const n of names)
        if (n.toLowerCase().endsWith(".docx")) targets.push(path.join(drop, n));
    } catch {
      /* ignore */
    }
    if (!targets.length) {
      console.log(
        "사용법: npx tsx scripts/detect-report.ts <파일.docx 또는 폴더>\n" +
          "또는 저장소 루트 _formtest_drop/ 에 .docx 를 넣고 인자 없이 실행."
      );
      return;
    }
  } else {
    const st = await fs.stat(arg);
    if (st.isDirectory()) {
      for (const n of await fs.readdir(arg))
        if (n.toLowerCase().endsWith(".docx")) targets.push(path.join(arg, n));
    } else {
      targets.push(arg);
    }
  }

  for (const t of targets) {
    try {
      await report(t);
    } catch (e) {
      console.log(`⚠ ${t}: ${(e as Error).message}`);
    }
  }
}

void main();
