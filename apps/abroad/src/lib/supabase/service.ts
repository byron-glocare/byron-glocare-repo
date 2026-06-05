/**
 * 서버 전용 service-role 클라이언트 — RLS 를 우회한다.
 *
 * ⚠️ 절대 클라이언트(브라우저)로 노출 금지. "use server" 액션 안에서만,
 *    그리고 반드시 verifyCenterSession() + org 소유 검증을 마친 뒤에만 사용한다.
 *
 * 용도: Supabase Storage 파일 업로드 / 서명 URL 발급 / 삭제 처럼
 *       RLS 정책을 따로 작성하지 않고 서버 통로에서 권한을 직접 게이트하는 작업.
 */

import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

export function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

/** 학생 첨부파일 보관함(비공개 버킷) 이름 */
export const STUDENT_FILES_BUCKET = "student-files";
