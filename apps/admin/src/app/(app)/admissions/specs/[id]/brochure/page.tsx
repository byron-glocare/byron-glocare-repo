/**
 * /admissions/specs/[id]/brochure — 모집요강 PDF (베트남어 전용).
 *   ?dept=<요강 학과 id>|all (기본 all = 활성 학과 전부) · ?term=YYYY-Season (기본 가장 늦은 학기)
 *   인쇄용 A4 페이지. 브라우저 인쇄 → "PDF로 저장". 학과마다 새 페이지.
 *   어드민 레이아웃 안에서 그려지므로, 인쇄 때는 사이드바·헤더를 숨기고 스크롤 컨테이너를 푼다.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { loadBrochure, type BrochureBlock, type BrochurePage } from "@/lib/admission/brochure-data";
import { BROCHURE_FOOTER, GLOCARE_INTRO_VI, L } from "@/lib/admission/brochure-text";

import { BrochureToolbar } from "./brochure-toolbar";

export const dynamic = "force-dynamic";
/** 문서 제목 = "PDF로 저장" 기본 파일 이름 → 베트남어로 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data: spec } = await supabase.from("study_admission_specs").select("university_id").eq("id", id).maybeSingle();
  if (!spec) return { title: "Glocare" };
  const { data: uni } = await supabase.from("universities").select("name_ko, name_vi").eq("id", spec.university_id).maybeSingle();
  const name = uni?.name_vi?.trim() || uni?.name_ko || "";
  return { title: `${name} — ${L.eyebrow} · Glocare` };
}

export default async function BrochurePdfPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ dept?: string; term?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const model = await loadBrochure(supabase, id, { dept: sp.dept ?? null, term: sp.term ?? null });
  if (!model) notFound();

  return (
    <div className="bro-root">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap"
        precedence="default"
      />
      <style>{BROCHURE_CSS}</style>

      <BrochureToolbar
        specId={id}
        dept={model.dept}
        term={model.term}
        deptOptions={model.deptOptions}
        termOptions={model.termOptions}
        pageCount={model.pages.length}
      />

      <div className="bro-canvas">
        {model.pages.length === 0 ? (
          <div className="bro-empty print:hidden">표시할 학과가 없습니다. 요강 편집에서 학과를 활성으로 두거나 학과를 고르세요.</div>
        ) : (
          model.pages.map((p) => <Sheet key={p.sdId} page={p} logoUrl={model.logoUrl} />)
        )}
      </div>
    </div>
  );
}

function Sheet({ page, logoUrl }: { page: BrochurePage; logoUrl: string | null }) {
  return (
    <article className="bro-sheet" lang="vi">
      <header className="bro-band">
        <div className="bro-brand">
          <span className="bro-wordmark">{L.brand}</span>
          <span className="bro-brand-sub">{L.brandSub}</span>
        </div>
        <p className="bro-glocare">{GLOCARE_INTRO_VI}</p>
      </header>

      <section className="bro-hero">
        <div className="bro-hero-main">
          <div className="bro-eyebrow">
            {L.eyebrow}
            {page.termLabel ? <> · {page.termLabel}</> : null}
          </div>
          <div className="bro-title-row">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="bro-logo" />
            ) : null}
            <div>
              <h1 className="bro-h1">{page.universityName}</h1>
              <h2 className="bro-h2">{page.departmentName}</h2>
            </div>
          </div>
          <div className="bro-chips">
            <span className="bro-chip bro-chip-strong">{page.courseLabel}</span>
            {page.facts.map((f) => (
              <span key={f} className="bro-chip">{f}</span>
            ))}
          </div>
        </div>
        {page.quota != null ? (
          <div className="bro-quota" aria-label={L.quota(page.quota)}>
            <span className="bro-quota-label">{L.quotaLabel}</span>
            <span className="bro-quota-num">{page.quota}</span>
            <span className="bro-quota-unit">{L.quotaUnit}</span>
          </div>
        ) : null}
      </section>

      {page.intro ? <p className="bro-intro">{page.intro}</p> : null}

      {page.sections.map((s, i) => (
        <section key={s.title} className="bro-sec">
          <h3 className="bro-h3">
            <span className="bro-num">{i + 1}</span>
            {s.title}
          </h3>
          {s.blocks.map((b, j) => (
            <Block key={j} block={b} />
          ))}
        </section>
      ))}

      <footer className="bro-sheet-footer">{BROCHURE_FOOTER}</footer>
    </article>
  );
}

function Block({ block }: { block: BrochureBlock }) {
  switch (block.type) {
    case "rows":
      return (
        <div className="bro-block">
          {block.title ? <div className="bro-h4">{block.title}</div> : null}
          <dl className="bro-rows">
            {block.rows.map((r, i) => (
              <div key={i} className="bro-row">
                <dt>{r.label}</dt>
                <dd>{r.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      );
    case "list": {
      const Tag = block.ordered ? "ol" : "ul";
      return (
        <div className="bro-block">
          {block.title ? <div className="bro-h4">{block.title}</div> : null}
          <Tag className={block.ordered ? "bro-list bro-ol" : "bro-list"}>
            {block.items.map((it, i) => (
              <li key={i}>
                <span className="bro-li-text">{it.text}</span>
                {it.sub?.map((s, k) => (
                  <span key={k} className="bro-li-sub">{s}</span>
                ))}
                {it.note ? <span className="bro-li-note">{it.note}</span> : null}
              </li>
            ))}
          </Tag>
        </div>
      );
    }
    case "text":
      return (
        <div className="bro-block">
          {block.title ? <div className="bro-h4">{block.title}</div> : null}
          <p className="bro-text">{block.text}</p>
        </div>
      );
    case "footnote":
      return <p className="bro-footnote">{block.text}</p>;
  }
}

const FOOTER_CSS_STRING = JSON.stringify(BROCHURE_FOOTER);

const BROCHURE_CSS = `
@page {
  size: A4;
  margin: 14mm 14mm 16mm 14mm;
  @bottom-center {
    content: ${FOOTER_CSS_STRING};
    font-family: "Be Vietnam Pro", system-ui, sans-serif;
    font-size: 7.5pt;
    color: #8a9099;
  }
}
.bro-root {
  --bro-coral: #FF6060;
  --bro-coral-deep: #ED4747;
  --bro-tint: #FFF3F2;
  --bro-ink: #1d2127;
  --bro-muted: #5d6570;
  --bro-line: #e9e5e4;
  background: #eceef1;
  min-height: 100%;
}
.bro-root * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.bro-canvas { padding: 28px 16px 48px; overflow-x: auto; }
.bro-empty { max-width: 210mm; margin: 0 auto; padding: 32px; text-align: center; color: #5d6570; background: #fff; border-radius: 8px; }
.bro-sheet {
  font-family: "Be Vietnam Pro", system-ui, -apple-system, "Segoe UI", sans-serif;
  color: var(--bro-ink);
  background: #fff;
  width: 210mm;
  min-height: 297mm;
  margin: 0 auto 28px;
  padding: 14mm;
  box-sizing: border-box;
  box-shadow: 0 1px 3px rgba(20, 24, 30, .08), 0 8px 24px rgba(20, 24, 30, .08);
  font-size: 9.6pt;
  line-height: 1.55;
  position: relative;
}
.bro-band {
  display: flex;
  align-items: center;
  gap: 16px;
  background: var(--bro-coral);
  background: linear-gradient(100deg, var(--bro-coral-deep) 0%, var(--bro-coral) 100%);
  color: #fff;
  border-radius: 6px;
  padding: 10px 16px;
}
.bro-brand { display: flex; flex-direction: column; flex-shrink: 0; padding-right: 16px; border-right: 1px solid rgba(255,255,255,.45); }
.bro-wordmark { font-weight: 800; font-size: 13pt; letter-spacing: .14em; line-height: 1.1; }
.bro-brand-sub { font-size: 7pt; letter-spacing: .06em; text-transform: uppercase; opacity: .9; }
.bro-glocare { margin: 0; font-size: 7.8pt; line-height: 1.5; opacity: .97; }

.bro-hero { display: flex; align-items: stretch; gap: 16px; margin: 18px 0 6px; padding-bottom: 14px; border-bottom: 2px solid var(--bro-ink); }
.bro-hero-main { flex: 1; min-width: 0; }
.bro-eyebrow { color: var(--bro-coral-deep); font-weight: 700; font-size: 8pt; letter-spacing: .08em; text-transform: uppercase; }
.bro-title-row { display: flex; align-items: center; gap: 12px; margin-top: 4px; }
.bro-logo { width: 44px; height: 44px; object-fit: contain; flex-shrink: 0; }
.bro-h1 { margin: 0; font-size: 19pt; font-weight: 800; line-height: 1.2; letter-spacing: -.01em; }
.bro-h2 { margin: 2px 0 0; font-size: 12.5pt; font-weight: 600; color: var(--bro-muted); line-height: 1.3; }
.bro-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.bro-chip { display: inline-block; font-size: 7.8pt; font-weight: 500; padding: 2px 9px; border-radius: 999px; border: 1px solid var(--bro-line); color: var(--bro-muted); background: #fafafa; }
.bro-chip-strong { border-color: var(--bro-coral); color: var(--bro-coral-deep); background: var(--bro-tint); font-weight: 600; }
.bro-quota { flex-shrink: 0; width: 30mm; display: flex; flex-direction: column; align-items: center; justify-content: center; border-radius: 6px; background: var(--bro-tint); border: 1px solid #ffd2cf; color: var(--bro-coral-deep); text-align: center; padding: 8px 6px; }
.bro-quota-label { font-size: 7.5pt; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.bro-quota-num { font-size: 24pt; font-weight: 800; line-height: 1.1; }
.bro-quota-unit { font-size: 8pt; font-weight: 600; }

.bro-intro { margin: 12px 0 4px; padding: 8px 12px; border-left: 3px solid var(--bro-coral); background: #fbfbfb; white-space: pre-line; color: #2b3038; }

.bro-sec { margin-top: 16px; }
.bro-h3 { display: flex; align-items: center; gap: 8px; margin: 0 0 8px; font-size: 11.5pt; font-weight: 700; break-after: avoid; page-break-after: avoid; }
.bro-num { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 50%; background: var(--bro-coral); color: #fff; font-size: 8.5pt; font-weight: 700; flex-shrink: 0; }
.bro-h3::after { content: ""; flex: 1; height: 1px; background: var(--bro-line); margin-left: 4px; }
.bro-block { margin: 0 0 10px 28px; }
.bro-h4 { font-weight: 700; font-size: 9pt; color: var(--bro-coral-deep); margin: 0 0 4px; break-after: avoid; page-break-after: avoid; }
.bro-rows { margin: 0; border-top: 1px solid var(--bro-line); }
.bro-row { display: grid; grid-template-columns: 38mm 1fr; gap: 10px; padding: 5px 0; border-bottom: 1px solid var(--bro-line); break-inside: avoid; page-break-inside: avoid; }
.bro-row dt { font-weight: 600; color: var(--bro-muted); }
.bro-row dd { margin: 0; white-space: pre-line; }
.bro-text { margin: 0; white-space: pre-line; }
.bro-list { margin: 0; padding-left: 18px; }
.bro-list li { margin: 0 0 4px; padding-left: 2px; break-inside: avoid; page-break-inside: avoid; }
.bro-list li::marker { color: var(--bro-coral); }
.bro-ol li::marker { font-weight: 700; font-size: 8.5pt; }
.bro-li-text { display: block; }
.bro-li-sub { display: block; color: var(--bro-muted); font-size: 8.5pt; }
.bro-li-note { display: block; color: var(--bro-muted); font-size: 8.5pt; font-style: italic; white-space: pre-line; }
.bro-footnote { margin: 4px 0 0 28px; font-size: 8pt; color: var(--bro-muted); }
.bro-sheet-footer { position: absolute; left: 14mm; right: 14mm; bottom: 7mm; text-align: center; font-size: 7.5pt; color: #8a9099; border-top: 1px solid var(--bro-line); padding-top: 4px; }

@media print {
  html, body { background: #fff !important; height: auto !important; overflow: visible !important; }
  aside, header[data-app-header], [data-sonner-toaster] { display: none !important; }
  .flex.min-h-svh, .flex.min-h-svh > div, .flex.min-h-svh > div > div {
    display: block !important;
    min-height: 0 !important;
    height: auto !important;
    overflow: visible !important;
    background: #fff !important;
  }
  .bro-root { background: #fff; }
  .bro-canvas { padding: 0; overflow: visible; }
  .bro-sheet { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; font-size: 9.4pt; }
  .bro-sheet + .bro-sheet { break-before: page; page-break-before: always; }
  .bro-sheet-footer { display: none; }
}
`;
