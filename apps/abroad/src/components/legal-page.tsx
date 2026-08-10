import type { ReactNode } from "react";

/**
 * 약관·정책 문서 공용 껍데기 (이용약관 / 개인정보처리방침 / 취소·환불 규정).
 * 디자인 시스템 섹션 골격을 그대로 쓰고, 본문만 문서별로 채운다.
 */
export function LegalPage({
  eyebrow,
  title,
  updatedAt,
  children,
}: {
  eyebrow: string;
  title: string;
  updatedAt: string;
  children: ReactNode;
}) {
  return (
    <section className="section">
      <div className="sec-inner">
        <div className="sec-head">
          <div className="sec-eyebrow">{eyebrow}</div>
          <h1 className="sec-title">{title}</h1>
          <p className="sec-desc gc-mono">{updatedAt}</p>
        </div>
        <div className="legal-body">{children}</div>
      </div>
    </section>
  );
}

/** 조(條) 하나. */
export function Article({
  no,
  title,
  children,
}: {
  no: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <article className="legal-art">
      <h2>
        {no} {title}
      </h2>
      {children}
    </article>
  );
}
