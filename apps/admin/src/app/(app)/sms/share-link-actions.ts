"use server";

import { randomBytes, randomUUID } from "node:crypto";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import { isGlocareAdmin } from "@/lib/admin-guard";
import {
  SHARE_FILES_BUCKET,
  SHARE_LINK_TTL_DAYS,
  shareLinkUrl,
} from "@/lib/share-links";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const BASE62 =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** 10자 base62 무작위 코드 (~59bit). 모듈로 편향 없게 rejection sampling. */
function makeCode(len = 10): string {
  let out = "";
  while (out.length < len) {
    for (const b of randomBytes(len * 2)) {
      if (b < 248) out += BASE62[b % 62];
      if (out.length === len) break;
    }
  }
  return out;
}

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isGlocareAdmin(user)) return null;
  return user;
}

/**
 * 1단계 — 정산서 PDF 업로드용 서명 URL 발급.
 * (Vercel 4.5MB 본문 한도 회피: 브라우저 → Storage 직접 업로드)
 */
export async function prepareSettlementPdfUpload(input: {
  centerId: string;
  month: string; // YYYY-MM
}): Promise<Result<{ path: string; token: string }>> {
  if (!(await requireAdmin())) return { ok: false, error: "권한이 없습니다." };
  if (!/^\d{4}-\d{2}$/.test(input.month))
    return { ok: false, error: "정산 월 형식이 올바르지 않습니다." };

  const path = `settlement/${input.month}/${input.centerId}/${randomUUID()}.pdf`;
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(SHARE_FILES_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) {
    return { ok: false, error: `업로드 준비 실패: ${error?.message ?? ""}` };
  }
  return { ok: true, data: { path: data.path, token: data.token } };
}

/** 2단계 — 업로드된 PDF 로 단축 링크 생성 (30일 유효). */
export async function createSettlementShareLink(input: {
  centerId: string;
  month: string; // YYYY-MM
  path: string;
}): Promise<Result<{ code: string; url: string; expiresAt: string }>> {
  const user = await requireAdmin();
  if (!user) return { ok: false, error: "권한이 없습니다." };
  if (!input.path.startsWith(`settlement/${input.month}/${input.centerId}/`))
    return { ok: false, error: "잘못된 파일 경로입니다." };

  const admin = createAdminClient();

  // 업로드가 실제로 됐는지 확인
  const dir = input.path.slice(0, input.path.lastIndexOf("/"));
  const name = input.path.slice(input.path.lastIndexOf("/") + 1);
  const { data: listed } = await admin.storage
    .from(SHARE_FILES_BUCKET)
    .list(dir, { search: name });
  if (!listed?.some((f) => f.name === name))
    return { ok: false, error: "업로드된 파일을 찾을 수 없습니다." };

  const { data: center } = await admin
    .from("training_centers")
    .select("name")
    .eq("id", input.centerId)
    .maybeSingle();
  const safeCenter = (center?.name ?? "교육원").replace(/[\\/:*?"<>|\s]+/g, "");
  const fileName = `글로케어_정산서_${input.month}_${safeCenter}.pdf`;

  const expiresAt = new Date(
    Date.now() + SHARE_LINK_TTL_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  // code 충돌은 사실상 없지만 unique 위반 시 한 번 더 시도
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = makeCode();
    const { error } = await admin.from("file_share_links").insert({
      code,
      kind: "settlement",
      storage_path: input.path,
      file_name: fileName,
      training_center_id: input.centerId,
      settlement_month: `${input.month}-01`,
      expires_at: expiresAt,
      created_by: user.id,
    });
    if (!error) {
      return { ok: true, data: { code, url: shareLinkUrl(code), expiresAt } };
    }
    if (error.code !== "23505") {
      return { ok: false, error: `링크 생성 실패: ${error.message}` };
    }
  }
  return { ok: false, error: "링크 생성 실패 (코드 충돌)" };
}

/** 링크 즉시 차단 (잘못 보냈을 때). */
export async function revokeShareLink(code: string): Promise<Result<null>> {
  if (!(await requireAdmin())) return { ok: false, error: "권한이 없습니다." };
  const admin = createAdminClient();
  const { error } = await admin
    .from("file_share_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("code", code)
    .is("revoked_at", null);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}
