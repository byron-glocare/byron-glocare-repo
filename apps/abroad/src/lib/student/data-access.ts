/**
 * 표준데이터/첨부파일 액션의 세션 통합 판별.
 *
 *   같은 액션(saveStudentDataValue 등)을 유학센터(/center)와 B2C 셀프 학생(/student)
 *   양쪽이 쓴다. 둘의 차이는 (1) RLS 클라이언트 (2) 스토리지 경로 접두 (3) revalidate 대상뿐.
 *
 *   판별: 현재 auth 사용자가 study_managed_students(auth_user_id=uid) 행을 가지면 셀프 학생,
 *         아니면 유학센터 담당자(study_center_users) → verifyCenterSession.
 *   (센터 담당자의 auth uid 는 managed_students 에 없으므로 자연히 center 로 라우팅된다.)
 */

import "server-only";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { createCenterClient } from "@/lib/supabase/center";
import { verifyCenterSession } from "@/lib/center/dal";
import type { Database } from "@/types/database";

export type DataAccess = {
  kind: "self" | "center";
  supabase: SupabaseClient<Database>;
  authUserId: string;
  /** 스토리지 업로드 디렉터리 접두(끝에 / 없음). `${dir}/${key}/...` 로 사용. */
  storageDir: (studentId: string) => string;
  /**
   * 서명 URL·삭제 시 이 사용자가 접근 가능한 경로인지.
   *
   * 경로 접두사(orgId)로 판별하지 않는다. 학생을 다른 센터로 옮겨도 이미 올라간
   * 파일의 경로는 그대로라, 접두사로 보면 이관된 학생의 예전 파일을 새 센터가
   * 못 받는다. 경로에서 학생 id 만 뽑아 "그 학생이 내게 보이는가"로 판별한다
   * (센터는 RLS 로 자기 org 학생만 보인다).
   */
  ownsPath: (path: string) => Promise<boolean>;
  /** 정보 입력 페이지 캐시 무효화 */
  revalidateData: (studentId: string) => void;
  /** 서류 등록 페이지 캐시 무효화 */
  revalidateDocuments: (studentId: string) => void;
};

/**
 * 액션 진입 시 호출. studentId 를 넘기면 셀프 학생의 소유(본인 학생) 여부까지 확인.
 * 접근 불가면 예외.
 */
export async function resolveDataAccess(studentId?: string): Promise<DataAccess> {
  const authed = await createClient();
  const {
    data: { user },
  } = await authed.auth.getUser();

  if (user) {
    // 셀프 학생? (본인 auth 에 연결된 managed_students 행)
    const { data: selfRow } = await authed
      .from("study_managed_students")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (selfRow) {
      if (studentId && selfRow.id !== studentId) {
        throw new Error("권한이 없습니다.");
      }
      return {
        kind: "self",
        supabase: authed,
        authUserId: user.id,
        storageDir: (sid) => `self/${sid}`,
        ownsPath: async (p) => p.startsWith(`self/${selfRow.id}/`),
        revalidateData: () => revalidatePath("/student/data"),
        revalidateDocuments: () => revalidatePath("/student/documents"),
      };
    }
  }

  // 유학센터 담당자
  const session = await verifyCenterSession();
  const supabase = await createCenterClient();
  return {
    kind: "center",
    supabase,
    authUserId: session.authUserId,
    storageDir: (sid) => `${session.org.id}/${sid}`,
    ownsPath: async (p) => {
      const sid = p.split("/")[1];
      if (!sid) return false;
      const { data } = await supabase
        .from("study_managed_students")
        .select("id")
        .eq("id", sid)
        .maybeSingle();
      return !!data;
    },
    revalidateData: (sid) => revalidatePath(`/center/students/${sid}/data`),
    revalidateDocuments: (sid) =>
      revalidatePath(`/center/students/${sid}/documents`),
  };
}

/** studentId 없는 액션(번역 등) — 로그인만 확인. */
export async function requireAnyAuth(): Promise<string> {
  const authed = await createClient();
  const {
    data: { user },
  } = await authed.auth.getUser();
  if (user) return user.id;
  // 센터 세션(만료 시 redirect)
  const session = await verifyCenterSession();
  return session.authUserId;
}
