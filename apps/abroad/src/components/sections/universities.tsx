"use client";

import { useState, useMemo } from "react";

type Department = {
  id: number;
  university_id: number;
  name: string;
  badge: string | null;
  course: string | null;
  degree_years: number | null;
  tuition: string;
  scholarship: string;
  dept_url: string | null;
};

export type UniversityCard = {
  id: number;
  name: string;
  region: string;
  logoUrl: string | null;
  tags: string[];
  /** 어드민 '상세 설명' — 모달에 노출 */
  desc: string;
  departments: Department[];
};

type Strings = {
  eyebrow: string;
  titlePrefix: string;
  titleEm: string;
  titleSuffix: string;
  desc: string;
  tabDirectDesc: string;
  tabDirectTitle: string;
  tabDirectSub: string;
  tabLangDesc: string;
  tabLangTitle: string;
  tabLangSub: string;
  badgeHot: string;
  badgeGood: string;
  modalTitle: string;
  modalTuition: string;
  modalScholarship: string;
  modalDegree: string;
  modalYearUnit: string;
  modalDeptLink: string;
  modalMore: string;
};

/** 대학 이름에서 로고 대체용 이니셜 2자 (이모지 대신). */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "—";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export function Universities({
  universities,
  strings,
}: {
  universities: UniversityCard[];
  strings: Strings;
}) {
  const [course, setCourse] = useState<"direct" | "language">("direct");
  const [openId, setOpenId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    return universities
      .map((u) => ({
        ...u,
        departments: u.departments.filter(
          (d) => !d.course || d.course === course
        ),
      }))
      .filter((u) => u.departments.length > 0);
  }, [universities, course]);

  const opened =
    openId == null ? null : universities.find((u) => u.id === openId) ?? null;

  /* 탭 카드에는 지원 조건을, 그 아래 한 줄에는 코스 설명을 둔다. */
  const activeNote =
    course === "direct" ? strings.tabDirectSub : strings.tabLangSub;

  return (
    <section id="universities" className="section on-surface">
      <div className="sec-inner">
        <div className="sec-head">
          <div className="sec-eyebrow">{strings.eyebrow}</div>
          <h2 className="sec-title">
            {strings.titlePrefix}
            <em>{strings.titleEm}</em>
            {strings.titleSuffix}
          </h2>
          <p className="sec-desc">{strings.desc}</p>
        </div>

        {/* 입학 경로 — 카드형 탭 2개 */}
        <div className="course-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={course === "direct"}
            className={`course-tab${course === "direct" ? " on" : ""}`}
            onClick={() => setCourse("direct")}
          >
            <div className="course-tab-title">{strings.tabDirectTitle}</div>
            <div className="course-tab-sub">{strings.tabDirectSub}</div>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={course === "language"}
            className={`course-tab${course === "language" ? " on" : ""}`}
            onClick={() => setCourse("language")}
          >
            <div className="course-tab-title">{strings.tabLangTitle}</div>
            <div className="course-tab-sub">{strings.tabLangSub}</div>
          </button>
        </div>
        {activeNote && <p className="course-note">{activeNote}</p>}

        <div className="uni-grid">
          {filtered.map((u) => {
            const hasHot = u.departments.some((d) => d.badge === "hot");
            return (
              <div
                key={u.id}
                className="uni-card"
                role="button"
                tabIndex={0}
                onClick={() => setOpenId(u.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setOpenId(u.id);
                }}
              >
                <div className="uni-head">
                  <div className="gc-logo">
                    {u.logoUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={u.logoUrl} alt="" />
                    ) : (
                      initials(u.name)
                    )}
                  </div>
                  {/* solid 배지는 카드당 1개 */}
                  {hasHot && (
                    <span className="gc-badge gc-badge-solid">
                      {strings.badgeHot}
                    </span>
                  )}
                </div>

                <div>
                  {u.region && <div className="uni-region">{u.region}</div>}
                  <div className="uni-name">{u.name}</div>
                </div>

                <div className="gc-dotlist">
                  {u.departments.slice(0, 4).map((d) => (
                    <div key={d.id} className="gc-dotrow">
                      <span
                        className={`gc-dot${d.badge === "hot" ? " is-hot" : ""}`}
                      />
                      <span>{d.name}</span>
                    </div>
                  ))}
                </div>

                {u.tags.length > 0 && (
                  <div className="chip-row">
                    {u.tags.slice(0, 3).map((tag, i) => (
                      <span key={i} className="chip">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div
        className={`overlay${opened ? " on" : ""}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpenId(null);
        }}
      >
        {opened && (
          <div className="modal" role="dialog" aria-modal>
            <div className="modal-hd">
              <h3>
                {opened.name} — {strings.modalTitle}
              </h3>
              <button
                type="button"
                className="modal-x"
                onClick={() => setOpenId(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="modal-bd">
              {/* 어드민 '상세 설명'(desc). 지금까지 홈 섹션에 이걸 그리는 자리가
                  없어서, 운영자가 길게 적어둔 설명이 어디에도 안 보였다.
                  (설명을 그리던 /universities 목록·상세 페이지는 사이트 어디에서도
                   링크가 없어 사실상 도달 불가였다 — 아래 '자세히 보기'로 연결.) */}
              {opened.desc && (
                <p
                  className="modal-desc"
                  style={{ whiteSpace: "pre-line", marginBottom: 20 }}
                >
                  {opened.desc}
                </p>
              )}

              {opened.departments.map((d) => (
                <div key={d.id} className="mdept">
                  <span
                    className={`gc-dot${d.badge === "hot" ? " is-hot" : ""}`}
                    style={{ marginTop: 10 }}
                  />
                  <div style={{ flex: 1 }}>
                    <div className="mdept-name">{d.name}</div>
                    <div className="mdept-desc">
                      {d.degree_years != null && (
                        <div>
                          {strings.modalDegree}: {d.degree_years}
                          {strings.modalYearUnit}
                        </div>
                      )}
                      {d.tuition && (
                        <div>
                          {strings.modalTuition}: {d.tuition}
                        </div>
                      )}
                      {d.scholarship && (
                        <div>
                          {strings.modalScholarship}: {d.scholarship}
                        </div>
                      )}
                      {d.dept_url && (
                        <a
                          href={d.dept_url}
                          target="_blank"
                          rel="noreferrer"
                          className="gc-btn gc-btn-ghost"
                          style={{ paddingLeft: 0 }}
                        >
                          {strings.modalDeptLink}
                          <span className="arrow" aria-hidden>
                            →
                          </span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* 대학 상세 페이지로 — 사진·교통·기숙사 등 나머지 정보가 거기 있다.
                  이 링크가 없으면 /universities/[id] 에 도달할 길이 없다. */}
              <a
                href={`/universities/${opened.id}`}
                className="gc-btn gc-btn-ghost"
                style={{ paddingLeft: 0, marginTop: 8 }}
              >
                {strings.modalMore}
                <span className="arrow" aria-hidden>
                  →
                </span>
              </a>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
