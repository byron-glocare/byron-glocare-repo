"use client";

import { useState } from "react";

import { tr, type Locale } from "@/lib/i18n";
import type { Json } from "@/types/database";

import { saveStudentDataValueAction } from "./actions";
import {
  extractStudentDataAction,
  type ExtractProposal,
} from "./extract-actions";

/**
 * 업로드 서류 → AI 추출 → **제안 검토 → 운영자 확인 적용** 패널.
 *   추출만으로는 저장하지 않는다. 체크한 항목만 저장 + 에디터 state 반영(onApplied).
 *   기본 체크: 현재 비어있는 항목만(기존 값 덮어쓰지 않게).
 */
export function AiExtractPanel({
  locale,
  studentId,
  onApplied,
}: {
  locale: Locale;
  studentId: string;
  onApplied: (key: string, value: Json) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposals, setProposals] = useState<ExtractProposal[] | null>(null);
  const [scanned, setScanned] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);
  const [appliedCount, setAppliedCount] = useState<number | null>(null);

  async function runExtract() {
    setBusy(true);
    setError(null);
    setAppliedCount(null);
    setProposals(null);
    const res = await extractStudentDataAction(studentId);
    setBusy(false);
    if (!res.ok) {
      const raw = res.error;
      const friendly =
        raw === "NO_FILES"
          ? tr(
              locale,
              "추출할 업로드 서류가 없습니다. '서류 등록' 탭에서 먼저 파일을 올려주세요.",
              "Chưa có giấy tờ để trích xuất. Hãy tải tệp ở tab 'Tải giấy tờ' trước."
            )
          : raw === "FILES_TOO_LARGE" ||
              /413|request_too_large|too.?large|maximum size/i.test(raw)
            ? tr(
                locale,
                "업로드 서류 용량이 커서 한 번에 분석할 수 없습니다. 파일 크기를 줄이거나(사진은 해상도를 낮춰) 서류 수를 줄여 다시 시도하세요.",
                "Giấy tờ quá lớn để phân tích cùng lúc. Hãy giảm dung lượng tệp (hạ độ phân giải ảnh) hoặc bớt số giấy tờ rồi thử lại."
              )
            : raw;
      setError(friendly);
      return;
    }
    setScanned(res.scannedDocs);
    setSkipped(res.skippedDocs);
    setProposals(res.proposals);
    // 기본 체크 = 현재 비어있는 항목만
    setChecked(
      new Set(res.proposals.filter((p) => p.isCurrentEmpty).map((p) => p.key))
    );
  }

  function toggle(key: string) {
    setChecked((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function applySelected() {
    if (!proposals) return;
    const picks = proposals.filter((p) => checked.has(p.key));
    if (picks.length === 0) return;
    setApplying(true);
    setError(null);
    let done = 0;
    for (const p of picks) {
      const res = await saveStudentDataValueAction({
        studentId,
        dataTypeKey: p.key,
        value: p.proposedValue,
      });
      if (res.ok) {
        onApplied(p.key, p.proposedValue);
        done += 1;
      }
    }
    setApplying(false);
    setAppliedCount(done);
    setProposals(null);
    setChecked(new Set());
  }

  function close() {
    setProposals(null);
    setChecked(new Set());
  }

  return (
    <section className="rounded-lg border border-violet-200 bg-violet-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-violet-900">
            🪄 {tr(locale, "업로드 서류에서 AI로 채우기", "Tự động điền từ giấy tờ (AI)")}
          </h2>
          <p className="mt-0.5 text-xs text-violet-700">
            {tr(
              locale,
              "여권·성적표·가족관계증명서 등 올린 서류를 AI가 읽어 항목을 제안합니다. 확인 후 적용됩니다.",
              "AI đọc hộ chiếu, học bạ, giấy tờ gia đình… đã tải để gợi ý. Bạn xác nhận rồi mới áp dụng."
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={runExtract}
          disabled={busy || applying}
          className="shrink-0 rounded-md bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
        >
          {busy
            ? tr(locale, "서류 분석 중…", "Đang phân tích…")
            : tr(locale, "AI로 채우기", "Điền bằng AI")}
        </button>
      </div>

      {appliedCount !== null ? (
        <p className="mt-2 text-sm text-emerald-700">
          ✓{" "}
          {tr(
            locale,
            `${appliedCount}개 항목을 적용했습니다.`,
            `Đã áp dụng ${appliedCount} mục.`
          )}
        </p>
      ) : null}

      {error ? (
        <p className="mt-2 text-sm text-rose-700">{error}</p>
      ) : null}

      {proposals && skipped > 0 ? (
        <p className="mt-2 text-xs text-amber-700">
          ⚠{" "}
          {tr(
            locale,
            `용량이 커서 ${skipped}개 서류는 이번 분석에서 제외됐습니다(한 번에 약 20MB까지). 나머지 서류로 분석했습니다.`,
            `${skipped} giấy tờ bị bỏ qua do dung lượng lớn (tối đa ~20MB mỗi lần). Đã phân tích các giấy tờ còn lại.`
          )}
        </p>
      ) : null}

      {proposals ? (
        proposals.length === 0 ? (
          <div className="mt-3 rounded-md border border-violet-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
            {tr(
              locale,
              `서류 ${scanned}개를 분석했지만 추출할 수 있는 값을 찾지 못했습니다.`,
              `Đã phân tích ${scanned} giấy tờ nhưng không tìm được giá trị nào.`
            )}
          </div>
        ) : (
          <div className="mt-3 rounded-md border border-violet-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
              <span className="text-xs font-medium text-slate-600">
                {tr(
                  locale,
                  `서류 ${scanned}개 분석 · 제안 ${proposals.length}개`,
                  `${scanned} giấy tờ · ${proposals.length} gợi ý`
                )}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setChecked(new Set(proposals.map((p) => p.key)))}
                  className="text-xs text-violet-700 hover:underline"
                >
                  {tr(locale, "전체 선택", "Chọn tất cả")}
                </button>
                <button
                  type="button"
                  onClick={() => setChecked(new Set())}
                  className="text-xs text-slate-500 hover:underline"
                >
                  {tr(locale, "전체 해제", "Bỏ chọn")}
                </button>
              </div>
            </div>

            <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
              {proposals.map((p) => {
                const isChecked = checked.has(p.key);
                return (
                  <li key={p.key} className="flex items-start gap-3 px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggle(p.key)}
                      className="mt-1 size-4 shrink-0 accent-violet-600"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-medium text-slate-900">
                          {locale === "ko" ? p.label_ko : p.label_vi}
                        </span>
                        <ConfidenceBadge locale={locale} confidence={p.confidence} />
                        {p.source ? (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                            {p.source}
                          </span>
                        ) : null}
                        {!p.isCurrentEmpty ? (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">
                            {tr(locale, "덮어쓰기", "Ghi đè")}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-0.5 text-sm">
                        {!p.isCurrentEmpty && p.currentDisplay ? (
                          <span className="text-slate-400 line-through">
                            {p.currentDisplay}
                          </span>
                        ) : null}
                        <span
                          className={
                            !p.isCurrentEmpty
                              ? "ml-1.5 font-medium text-violet-700"
                              : "font-medium text-violet-700"
                          }
                        >
                          {p.proposedDisplay}
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-4 py-3">
              <button
                type="button"
                onClick={close}
                disabled={applying}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                {tr(locale, "취소", "Hủy")}
              </button>
              <button
                type="button"
                onClick={applySelected}
                disabled={applying || checked.size === 0}
                className="rounded-md bg-violet-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {applying
                  ? tr(locale, "적용 중…", "Đang áp dụng…")
                  : tr(
                      locale,
                      `선택 적용 (${checked.size})`,
                      `Áp dụng (${checked.size})`
                    )}
              </button>
            </div>
          </div>
        )
      ) : null}
    </section>
  );
}

function ConfidenceBadge({
  locale,
  confidence,
}: {
  locale: Locale;
  confidence: "high" | "medium" | "low";
}) {
  const map = {
    high: {
      cls: "bg-emerald-100 text-emerald-700",
      txt: tr(locale, "높음", "Cao"),
    },
    medium: {
      cls: "bg-sky-100 text-sky-700",
      txt: tr(locale, "보통", "TB"),
    },
    low: {
      cls: "bg-slate-100 text-slate-500",
      txt: tr(locale, "낮음", "Thấp"),
    },
  }[confidence];
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] ${map.cls}`}>
      {tr(locale, "신뢰도 ", "Độ tin ")}
      {map.txt}
    </span>
  );
}
