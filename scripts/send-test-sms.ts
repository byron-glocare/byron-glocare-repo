/**
 * NHN Cloud SMS 실제 발송 테스트.
 *   npx tsx scripts/send-test-sms.ts
 *
 * .env.local 의 NHN_SMS_* 사용.
 * 수신번호는 기본 발신번호(=본인) 로 테스트. 인자로 다른 번호 전달 가능.
 */
import { config } from "dotenv";
import path from "node:path";

config({ path: path.resolve(process.cwd(), ".env.local") });

const APP_KEY = process.env.NHN_SMS_APP_KEY!;
const SECRET = process.env.NHN_SMS_SECRET_KEY!;
const SEND_NO = process.env.NHN_SMS_SEND_NO!;

if (!APP_KEY || !SECRET || !SEND_NO) {
  console.error("NHN_SMS_* 환경변수 누락");
  process.exit(1);
}

const recipient = (process.argv[2] ?? SEND_NO).replace(/[^0-9]/g, "");
const body =
  process.argv.slice(3).join(" ") ||
  "[글로케어 테스트] 문자 발송 연동 확인용입니다. 수신되면 성공입니다.";

console.log(
  `— SEND_NO: ${SEND_NO.replace(/[^0-9]/g, "")}\n— recipient: ${recipient}\n— body (${body.length}자 / ${new TextEncoder().encode(body).length}byte):\n${body}\n`
);

async function main() {
  const url = `https://api-sms.cloud.toast.com/sms/v3.0/appKeys/${encodeURIComponent(APP_KEY)}/sender/lms`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Secret-Key": SECRET,
    },
    body: JSON.stringify({
      title: "[글로케어 테스트]",
      body,
      sendNo: SEND_NO.replace(/[^0-9]/g, ""),
      recipientList: [{ recipientNo: recipient, countryCode: "82" }],
    }),
  });

  const json = await res.json();
  console.log("— HTTP status:", res.status);
  console.log("— response:");
  console.log(JSON.stringify(json, null, 2));

  if (!res.ok || !json?.header?.isSuccessful) {
    console.error("\n발송 실패");
    process.exit(1);
  }
  console.log("\n발송 요청 성공 — 수신 확인 부탁");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
