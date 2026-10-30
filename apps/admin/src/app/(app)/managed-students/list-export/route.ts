import { NextResponse } from "next/server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isGlocareAdmin } from "@/lib/admin-guard";
import { buildSimpleXlsx } from "@/lib/simple-xlsx";
import {
  APP_STATUS_KO,
  filterStudents,
  loadStudentApplications,
  parseListFilter,
} from "@/lib/study/student-applications";

/**
 * GET /managed-students/list-export?<목록 화면과 같은 조건>
 *   유학생 목록 엑셀 — 지금 화면 조건 그대로, 6칸(2026-10-30 학생관리업무 반영).
 *     이름 · 주민번호 · 현재 진행단계 · 유학센터 · 대학교 · 전공
 *   지원이 여러 개면 지원마다 한 줄(대학교 칸에 'N지망'). 지원이 없는 학생은 한 줄(대학·전공 빈칸).
 *   주민번호 = 외국인등록번호, 없으면 본인 신분증 번호(CCCD) — 뒤에 (CCCD) 표기.
 *   진행단계는 지금 지원 단계값의 한국어(단계 재정의 전까지).
 *   (route handler 는 (app) layout 게이트를 안 거치므로 여기서 직접 권한 확인)
 */
export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isGlocareAdmin(user)) return new NextResponse("Forbidden", { status: 403 });

  const url = new URL(req.url);
  const filter = parseListFilter(Object.fromEntries(url.searchParams.entries()));

  const admin = createAdminClient();
  const [{ data: students }, { data: orgs }, appsByStudent] = await Promise.all([
    admin
      .from("study_managed_students")
      .select("id, org_id, source, name, phone, email, location, created_at")
      .order("created_at", { ascending: false }),
    admin.from("study_center_orgs").select("id, name_ko, name_vi"),
    loadStudentApplications(admin),
  ]);
  const rows = filterStudents(students ?? [], filter, appsByStudent);

  // 주민번호 — 학생 정보 입력 값에서
  const ids = rows.map((s) => s.id);
  const idNo = new Map<string, { frn?: string; cccd?: string }>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data: vals } = await admin
      .from("study_student_data_values")
      .select("student_id, data_type_key, value")
      .in("student_id", ids.slice(i, i + 200))
      .in("data_type_key", ["foreign_registration_no", "national_id_no"]);
    for (const v of vals ?? []) {
      const text = textOf(v.value);
      if (!text) continue;
      const cur = idNo.get(v.student_id) ?? {};
      if (v.data_type_key === "foreign_registration_no") cur.frn = text;
      else cur.cccd = text;
      idNo.set(v.student_id, cur);
    }
  }

  const orgName = new Map((orgs ?? []).map((o) => [o.id, o.name_ko || o.name_vi]));
  const out: string[][] = [];
  for (const s of rows) {
    const n = idNo.get(s.id);
    const idText = n?.frn ?? (n?.cccd ? `${n.cccd} (CCCD)` : "");
    const center = (s.org_id ? orgName.get(s.org_id) : null) ?? (s.source === "self" ? "본사 직접 (B2C)" : "");
    const apps = appsByStudent.get(s.id) ?? [];
    if (apps.length === 0) {
      out.push([s.name, idText, "", center, "", ""]);
      continue;
    }
    for (const a of apps) {
      out.push([
        s.name,
        idText,
        APP_STATUS_KO[a.status] ?? a.status,
        center,
        `${a.university}${a.priority ? ` (${a.priority}지망)` : ""}${a.termLabel ? ` · ${a.termLabel}` : ""}`,
        a.dept,
      ]);
    }
  }

  const buf = await buildSimpleXlsx(
    "유학생 목록",
    [
      { header: "이름", width: 24 },
      { header: "주민번호", width: 22 },
      { header: "현재 진행단계", width: 16 },
      { header: "유학센터", width: 30 },
      { header: "대학교", width: 34 },
      { header: "전공", width: 24 },
    ],
    out
  );
  const stamp = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date()).replace(/-/g, "");
  const fname = encodeURIComponent(`유학생목록_${stamp}.xlsx`);
  return new NextResponse(buf as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${fname}`,
      "Cache-Control": "no-store",
    },
  });
}

/** 입력 값(JSON) → 글자. 문자열이거나 {value} 모양 */
function textOf(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  if (typeof v === "object" && "value" in (v as Record<string, unknown>)) return textOf((v as { value: unknown }).value);
  return "";
}
