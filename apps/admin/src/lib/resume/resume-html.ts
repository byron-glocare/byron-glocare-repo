import type { ResumeContent } from "@/lib/validators";

/** HTML 이스케이프 */
function esc(s: string | null | undefined): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const CE = 'contenteditable="true" spellcheck="false"';

/** 이력서 편집기 CSS (제공 디자인 원본). 화면 편집 + A4 인쇄 겸용. */
export const RESUME_CSS = `
  .resume-root { --brand:#FF6464; --primary:#D94545; --text:#1A1A1A; --muted:#555050;
    --frame:#6E6865; --rule:#8F8986; --line:#BDB5B2; --side:#F5F3F2;
    --font:"Malgun Gothic","맑은 고딕","Apple SD Gothic Neo","Noto Sans KR",sans-serif;
    color:var(--text); font-family:var(--font); font-size:12pt; line-height:1.5; word-break:keep-all; overflow-wrap:anywhere;
    -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .resume-root * { box-sizing:border-box; }
  @page { size:A4; margin:8mm 8mm 12mm; }
  .resume-root .sheet { position:relative; width:194mm; margin:8mm auto 24mm; background:#fff; border:1pt solid var(--frame); padding:9mm;
    -webkit-box-decoration-break:clone; box-decoration-break:clone; box-shadow:0 2px 12px rgba(0,0,0,.12); }
  .resume-root .inner { position:relative; min-height:259mm; }
  .resume-root .doc-title { margin:-2mm 0 4mm; padding-bottom:2mm; text-align:center; font-size:20pt; font-weight:700; letter-spacing:.6em; text-indent:.6em; line-height:1.3; border-bottom:1pt solid var(--rule); position:relative; }
  .resume-root .doc-title::after { content:""; position:absolute; left:50%; bottom:-1.5pt; width:14mm; height:2pt; margin-left:-7mm; background:var(--brand); }
  .resume-root .top { display:flex; gap:6mm; align-items:flex-start; }
  .resume-root .side { background:var(--side); padding:6mm 4.5mm 5mm; flex:0 0 56mm; width:56mm; }
  .resume-root .top > main { flex:1 1 0; min-width:0; }
  .resume-root .photo { display:block; width:36mm; margin:0 auto 4mm; padding:2mm; background:#fff; border:1pt solid var(--brand); cursor:pointer; }
  .resume-root .photo img { display:block; width:100%; aspect-ratio:3/4; object-fit:cover; background:#E8EEF0; }
  .resume-root .photo img[src=""] { visibility:hidden; }
  .resume-root .photo.noimg { background:#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='160'%3E%3Crect width='120' height='160' fill='%23EEEAE9'/%3E%3Ctext x='60' y='84' font-size='13' text-anchor='middle' fill='%23948C89' font-family='sans-serif'%3E%EC%A6%9D%EB%AA%85%EC%82%AC%EC%A7%84%3C/text%3E%3C/svg%3E") center / calc(100% - 4mm) no-repeat; }
  .resume-root .name-en { display:block; text-align:center; font-size:15pt; font-weight:700; line-height:1.25; }
  .resume-root .name-ko { display:block; text-align:center; color:var(--muted); }
  .resume-root .side h3 { margin:5mm 0 1.5mm; padding-bottom:1mm; font-size:11pt; color:var(--primary); border-bottom:1pt solid var(--rule); }
  .resume-root .kv { position:relative; display:flex; justify-content:space-between; align-items:baseline; gap:3mm; padding:1mm 0; }
  .resume-root .kv .k { flex:none; font-size:10.5pt; color:var(--muted); }
  .resume-root .kv .k.strong { font-size:12pt; font-weight:700; color:var(--text); }
  .resume-root .kv .v { flex:1; min-width:0; text-align:right; }
  .resume-root .hl { margin:1mm 0 2mm; text-align:center; font-size:13pt; font-weight:700; line-height:1.6; }
  .resume-root .q { font-family:Arial,Helvetica,sans-serif; font-size:18pt; font-weight:700; color:var(--brand); line-height:0; vertical-align:-.2em; user-select:none; }
  .resume-root .q.open { margin-right:2mm; } .resume-root .q.close { margin-left:2mm; }
  .resume-root .sec h2 { margin:4mm 0 1mm; padding-bottom:1mm; font-size:14pt; color:var(--primary); border-bottom:1pt solid var(--rule); break-after:avoid; }
  .resume-root .item { position:relative; break-inside:avoid; }
  .resume-root .tl { display:flex; gap:3mm; padding:2mm 0; border-bottom:.75pt solid var(--line); }
  .resume-root .tl-l { flex:0 0 34mm; width:34mm; }
  .resume-root .tl-r { flex:1 1 0; min-width:0; }
  .resume-root .period { display:block; font-size:11pt; font-weight:700; }
  .resume-root .status, .resume-root .sub { display:block; color:var(--muted); }
  .resume-root .status { font-size:11pt; }
  .resume-root .title { display:block; font-weight:700; }
  .resume-root .duties { margin:.5mm 0 0; padding:0; list-style:none; }
  .resume-root .duties li { position:relative; padding-left:4mm; }
  .resume-root .duties li::before { content:"•"; position:absolute; left:.5mm; color:var(--brand); }
  .resume-root .cert { display:flex; justify-content:space-between; align-items:center; gap:3mm; padding:1mm 0; border-bottom:.75pt solid var(--line); }
  .resume-root .cert .sub { font-size:11pt; }
  .resume-root .cert .date { flex:none; font-size:11pt; color:var(--muted); text-align:right; }
  .resume-root .list > .item:last-child { border-bottom:none; }
  .resume-root .intro p { margin:0 0 2mm; line-height:1.7; }
  .resume-root [contenteditable] { outline:none; border-radius:2px; }
  .resume-root [contenteditable]:hover { background:rgba(255,100,100,.07); }
  .resume-root [contenteditable]:focus { background:rgba(255,100,100,.10); box-shadow:0 0 0 1px var(--brand); }
  .resume-root.view [contenteditable]:hover, .resume-root.view [contenteditable]:focus { background:none; box-shadow:none; }
  .resume-root:not(.view) [contenteditable]:empty::before { content:attr(data-ph); color:#B5ADAB; font-weight:400; }
  .resume-root .del { position:absolute; top:1mm; right:-7mm; width:20px; height:20px; padding:0; border:1px solid #CFC8C6; border-radius:50%; background:#fff; color:#8F8986; font-size:13px; line-height:1; cursor:pointer; opacity:0; }
  .resume-root:not(.view) .item:hover > .del { opacity:1; }
  .resume-root.view .del, .resume-root.view .add { display:none; }
  .resume-root .side .del { right:-4mm; }
  .resume-root .sec, .resume-root .side-block { position:relative; }
  .resume-root .add { margin:1mm 0 0; padding:2px 8px; font:12px var(--font); color:#8F8986; background:#fff; border:1px dashed #CFC8C6; border-radius:4px; cursor:pointer; }
  .resume-root .add:hover { color:var(--primary); border-color:var(--brand); }
  .resume-root.view [contenteditable]:empty, .resume-root.view .item.empty, .resume-root.view .sec.empty, .resume-root.view .side-block.empty,
  .resume-root.view .hl.empty, .resume-root.view .intro-sec.empty, .resume-root.view .photo.noimg { display:none !important; }
  @media print {
    html, body { background:#fff !important; }
    .no-print { display:none !important; }
    .resume-root { background:#fff !important; padding:0 !important; }
    .resume-root .sheet { margin:0 auto; box-shadow:none; }
    .resume-root .add, .resume-root .del { display:none !important; }
    .resume-root [contenteditable]:empty, .resume-root .item.empty, .resume-root .sec.empty, .resume-root .side-block.empty,
    .resume-root .hl.empty, .resume-root .intro-sec.empty, .resume-root .photo.noimg { display:none !important; }
  }
`;

