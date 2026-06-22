"use server";

import { revalidatePath } from "next/cache";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isGlocareAdmin } from "@/lib/admin-guard";

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * 글로케어 어드민 권한 확인 — service_role 을 쓰는 액션 앞에 필수.
 * (게이트는 layout 에서도 막지만, 서버 액션은 직접 호출될 수 있어 방어적으로 재확인.)
 */
async function requireGlocareAdmin(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };
  if (!isGlocareAdmin(user))
    return { ok: false, error: "권한이 없습니다." };
  return { ok: true };
}

// =============================================================================
// 계정 목록 (어드민 + 유학센터 + 요양보호 분류)
// =============================================================================

export type AccountKind = "admin" | "center" | "caregiver" | "none";

export type AccountRow = {
  id: string;
  email: string | undefined;
  created_at: string;
  last_sign_in_at: string | null;
  banned_until: string | null;
  kind: AccountKind;
  isAdmin: boolean;
  /** center 계정일 때: 소속 org 이름 + 센터 내 역할 + 상태 */
  centerOrgName?: string | null;
  centerRole?: "admin" | "user" | null;
  centerStatus?: "active" | "suspended" | null;
  centerUserId?: string | null;
  centerName?: string | null;
};

export async function listAccounts(): Promise<ActionResult<AccountRow[]>> {
  const guard = await requireGlocareAdmin();
  if (!guard.ok) return guard;

  try {
    const admin = createAdminClient();

    const [usersRes, centerRes, custRes] = await Promise.all([
      admin.auth.admin.listUsers({ perPage: 1000 }),
      admin
        .from("study_center_users")
        .select(
          "id, auth_user_id, name, role, status, org:study_center_orgs(name_vi, name_ko)"
        ),
      admin.from("customers").select("auth_user_id").not("auth_user_id", "is", null),
    ]);

    if (usersRes.error) return { ok: false, error: usersRes.error.message };

    const centerByAuth = new Map<
      string,
      {
        id: string;
        name: string;
        role: "admin" | "user";
        status: "active" | "suspended";
        orgName: string | null;
      }
    >();
    for (const r of centerRes.data ?? []) {
      const org = r.org as
        | { name_vi: string | null; name_ko: string | null }
        | { name_vi: string | null; name_ko: string | null }[]
        | null;
      const o = Array.isArray(org) ? org[0] : org;
      centerByAuth.set(r.auth_user_id, {
        id: r.id,
        name: r.name,
        role: r.role,
        status: r.status,
        orgName: o?.name_ko || o?.name_vi || null,
      });
    }

    const caregiverAuth = new Set<string>();
    for (const c of custRes.data ?? []) {
      if (c.auth_user_id) caregiverAuth.add(c.auth_user_id);
    }

    const rows: AccountRow[] = usersRes.data.users.map((u) => {
      const admin_ = isGlocareAdmin(u);
      const center = centerByAuth.get(u.id);
      let kind: AccountKind = "none";
      if (admin_) kind = "admin";
      else if (center) kind = "center";
      else if (caregiverAuth.has(u.id)) kind = "caregiver";

      return {
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        banned_until:
          (u as { banned_until?: string | null }).banned_until ?? null,
        kind,
        isAdmin: admin_,
        centerOrgName: center?.orgName ?? null,
        centerRole: center?.role ?? null,
        centerStatus: center?.status ?? null,
        centerUserId: center?.id ?? null,
        centerName: center?.name ?? null,
      };
    });

    // 정렬: 어드민 → 센터 → 요양 → 기타
    const order: Record<AccountKind, number> = {
      admin: 0,
      center: 1,
      caregiver: 2,
      none: 3,
    };
    rows.sort(
      (a, b) =>
        order[a.kind] - order[b.kind] ||
        (a.email ?? "").localeCompare(b.email ?? "")
    );

    return { ok: true, data: rows };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "목록 조회 실패",
    };
  }
}

// =============================================================================
// 어드민 계정
// =============================================================================

