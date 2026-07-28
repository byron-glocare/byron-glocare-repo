import { createAdminClient } from "@/lib/supabase/server";
import { loadStudentValues } from "@/lib/test/student-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /test/form-fill/student?id={studentId}
 *   → { name, values: {key: 값} }  — 자동 매핑(체크박스)·미리보기용.
 *   (admin 전체가 glocare_admin 게이트 하에 있어 별도 게이트 불필요)
 */
export async function GET(req: Request): Promise<Response> {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ error: "id 누락" }, { status: 400 });
  try {
    const supabase = createAdminClient();
    const { name, values } = await loadStudentValues(supabase, id);
    return Response.json({ name, values });
  } catch (e) {
    return Response.json(
      { error: (e as Error).message ?? "학생 데이터를 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}
