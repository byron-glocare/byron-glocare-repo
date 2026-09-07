import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getDict, getLocale, tr } from "@/lib/i18n";
import { universityFeatures } from "@/lib/university-features";

export const dynamic = "force-dynamic";

function initials(name: string): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "—";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export default async function UniversityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const locale = await getLocale();
  const t = await getDict();

  // active 필터를 코드에서 명시한다.
  //   RLS 의 anon 정책은 active=true 만 주지만, 이 앱은 같은 도메인에 학생/센터
  //   로그인이 있어서 로그인한 방문자는 authenticated 로 붙는다. 그쪽 정책은
  //   using(true) 라 비공개 대학까지 보였다 — 어드민 설정과 어긋나던 원인.
  const { data: u } = await supabase
    .from("universities")
    .select("*")
    .eq("id", Number(id))
    .eq("active", true)
    .maybeSingle();

  if (!u) notFound();

  const { data: depts } = await supabase
    .from("departments")
    .select("*")
    .eq("university_id", u.id)
    .eq("active", true)
    .order("sort_order")
    .order("id");

  const name = (locale === "vi" ? (u.name_vi ?? u.name_ko) : u.name_ko) ?? "";
  const region = locale === "vi" ? (u.region_vi ?? u.region_ko) : u.region_ko;
  const desc = locale === "vi" ? (u.desc_vi ?? u.desc_ko) : u.desc_ko;
  // 어드민 '홈페이지 노출 정보'의 특징/강점 체크
  const features = universityFeatures(u, locale);

  // 어드민에서 실제로 입력할 수 있는 항목만 노출한다.
  //   빠져 있던 두 줄:
  //     · 강점(strengths)  — 0025 에서 특징 체크 4종으로 대체되며 어드민 입력칸이 사라졌다
  //                          (컬럼은 내부 메모로 보존). 위 features 칩이 그 자리를 대신한다.
  //     · 수업일(class_days) — 어드민에 입력칸이 아예 없다.
  //   둘 다 값이 없어 filter 로 걸러지긴 했지만, 채울 방법이 없는 자리를 코드에
  //   남겨두면 다음 사람이 또 "왜 안 나오지" 를 겪는다.
  const facts = [
    {
      k: tr(locale, "교통", "Giao thông"),
      v:
        locale === "vi"
          ? (u.transport_desc_vi ?? u.transport_desc_ko)
          : u.transport_desc_ko,
    },
    {
      k: tr(locale, "기숙사", "Ký túc xá"),
      v: u.dormitory
        ? locale === "vi"
          ? (u.dormitory_desc_vi ?? u.dormitory_desc_ko)
          : u.dormitory_desc_ko
        : null,
    },
  ].filter((f) => f.v);

  return (
    <section className="section">
      <div className="sec-inner">
        <div className="sec-head">
          <div className="gc-logo" style={{ marginBottom: 16 }}>
            {u.logo_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={u.logo_url} alt="" />
            ) : (
              initials(name)
            )}
          </div>
          {region && <div className="sec-eyebrow">{region}</div>}
          <h1 className="sec-title">{name}</h1>
          {features.length > 0 && (
            <div className="chip-row" style={{ justifyContent: "center" }}>
              {features.map((f) => (
                <span key={f} className="chip">
                  {f}
                </span>
              ))}
            </div>
          )}
          {desc && (
            <p className="sec-desc" style={{ whiteSpace: "pre-line" }}>
              {desc}
            </p>
          )}
          {/* 대표 사진 — 어드민에 올린 경우에만. 없으면 자리도 만들지 않는다. */}
          {u.photo_url && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={u.photo_url}
              alt=""
              style={{
                display: "block",
                width: "100%",
                maxWidth: 720,
                margin: "var(--gc-6, 24px) auto 0",
                borderRadius: "var(--gc-r-card, 14px)",
                boxShadow: "var(--gc-shadow-sm)",
                objectFit: "cover",
              }}
            />
          )}
          {u.website_url && (
            <a
              href={u.website_url}
              target="_blank"
              rel="noreferrer"
              className="gc-btn gc-btn-ghost"
              style={{ paddingLeft: 0, marginTop: 8 }}
            >
              {u.website_url}
              <span className="arrow" aria-hidden>
                →
              </span>
            </a>
          )}
        </div>

        {facts.length > 0 && (
          <div className="gc-grid gc-grid-2" style={{ marginBottom: 40 }}>
            {facts.map((f) => (
              <div key={f.k} className="gc-card">
                <div className="gc-eyebrow-sm">{f.k}</div>
                <div style={{ marginTop: 6 }}>{f.v}</div>
              </div>
            ))}
          </div>
        )}

        {depts && depts.length > 0 && (
          <>
            <h2 className="sec-title" style={{ fontSize: 21, marginBottom: 16 }}>
              {tr(locale, "학과", "Ngành học")}
            </h2>
            <div className="gc-grid gc-grid-2">
              {depts.map((d) => (
                <div key={d.id} className="gc-card">
                  <div className="gc-card-head">
                    <div className="gc-card-title" style={{ fontSize: 16 }}>
                      {locale === "vi" ? (d.name_vi ?? d.name_ko) : d.name_ko}
                    </div>
                    {d.badge === "hot" && (
                      <span className="gc-badge gc-badge-solid">
                        {tr(locale, "인기", "HOT")}
                      </span>
                    )}
                  </div>
                  <div className="gc-step-desc" style={{ marginTop: 10 }}>
                    {d.degree_years != null && (
                      <div>
                        {tr(locale, "수학 기간", "Thời gian học")}:{" "}
                        {d.degree_years}
                        {tr(locale, "년", " năm")}
                      </div>
                    )}
                    {d.tuition_ko && (
                      <div>
                        {tr(locale, "등록금", "Học phí")}:{" "}
                        {locale === "vi"
                          ? (d.tuition_vi ?? d.tuition_ko)
                          : d.tuition_ko}
                      </div>
                    )}
                    {d.scholarship_ko && (
                      <div>
                        {tr(locale, "장학금", "Học bổng")}:{" "}
                        {locale === "vi"
                          ? (d.scholarship_vi ?? d.scholarship_ko)
                          : d.scholarship_ko}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div style={{ marginTop: 40 }}>
          <a href="/#apply" className="btn-coral">
            {t["nav.apply"]}
          </a>
        </div>
      </div>
    </section>
  );
}