export async function createAdminAccount(input: {
  email: string;
  password: string;
}): Promise<ActionResult> {
  const guard = await requireGlocareAdmin();
  if (!guard.ok) return guard;
  if (!input.email.trim()) return { ok: false, error: "이메일은 필수입니다." };
  if (input.password.length < 6)
    return { ok: false, error: "비밀번호는 6자 이상이어야 합니다." };

  try {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.createUser({
      email: input.email.trim(),
      password: input.password,
      email_confirm: true,
      app_metadata: { role: "glocare_admin" },
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/accounts");
    return { ok: true, data: null };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "계정 생성 실패",
    };
  }
}

/** 어드민 권한 부여/회수 (app_metadata.role) */
export async function setAdminRole(
  userId: string,
  makeAdmin: boolean
): Promise<ActionResult> {
  const guard = await requireGlocareAdmin();
  if (!guard.ok) return guard;

  // 본인 권한 회수 방지 (자기 발등 찍기 방지)
  const supabase = await createClient();
  const {
    data: { user: me },
  } = await supabase.auth.getUser();
  if (!makeAdmin && me?.id === userId) {
    return { ok: false, error: "본인의 어드민 권한은 회수할 수 없습니다." };
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(userId, {
      app_metadata: { role: makeAdmin ? "glocare_admin" : null },
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/accounts");
    return { ok: true, data: null };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "권한 변경 실패",
    };
  }
}

/** 계정 비활성화(ban)/활성화 */
export async function toggleBan(
  userId: string,
  banned: boolean
): Promise<ActionResult> {
  const guard = await requireGlocareAdmin();
  if (!guard.ok) return guard;

  const supabase = await createClient();
  const {
    data: { user: me },
  } = await supabase.auth.getUser();
  if (me?.id === userId)
    return { ok: false, error: "본인 계정은 비활성화할 수 없습니다." };

  try {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: banned ? "876000h" : "none", // 100년 vs 해제
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/accounts");
    return { ok: true, data: null };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "상태 변경 실패",
    };
  }
}

/** 임의 사용자 비밀번호 재설정 */
export async function resetUserPassword(
  userId: string,
  newPassword: string
): Promise<ActionResult> {
  const guard = await requireGlocareAdmin();
  if (!guard.ok) return guard;
  if (newPassword.length < 6)
    return { ok: false, error: "비밀번호는 6자 이상이어야 합니다." };

  try {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(userId, {
      password: newPassword,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: null };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "비밀번호 변경 실패",
    };
  }
}

/** 본인 비밀번호 변경 */
export async function updateOwnPassword(
  newPassword: string
): Promise<ActionResult> {
  if (newPassword.length < 6)
    return { ok: false, error: "비밀번호는 6자 이상이어야 합니다." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

// =============================================================================
// 유학센터 계정 (auth.users + study_center_users 동시 생성)
// =============================================================================

/**
 * 유학센터(study_centers, master 목록) 에 묶이는 로그인 계정 생성.
 * 로그인은 study_center_orgs(uuid) 에만 FK 이므로, 선택한 study_center 에
 * 대응하는 org 를 찾거나(없으면 자동 생성) 그 org 에 study_center_users 를 만든다.
 */
export async function createCenterUser(input: {
  studyCenterId: number;
  name: string;
  email: string;
  password: string;
  role: "admin" | "user";
}): Promise<ActionResult> {
  const guard = await requireGlocareAdmin();
  if (!guard.ok) return guard;
  const email = input.email.trim();
  const name = input.name.trim();
  if (!input.studyCenterId)
    return { ok: false, error: "유학센터를 선택하세요." };
  if (!name) return { ok: false, error: "담당자 이름은 필수입니다." };
  if (!email) return { ok: false, error: "이메일은 필수입니다." };
  if (input.password.length < 6)
    return { ok: false, error: "비밀번호는 6자 이상이어야 합니다." };

  const admin = createAdminClient();

  // 1) study_center 에 대응하는 org 확보 (없으면 생성)
  const orgResult = await resolveOrgForStudyCenter(input.studyCenterId);
  if (!orgResult.ok) return orgResult;
  const orgId = orgResult.data;

  // 2) auth.users 생성 (어드민 역할 없음)
  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
  });
  if (authErr || !created?.user) {
    return { ok: false, error: authErr?.message ?? "Auth 계정 생성 실패" };
  }

  // 3) study_center_users 매핑 (실패 시 auth 계정 롤백)
  const { error: mapErr } = await admin.from("study_center_users").insert({
    org_id: orgId,
    auth_user_id: created.user.id,
    email,
    name,
    role: input.role,
    status: "active",
  });
  if (mapErr) {
    await admin.auth.admin.deleteUser(created.user.id).catch(() => {});
    return { ok: false, error: `센터 매핑 실패: ${mapErr.message}` };
  }

  revalidatePath("/accounts");
  return { ok: true, data: null };
}

/** study_center_id 로 org 를 찾고, 없으면 study_center 정보로 새 org 생성. */
async function resolveOrgForStudyCenter(
  studyCenterId: number
): Promise<ActionResult<string>> {
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("study_center_orgs")
    .select("id")
    .eq("study_center_id", studyCenterId)
    .limit(1)
    .maybeSingle();
  if (existing?.id) return { ok: true, data: existing.id };

  const { data: center, error: cErr } = await admin
    .from("study_centers")
    .select("name_vi, name_ko")
    .eq("id", studyCenterId)
    .maybeSingle();
  if (cErr || !center)
    return { ok: false, error: "유학센터를 찾을 수 없습니다." };

  const { data: org, error: oErr } = await admin
    .from("study_center_orgs")
    .insert({
      name_vi: center.name_vi,
      name_ko: center.name_ko,
      country: "VN",
      status: "active",
      settlement_currency: "KRW",
      study_center_id: studyCenterId,
      activated_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (oErr || !org)
    return { ok: false, error: `회사(org) 생성 실패: ${oErr?.message}` };
  return { ok: true, data: org.id };
}

/** 유학센터 계정 활성/정지 (study_center_users.status) */
export async function setCenterUserStatus(
  centerUserId: string,
  status: "active" | "suspended"
): Promise<ActionResult> {
  const guard = await requireGlocareAdmin();
  if (!guard.ok) return guard;
  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("study_center_users")
      .update({ status })
      .eq("id", centerUserId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/accounts");
    return { ok: true, data: null };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "상태 변경 실패",
    };
  }
}
