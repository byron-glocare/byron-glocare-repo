// =============================================================================
// NHN Cloud SMS v3.0 공용 유틸 — 자동 문자 발송 엔진에서 사용.
// 이 계정은 /sender/lms 가 비활성이라 장문은 /sender/mms 로 보낸다
// (sms/actions.ts 의 sendNhnLms 와 동일한 방침).
// =============================================================================

type NhnEnv = {
  appKey: string;
  secretKey: string;
  sendNo: string;
  baseUrl: string;
};

function getNhnEnv(): NhnEnv | null {
  const appKey = process.env.NHN_SMS_APP_KEY;
  const secretKey = process.env.NHN_SMS_SECRET_KEY;
  const sendNo = process.env.NHN_SMS_SEND_NO;
  const baseUrl = (
    process.env.NHN_SMS_API_URL ?? "https://sms.api.nhncloudservice.com"
  ).replace(/\/+$/, "");
  if (!appKey || !secretKey || !sendNo) return null;
  return { appKey, secretKey, sendNo, baseUrl };
}

export type NhnResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * MMS 첨부 이미지 업로드 (base64 방식).
 * 규격: jpg/jpeg 만, 최대 300KB, 해상도 1000x1000 이하.
 * 성공 시 발송 요청의 attachFileIdList 에 넣을 fileId 를 반환.
 */
export async function uploadNhnAttachment(params: {
  fileName: string;
  base64Body: string;
}): Promise<{ ok: true; fileId: number } | { ok: false; error: string }> {
  const env = getNhnEnv();
  if (!env) return { ok: false, error: "NHN Cloud SMS 환경변수 미설정" };

  const url = `${env.baseUrl}/sms/v3.0/appKeys/${encodeURIComponent(env.appKey)}/attachfile/binaryUpload`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Secret-Key": env.secretKey,
    },
    body: JSON.stringify({
      fileName: params.fileName,
      createUser: "glocare-admin",
      fileBody: params.base64Body,
    }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.header?.isSuccessful || json?.body?.data?.fileId == null) {
    return {
      ok: false,
      error: `첨부 업로드 실패: ${json?.header?.resultMessage ?? `HTTP ${res.status}`}`,
    };
  }
  return { ok: true, fileId: json.body.data.fileId };
}

/**
 * MMS 단건 발송. attachFileIds 를 주면 이미지 첨부 MMS 가 된다.
 */
export async function sendNhnMms(params: {
  phone: string;
  title: string;
  body: string;
  attachFileIds?: number[];
}): Promise<NhnResult> {
  const env = getNhnEnv();
  if (!env) return { ok: false, error: "NHN Cloud SMS 환경변수 미설정" };

  const recipientNo = params.phone.replace(/[^0-9]/g, "");
  if (!/^01\d{7,9}$/.test(recipientNo) && !/^0\d{7,9}$/.test(recipientNo)) {
    return { ok: false, error: `유효하지 않은 전화번호: ${params.phone}` };
  }

  const bodyBytes = new TextEncoder().encode(params.body).length;
  if (bodyBytes > 2000) {
    return { ok: false, error: `본문 ${bodyBytes} byte — MMS 최대 2000 byte 초과` };
  }

  const url = `${env.baseUrl}/sms/v3.0/appKeys/${encodeURIComponent(env.appKey)}/sender/mms`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Secret-Key": env.secretKey,
    },
    body: JSON.stringify({
      title: params.title.slice(0, 40),
      body: params.body,
      sendNo: env.sendNo.replace(/[^0-9]/g, ""),
      recipientList: [{ recipientNo, countryCode: "82" }],
      ...(params.attachFileIds?.length
        ? { attachFileIdList: params.attachFileIds }
        : {}),
    }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.header?.isSuccessful) {
    return {
      ok: false,
      error: json?.header?.resultMessage ?? `HTTP ${res.status}`,
    };
  }
  return { ok: true };
}
