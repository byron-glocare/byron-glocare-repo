/**
 * 작성서류(학교 양식) 판정용 표준 키 집합.
 *
 *   표준데이터 중 category=document 이고 is_form_doc=true 인 key 들.
 *   모집요강 서류에 std_key 가 붙어 있으면 [작성]/[발급] 분류는 이 집합을 따른다
 *   (classify-documents 의 formDocKeys). 운영자가 어드민 데이터 메뉴에서
 *   '서류 종류'를 바꾸면, 센터·학생 화면의 서류 분류도 함께 바뀐다.
 *
 *   비활성 표준도 포함한다 — 비활성화된 표준을 아직 가리키는 요강이 있어도
 *   분류가 흔들리지 않게.
 *
 *   admin 쪽 같은 이름 파일과 동작을 맞춘다.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

export async function loadFormDocKeys(supabase: Client): Promise<Set<string>> {
  const { data } = await supabase
    .from("study_student_data_types")
    .select("key")
    .eq("category", "document")
    .eq("is_form_doc", true);
  return new Set((data ?? []).map((r) => r.key));
}
