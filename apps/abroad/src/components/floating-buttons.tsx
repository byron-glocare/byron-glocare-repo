"use client";

import { useState } from "react";

type Strings = {
  zaloTitle: string;
  zaloDesc: string;
  close: string;
};

export function FloatingButtons({ strings }: { strings: Strings }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="float-wrap">
        <button
          type="button"
          className="float-btn zalo"
          onClick={() => setOpen(true)}
          title="Zalo"
          aria-label="Zalo"
        >
          <svg
            width="26"
            height="26"
            viewBox="0 0 48 48"
            fill="none"
            aria-hidden
          >
            <path
              d="M24 2C11.85 2 2 11.07 2 22.35c0 6.15 3.08 11.65 7.9 15.35-.2 1.95-.75 4.6-2.1 6.85 0 0 4.7-.55 8.35-3.3 2.5.7 5.15 1.1 7.85 1.1 12.15 0 22-9.07 22-20.35S36.15 2 24 2z"
              fill="white"
            />
            <text
              x="24"
              y="30"
              textAnchor="middle"
              fontSize="16"
              fontWeight="900"
              fill="#0068FF"
              fontFamily="Arial"
            >
              Z
            </text>
          </svg>
        </button>
        <a
          className="float-btn phone"
          href="tel:0977456324"
          title="Gọi điện"
          aria-label="Phone"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1C10.07 21 3 13.93 3 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.46.57 3.58a1 1 0 01-.24 1.01l-2.2 2.2z"
              fill="white"
            />
          </svg>
        </a>
      </div>

      <div
        className={`zalo-qr-overlay${open ? " on" : ""}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpen(false);
        }}
      >
        <div className="zalo-qr-box">
          <h3>{strings.zaloTitle}</h3>
          <p>{strings.zaloDesc}</p>
          <div
            style={{
              width: 240,
              height: 240,
              borderRadius: 12,
              background: "var(--peach)",
              margin: "0 auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.78rem",
              color: "var(--ink-xlight)",
            }}
          >
            QR
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
