"use client";

import { useState, useMemo } from "react";

type Department = {
  id: number;
  university_id: number;
  icon: string;
  name: string;
  badge: string | null;
  course: string | null;
};

export type UniversityCard = {
  id: number;
  emoji: string;
  name: string;
  region: string;
  tags: string[];
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
};

export function Universities({
  universities,
  strings,
}: {
  universities: UniversityCard[];
  strings: Strings;
}) {
  const [course, setCourse] = useState<"direct" | "language">("direct");

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
            <div key={u.id} className="uni-card">
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
    </section>
  );
}
