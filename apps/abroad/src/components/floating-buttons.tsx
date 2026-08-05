"use client";

import { useState } from "react";

type Strings = {
  zaloTitle: string;
  zaloDesc: string;
  close: string;
};

/**
 * 플로팅 — 디자인 시스템: 화면에 하나만.
 * Zalo 버튼 하나로 합치고, 전화번호는 그 안에서 펼친다.
 */
export function FloatingButtons({ strings }: { strings: Strings }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="float-wrap">
        <button
          type="button"
          className="float-btn"
          onClick={() => setOpen(true)}
          aria-label="Zalo"
        >
          Zalo
        </button>
      </div>

      <div
        className={`zalo-qr-overlay${open ? " on" : ""}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpen(false);
        }}
      >
        <div className="zalo-qr-box" role="dialog" aria-modal>
          <h3>{strings.zaloTitle}</h3>
          <p>{strings.zaloDesc}</p>

          <div className="gc-card" style={{ textAlign: "left" }}>
            <div className="process-contact-l">Zalo</div>
            <a
              href="https://zalo.me/821022568724"
              target="_blank"
              rel="noreferrer"
              className="process-contact-v"
            >
              +82-10-2256-8724
            </a>
            <div className="process-contact-l" style={{ marginTop: 12 }}>
              Hotline
            </div>
            <a href="tel:0977456324" className="process-contact-v">
              0977.456.324
            </a>
          </div>

          <button
            type="button"
            className="qr-close"
            onClick={() => setOpen(false)}
          >
            {strings.close}
          </button>
        </div>
      </div>
    </>
  );
}
