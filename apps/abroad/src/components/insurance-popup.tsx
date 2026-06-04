"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "ins_popup_dismissed_until";

type Strings = {
  badge: string;
  title: string;
  desc: string;
  cta: string;
  skip: string;
};

export function InsurancePopup({ strings }: { strings: Strings }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const until = localStorage.getItem(STORAGE_KEY);
      if (until) {
        const ts = parseInt(until, 10);
        if (Number.isFinite(ts) && Date.now() < ts) return;
      }
      const timer = setTimeout(() => setOpen(true), 2000);
      return () => clearTimeout(timer);
    } catch {
      const timer = setTimeout(() => setOpen(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  function close() {
    setOpen(false);
  }

  function dismissToday() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        String(Date.now() + 24 * 60 * 60 * 1000)
      );
    } catch {
      // localStorage may be unavailable in private mode
    }
    setOpen(false);
  }

  function goToForm() {
    setOpen(false);
    const el = document.getElementById("apply-form");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div
      className={`ins-popup-overlay${open ? " on" : ""}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="ins-popup" role="dialog" aria-modal="true">
        <button
          type="button"
          className="ins-popup-close"
          onClick={close}
          aria-label="Close"
        >
          ✕
        </button>
        <div className="ins-popup-body">
          <div className="ins-popup-badge">{strings.badge}</div>
          <h3
            className="ins-popup-title"
            dangerouslySetInnerHTML={{ __html: strings.title }}
          />
          <p className="ins-popup-desc">{strings.desc}</p>
          <button
            type="button"
            className="ins-popup-cta"
            onClick={goToForm}
          >
            {strings.cta}
          </button>
          <button
            type="button"
            className="ins-popup-skip"
            onClick={dismissToday}
          >
            {strings.skip}
          </button>
        </div>
      </div>
    </div>
  );
}
