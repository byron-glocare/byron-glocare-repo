/**
 * Data Access Layer — 외부 어드민(/center/(authed)) 인증·org 검증의 중앙화.
 *
 * Next.js 16 가이드 (`node_modules/next/dist/docs/01-app/02-guides/authentication.md`):
 *   - Proxy 는 optimistic 만, 실제 검증은 DAL 에서
 *   - React `cache()` 로 같은 렌더 패스 내 중복 호출 방지
 *   - 보안 검사는 데이터 소스에 가까이 (이 파일)
 */

import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { createCenterClient } from "@/lib/supabase/center";
import type { StudyCenterOrg, StudyCenterUser } from "@/types/study";

export type VerifiedCenterSession = {
  authUserId: string;
  email: string;
  member: StudyCenterUser;
  org: StudyCenterOrg;
};

/**
 * 외부 어드민의 모든 (authed) 진입점 첫 줄에서 호출.
 *   1. Supabase Auth 세션 검증 (서명 검증 + 만료 체크)
 *   2. study_center_users 매핑 (RLS 가 본인 row 만 허용)
 *   3. org status='active' 확인
 *   4. 셋 다 OK → { user, member, org }
 *   5. 어떤 단계든 실패 → /center/login redirect (Next 가이드의 DAL 패턴)
 *
 * `cache()` 로 같은 렌더 패스에서 여러 번 호출돼도 DB 쿼리는 1회.
 */
export const verifyCenterSession = cache(
  async (): Promise<VerifiedCenterSession> => {
    const supabase = await createCenterClient();

    // 1. Auth user (서명 검증된 세션)
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      redirect("/center/login");
    }

    // 2. study_center_users + study_center_orgs join
    //    RLS 가 자동 적용되므로 본인의 active row 만 조회됨
    const { data, error } = await supabase
      .from("study_center_users")
      .select("*, org:study_center_orgs(*)")
      .eq("auth_user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (error || !data) {
      redirect("/center/login?error=no_access");
    }

    // Supabase select 의 join 결과 타입은 any 로 옴 — 명시적 좁히기
    const row = data as unknown as StudyCenterUser & {
      org: StudyCenterOrg | null;
    };
    if (!row.org) {
      redirect("/center/login?error=no_org");
    }

    // 3. org 상태
    if (row.org.status !== "active") {
      redirect("/center/login?error=org_inactive");
    }

    // 4. org 필드 분리
    const { org, ...member } = row;
    return {
      authUserId: user.id,
      email: user.email!,
      member: member as StudyCenterUser,
      org: org as StudyCenterOrg,
    };
  }
);

/**
 * 세션 정보를 redirect 없이 가져오고 싶을 때 (예: Layout 에서 optional 표시용).
 * cache 덕분에 verifyCenterSession() 과 같은 렌더 안에서는 추가 쿼리 없음.
 */
export async function getCenterSessionOrNull(): Promise<VerifiedCenterSession | null> {
  try {
    return await verifyCenterSession();
  } catch {
    return null;
  }
}

/**
 * org 내부 admin 권한 헬퍼.
 *   org-level admin = 담당자 초대·해제·설정 변경 가능
 *   org-level user  = 학생 등록·관리만
 */
export function isCenterAdmin(session: VerifiedCenterSession): boolean {
  return session.member.role === "admin" && session.member.status === "active";
}