function kvRow(k: string, v: string, strong = false): string {
  return `<div class="kv item"><span class="k${strong ? " strong" : ""}" ${CE} data-ph="항목" data-single>${esc(k)}</span><span class="v" ${CE} data-ph="내용" data-single>${esc(v)}</span><button class="del no-print" type="button" title="삭제">×</button></div>`;
}
function tlItem(it: { period: string; status: string; title: string; sub: string; duties: string[] }): string {
  const duties = it.duties.length
    ? it.duties.map((d) => `<li>${esc(d)}</li>`).join("")
    : "";
  return `<div class="tl item"><div class="tl-l"><span class="period" ${CE} data-ph="YYYY.MM – YYYY.MM" data-single>${esc(it.period)}</span><span class="status" ${CE} data-ph="상태" data-single>${esc(it.status)}</span></div><div class="tl-r"><span class="title" ${CE} data-ph="기관명" data-single>${esc(it.title)}</span><span class="sub" ${CE} data-ph="세부 내용" data-single>${esc(it.sub)}</span><ul class="duties" ${CE} data-ph="주요 업무 (Enter로 줄 추가)">${duties}</ul></div><button class="del no-print" type="button" title="삭제">×</button></div>`;
}
function certItem(it: { title: string; sub: string; date: string }): string {
  return `<div class="cert item"><div class="cert-l"><span class="title" ${CE} data-ph="자격증명" data-single>${esc(it.title)}</span><span class="sub" ${CE} data-ph="발급기관" data-single>${esc(it.sub)}</span></div><span class="date" ${CE} data-ph="YYYY.MM.DD" data-single>${esc(it.date)}</span><button class="del no-print" type="button" title="삭제">×</button></div>`;
}

