import Link from "next/link";

import { getDict } from "@/lib/i18n";

export async function SiteFooter() {
  const t = await getDict();
  return (
    <footer className="site-footer">
      <div className="foot-inner">
        {/* 좌측 로고 + 정책 */}
        <div>
          <div className="foot-logo">
            <span className="logo-text">GLOCARE</span>
          </div>
          <div
            style={{
              display: "flex",
              gap: "0.6rem",
              fontSize: "0.81rem",
              color: "rgba(255,255,255,0.5)",
              marginTop: "0.6rem",
            }}
          >
            <Link href="/terms" style={{ color: "inherit" }}>
              {t["footer.terms"]}
            </Link>
            <span style={{ opacity: 0.4 }}>|</span>
            <Link href="/privacy" style={{ color: "inherit" }}>
              {t["footer.privacy"]}
            </Link>
          </div>
        </div>

        {/* 회사 정보 */}
        <div>
          <div className="foot-h">회사 정보</div>
          <ul className="foot-ul">
            <li style={{ cursor: "default" }}>
              <span style={{ color: "rgba(255,255,255,0.5)" }}>상호명</span>{" "}
              주식회사 글로케어
            </li>
            <li style={{ cursor: "default" }}>
              <span style={{ color: "rgba(255,255,255,0.5)" }}>대표이사</span>{" "}
              홍강식
            </li>
            <li style={{ cursor: "default" }}>
              <span style={{ color: "rgba(255,255,255,0.5)" }}>사업자번호</span>{" "}
              239-87-03310
            </li>
            <li style={{ cursor: "default", lineHeight: 1.5 }}>
              <span style={{ color: "rgba(255,255,255,0.5)" }}>
                직업정보제공사업
              </span>
              <br />
              J1202020260002 (서울동부 제2026-2호)
            </li>
          </ul>
        </div>

        {/* 연락처 */}
        <div>
          <div className="foot-h">연락처</div>
          <ul className="foot-ul">
            <li>
              <a
                href="tel:0245360724"
                style={{ color: "inherit", textDecoration: "none" }}
              >
                <span style={{ color: "rgba(255,255,255,0.5)" }}>제휴문의</span>{" "}
                02-456-0724
              </a>
            </li>
            <li>
              <a
                href="mailto:help@glocare.co.kr"
                style={{ color: "inherit", textDecoration: "none" }}
              >
                help@glocare.co.kr
              </a>
            </li>
            <li
              style={{
                cursor: "default",
                fontSize: "0.78rem",
                lineHeight: 1.6,
              }}
            >
              <span style={{ color: "rgba(255,255,255,0.5)" }}>주소</span>
              <br />
              05029 서울특별시 광진구 능동로 120,
              <br />
              창의관 2층 202호 (화양동, 건국대학교)
            </li>
          </ul>
        </div>
      </div>

      <div className="foot-bot">
        <span>Copyright © 2025 Glocare Corp. All Rights Reserved.</span>
        <div style={{ display: "flex", gap: "0.7rem", alignItems: "center" }}>
          <span style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.4)" }}>
            글로케어의 다양한 소식을 만나보세요
          </span>
          <SocialIcon
            href="https://facebook.com/glocare"
            label="Facebook"
            svg={
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
            }
          />
          <SocialIcon
            href="https://youtube.com/@glocare"
            label="YouTube"
            svg={
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
              </svg>
            }
          />
          <SocialIcon
            href="https://pf.kakao.com/glocare"
            label="KakaoTalk"
            svg={
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 3C6.48 3 2 6.48 2 10.8c0 2.84 1.86 5.32 4.65 6.7l-1.13 4.13c-.1.36.31.67.6.45L11 18.62c.33.03.67.04 1 .04 5.52 0 10-3.48 10-7.86C22 6.48 17.52 3 12 3z" />
              </svg>
            }
          />
          <SocialIcon
            href="https://tiktok.com/@glocare"
            label="TikTok"
            svg={
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V8.1a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.05c-.27-.04-.55-.1-.84-.18z" />
              </svg>
            }
          />
        </div>
      </div>
    </footer>
  );
}

function SocialIcon({
  href,
  label,
  svg,
}: {
  href: string;
  label: string;
  svg: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 28,
        height: 28,
        borderRadius: "50%",
        background: "rgba(255,255,255,0.08)",
        color: "rgba(255,255,255,0.7)",
        transition: "all 0.2s",
      }}
    >
      {svg}
    </a>
  );
}
