"use client";

import { useState } from "react";
import { toast } from "sonner";

import { tr, type Locale } from "@/lib/i18n";

import { saveStudentDataValueAction } from "../data/actions";
import type { ExtractProposal } from "../data/extract-actions";

/**
 * 업로드 직후 AI 가 읽은 값이 **현재 값과 다를 때** 뜨는 확인 창.
 *   항목마다 "현재 값 / 서류에서 읽은 값" 을 보여주고, 체크한 것만 교체한다 (기본 = 체크 안 함).
 */
export function ExtractConflictDialog({
  locale,
  studentId,
  fileName,
  conflicts,
  onClose,
}: {
  locale: Locale;
  studentId: string;
  fileName: string | null;
  conflicts: ExtractProposal[];
  onClose: (replacedCount: number) => void;
}) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  function toggle(key: string) {
    setChecked((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function replace() {
    const picks = conflicts.filter((c) => checked.has(c.key));
    if (picks.length === 0) return;
    setSaving(true);
    let done = 0;
    for (const p of picks) {
      const res = await saveStudentDataValueAction({
        studentId,
        dataTypeKey: p.key,
        value: p.proposedValue,
      });
      if (res.ok) done += 1;
    }
    setSaving(false);
    if (done < picks.length) {
      toast.warning(
        tr(
          locale,
          `${picks.length}개 중 ${done}개만 교체했습니다.`,
          `Chỉ thay được ${done}/${picks.length} mục.`
        )
      );
    } else {
      toast.success(tr(locale, `${done}개 항목을 교체했습니다.`, `Đã thay ${done} mục.`));
    }
    onClose(done);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-lg bg-white shadow-xl">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            {tr(locale, "서류 내용이 입력된 값과 다릅니다", "Nội dung giấy tờ khác với giá trị đã nhập")}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {fileName ? <span className="font-medium text-slate-700">{fileName}</span> : null}
            {fileName ? " — " : ""}
            {tr(
              locale,
              "바꿀 항목만 체크하고 '교체'를 누르세요. 체크하지 않은 항목은 그대로 둡니다.",
              "Chọn các mục muốn thay rồi bấm 'Thay'. Mục không chọn sẽ giữ nguyên."
            )}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-xs text-slate-600">
              <tr className="text-left">
                <th className="w-10 px-3 py-2" />
                <th className="px-3 py-2 font-medium">{tr(locale, "항목", "Mục")}</th>
                <th className="px-3 py-2 font-medium">{tr(locale, "현재 값", "Giá trị hiện tại")}</th>
                <th className="px-3 py-2 font-medium">{tr(locale, "서류에서 읽은 값", "Giá trị đọc từ giấy tờ")}</th>
              </tr>
            </thead>
            <tbody>
              {conflicts.map((c) => (
                <tr
                  key={c.key}
                  className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                  onClick={() => toggle(c.key)}
                >
                  <td className="px-3 py-2.5 align-top">
                    <input
                      type="checkbox"
                      checked={checked.has(c.key)}
                      onChange={() => toggle(c.key)}
                      onClick={(e) => e.stopPropagation()}
                      className="size-4 accent-slate-900"
                    />
                  </td>
                  <td className="px-3 py-2.5 align-top font-medium text-slate-900">
                    {locale === "ko" ? c.label_ko : c.label_vi}
                  </td>
                  <td className="px-3 py-2.5 align-top text-slate-600">{c.currentDisplay ?? "—"}</td>
                  <td className="px-3 py-2.5 align-top font-medium text-slate-900">{c.proposedDisplay}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button
            type="button"
            onClick={() => onClose(0)}
            disabled={saving}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {tr(locale, "그대로 두기", "Giữ nguyên")}
          </button>
          <button
            type="button"
            onClick={replace}
            disabled={saving || checked.size === 0}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {saving
              ? tr(locale, "교체 중…", "Đang thay…")
              : tr(locale, `교체 (${checked.size})`, `Thay (${checked.size})`)}
          </button>
        </div>
      </div>
    </div>
  );
}