const TPL = {
  info: `<template id="tpl-info">${kvRow("", "")}</template>`,
  skills: `<template id="tpl-skills">${kvRow("", "", true)}</template>`,
  edu: `<template id="tpl-edu">${tlItem({ period: "", status: "", title: "", sub: "", duties: [] })}</template>`,
  career: `<template id="tpl-career">${tlItem({ period: "", status: "", title: "", sub: "", duties: [] })}</template>`,
  certs: `<template id="tpl-certs">${certItem({ title: "", sub: "", date: "" })}</template>`,
  acts: `<template id="tpl-acts">${tlItem({ period: "", status: "", title: "", sub: "", duties: [] })}</template>`,
};

/** ResumeContent + 사진(dataURI) → 편집기 본문 HTML (.sheet 전체). */
export function buildResumeInnerHtml(
  c: ResumeContent,
  photoDataUri: string
): string {
  const infoRows = c.info.map((r) => kvRow(r.k, r.v)).join("");
  const skillRows = c.skills.map((s) => kvRow(s.name, s.level, true)).join("");
  const eduRows = c.educations.map(tlItem).join("");
  const careerRows = c.careers.map(tlItem).join("");
  const certRows = c.certifications.map(certItem).join("");
  const actRows = c.activities.map(tlItem).join("");
  const introHtml = c.intro.length
    ? c.intro.map((p) => `<p>${esc(p)}</p>`).join("")
    : "";

  return `<div class="sheet"><div class="inner">
  <h1 class="doc-title">이력서</h1>
  <div class="top">
    <div class="side">
      <label class="photo" title="클릭해서 사진 바꾸기"><img id="resume-photo" src="${esc(photoDataUri)}" alt="증명사진"><input type="file" id="resume-photo-input" accept="image/*" hidden></label>
      <span class="name-en" ${CE} data-ph="영문 이름" data-single>${esc(c.name_en)}</span>
      <span class="name-ko" ${CE} data-ph="한글 이름" data-single>${esc(c.name_ko)}</span>
      <div class="side-block" data-list="info"><h3>기본 정보</h3><div class="list">${infoRows}</div><button class="add no-print" type="button" data-add="info">+ 추가</button>${TPL.info}</div>
      <div class="side-block" data-list="skills"><h3>기술 및 어학</h3><div class="list">${skillRows}</div><button class="add no-print" type="button" data-add="skills">+ 추가</button>${TPL.skills}</div>
    </div>
    <main>
      <p class="hl"><span class="q open">&ldquo;</span><span class="hl-text" ${CE} data-ph="한 줄 소개 (40자 이내)" data-single>${esc(c.headline)}</span><span class="q close">&rdquo;</span></p>
      <section class="sec" data-list="edu"><h2>학력</h2><div class="list">${eduRows}</div><button class="add no-print" type="button" data-add="edu">+ 추가</button>${TPL.edu}</section>
      <section class="sec" data-list="career"><h2>경력</h2><div class="list">${careerRows}</div><button class="add no-print" type="button" data-add="career">+ 추가</button>${TPL.career}</section>
      <section class="sec" data-list="certs"><h2>자격증 및 수상</h2><div class="list">${certRows}</div><button class="add no-print" type="button" data-add="certs">+ 추가</button>${TPL.certs}</section>
      <section class="sec" data-list="acts"><h2>기타 활동</h2><div class="list">${actRows}</div><button class="add no-print" type="button" data-add="acts">+ 추가</button>${TPL.acts}</section>
    </main>
  </div>
  <section class="sec intro-sec"><h2>자기소개 및 포부</h2><div class="intro" ${CE} data-ph="자기소개를 입력하세요 (3~5문단)">${introHtml}</div></section>
  </div></div>`;
}
