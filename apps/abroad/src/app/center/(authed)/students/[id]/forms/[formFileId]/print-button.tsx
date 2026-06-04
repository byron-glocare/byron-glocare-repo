"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== "undefined") window.print();
      }}
      className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
    >
      🖨 In / Lưu PDF
    </button>
  );
}
