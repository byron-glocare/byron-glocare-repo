"use client";

import { useState, useMemo } from "react";

type Department = {
  id: number;
  university_id: number;
  icon: string;
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
  emoji: string;
  name: string;
  region: string;
  tags: string[];
  strengths: string;
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
  modalDeptLink: string;
  modalStrengths: string;
};

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

  const opened = openId == null ? null : universities.find((u) => u.id === openId) ?? null;

  return (
    <section id="universities" className="section">
      <div className="sec-inner">
        <div className="hdr-row">
          <div>
            <div className="sec-eyebrow">{strings.eyebrow}</div>
            <h2 className="sec-title">
              {strings.titlePrefix}
              <em>{strings.titleEm}</em>
              {strings.titleSuffix}
            </h2>
            <p className="sec-desc">{strings.desc}</p>
          </div>
        </div>

        <div
          id="courseTabWrap"
          style={{ display: "flex", gap: "1rem", marginBottom: "2.5rem" }}
        >
          <button
            type="button"
            className={`course-tab${course === "direct" ? " on" : ""}`}
            onClick={() => setCourse("direct")}
          >
            <div className="course-tab-desc">{strings.tabDirectDesc}</div>
            <div className="course-tab-title">{strings.tabDirectTitle}</div>
            <div className="course-tab-sub">{strings.tabDirectSub}</div>
          </button>
          <button
            type="button"
            className={`course-tab${course === "language" ? " on" : ""}`}
            onClick={() => setCourse("language")}
          >
            <div className="course-tab-desc">{strings.tabLangDesc}</div>
            <div className="course-tab-title">{strings.tabLangTitle}</div>
            <div className="course-tab-sub">{strings.tabLangSub}</div>
          </button>
        </div>

        <div className="uni-grid">
          {filtered.map((u) => (
            <div
              key={u.id}
              className="uni-card"
              onClick={() => setOpenId(u.id)}
            >
              <div className="uni-head">
                <div className="uni-ico">{u.emoji}</div>
                <div>
                  <div className="uni-name">{u.name}</div>
                  <div className="uni-region">{u.region}</div>
                </div>
              </div>
              <div className="uni-body">
                {u.departments.slice(0, 4).map((d) => (
                  <div key={d.id} className="dept-row">
                    <span className="dept-ico">{d.icon || "📚"}</span>
                    <span>{d.name}</span>
                    {d.badge && (
                      <span
                        className={`dept-badge ${d.badge === "hot" ? "hot" : "good"}`}
                      >
                        {d.badge === "hot" ? strings.badgeHot : strings.badgeGood}
                      </span>
                    )}
                  </div>
                ))}
                {u.tags.length > 0 && (
                  <div className="chip-row">
                    {u.tags.slice(0, 4).map((tag, i) => (
                      <span key={i} className="chip">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        className={`overlay${opened ? " on" : ""}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpenId(null);
        }}
      >
        {opened && (
          <div className="modal" style={{ maxWidth: 600 }}>
            <div className="modal-hd">
              <h3>
                {opened.emoji} {opened.name} — {strings.modalTitle}
              </h3>
              <button
                type="button"
                className="modal-x"
                onClick={() => setOpenId(null)}
              >
                ✕
              </button>
            </div>
            <div className="modal-bd">
              {opened.strengths && (
                <div
                  style={{
                    marginBottom: "1.2rem",
                    padding: "0.9rem 1.1rem",
                    background: "var(--coral-pale)",
                    border: "1px solid var(--coral-soft)",
                    borderRadius: 10,
                    fontSize: "0.85rem",
                    color: "var(--ink-mid)",
                    lineHeight: 1.6,
                  }}
                >
                  <strong style={{ color: "var(--coral-d)" }}>
                    {strings.modalStrengths}:
                  </strong>{" "}
                  {opened.strengths}
                </div>
              )}

              {opened.departments.map((d) => (
                <div key={d.id} className="mdept">
                  <div className="mdept-ico">{d.icon || "📚"}</div>
                  <div style={{ flex: 1 }}>
                    <div className="mdept-name">{d.name}</div>
                    <div className="mdept-desc">
                      {d.degree_years != null && (
                        <div>
                          {strings.modalDegree}: {d.degree_years}년
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
                        <div style={{ marginTop: "0.4rem" }}>
                          <a
                            href={d.dept_url}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              color: "var(--coral)",
                              fontWeight: 600,
                              textDecoration: "underline",
                              fontSize: "0.78rem",
                            }}
                          >
                            {strings.modalDeptLink} →
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
